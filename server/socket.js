module.exports = (io, games) => {
  const rooms = {};

  io.on("connection", socket => {
    console.log("socket connected:", socket.id);

    // CREATE ROOM
    socket.on("createRoom", ({ gameId, hostName }, callback) => {
      const game = games[gameId];
      if (!game) return callback({ error: "No such game" });

      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

      rooms[roomId] = {
        id: roomId,
        gameId,
        players: {},
        hostId: socket.id,
        logic: game.logic,
        state: {}
      };

      // Host does NOT play, only spectates
      socket.join(roomId);
      callback({ roomId });
    });

    // JOIN ROOM (for actual players)
    socket.on("joinRoom", ({ roomId, playerName }, callback) => {
      const room = rooms[roomId];
      if (!room) return callback({ error: "Room not found" });

      room.players[socket.id] = {
        id: socket.id,
        name: playerName || "Player"
      };

      socket.join(roomId);

      io.to(roomId).emit("playerList",
        Object.values(room.players).map(p => ({
          id: p.id,
          name: p.name,
          score: room.state?.scores?.[p.id] || 0,
          selected: room.state?.answers?.[p.id]?.answerIndex ?? null
        }))
      );

      callback({ success: true });
    });

    // PLAYER ANSWER
    socket.on("playerAnswer", ({ roomId, playerId, answerIndex }) => {
      const room = rooms[roomId];
      if (!room) return;

      const now = Date.now();
      const timeTakenMs = now - (room.state.questionStart || now);

      room.logic.submitAnswer(room, playerId, answerIndex, timeTakenMs);

      io.to(roomId).emit("playerList",
        Object.values(room.players).map(p => ({
          id: p.id,
          name: p.name,
          score: room.state.scores[p.id] || 0,
          selected: room.state.answers[p.id]?.answerIndex
        }))
      );

      if (room.logic.allAnswered(room)) {
        clearTimeout(room.state.timer);

        const reveal = room.logic.finalizeQuestion(room);
        io.to(roomId).emit("reveal", reveal);

        setTimeout(() => {
          const nextQ = room.logic.nextQuestion(room);
          
          if (room.logic.isGameOver(room)) {
            // Game ended - get end stats with traits
            const endStats = room.logic.getGameEndStats(room);
            io.to(roomId).emit("gameEnd", endStats);
            return;
          }

          room.state.questionStart = Date.now();

          io.to(roomId).emit("newQuestion", {
            question: nextQ.question,
            options: nextQ.options,
            maxTimeMs: room.state.maxTime
          });

          room.state.timer = setTimeout(() => {
            const r2 = room.logic.finalizeQuestion(room);
            io.to(roomId).emit("reveal", r2);
          }, room.state.maxTime);

        }, 4000);
      }
    });

    // START GAME
    socket.on("startGame", async ({ roomId, categories, maxTime, questionCount }) => {
      const room = rooms[roomId];
      if (!room) return;

      let cats = [];
      if (Array.isArray(categories)) cats = categories.map(Number);
      if (typeof categories === "string") cats = categories.split(",").map(Number);
      if (!cats.length) cats = [9];

      const limit = typeof questionCount === "number" && questionCount > 0
        ? questionCount
        : 10;

      // Initialize room based on game type
      if (room.gameId === "example-trivia") {
        await room.logic.initRoom(room, cats, maxTime, limit);
        startTriviaGame(room, roomId);
      } else if (room.gameId === "pictionary") {
        room.logic.initRoom(room, cats, maxTime, limit);
        startPictionaryGame(room, roomId);
      }
    });

    function startTriviaGame(room, roomId) {
      if (room.logic.isGameOver(room)) {
        const endStats = room.logic.getGameEndStats(room);
        io.to(roomId).emit("gameEnd", endStats);
        return;
      }

      const q = room.logic.getCurrentQuestion(room);
      if (!q) {
        const endStats = room.logic.getGameEndStats(room);
        io.to(roomId).emit("gameEnd", endStats);
        return;
      }

      room.state.questionStart = Date.now();

      io.to(roomId).emit("newQuestion", {
        question: q.question,
        options: q.options,
        maxTimeMs: room.state.maxTime
      });

      room.state.timer = setTimeout(() => {
        const reveal = room.logic.finalizeQuestion(room);
        io.to(roomId).emit("reveal", reveal);
      }, room.state.maxTime);
    }

    function startPictionaryGame(room, roomId) {
      room.logic.startRound(room);
      const drawer = Object.values(room.players).find(p => p.id === room.logic.getDrawerSocketId(room));
      
      io.to(roomId).emit("roundStart", {
        drawerSocketId: room.logic.getDrawerSocketId(room),
        drawerName: drawer ? drawer.name : "Unknown",
        maxTimeMs: room.state.maxTimeMs
      });

      room.state.roundTimer = setTimeout(() => {
        endPictionaryRound(room, roomId);
      }, room.state.maxTimeMs);
    }

    function endPictionaryRound(room, roomId) {
      room.logic.nextRound(room);

      if (room.logic.isGameOver(room)) {
        io.to(roomId).emit("gameOver", room.logic.getScores(room));
      } else {
        startPictionaryGame(room, roomId);
      }
    }

    socket.on("draw", ({ roomId, fromX, fromY, toX, toY, color, width }) => {
      io.to(roomId).emit("drawingUpdate", {
        fromX, fromY, toX, toY, color, width
      });
    });

    socket.on("submitGuess", ({ roomId, playerId, guessedWord }) => {
      const room = rooms[roomId];
      if (!room) return;

      const result = room.logic.submitGuess(room, playerId, guessedWord);
      
      if (result.correct) {
        socket.emit("guessResult", { correct: true });
        io.to(roomId).emit("guessSubmitted", room.logic.getGuesses(room));
      } else {
        socket.emit("guessResult", { correct: false });
      }
    });

    socket.on("disconnect", () => {
      for (const [rid, room] of Object.entries(rooms)) {
        if (room.players[socket.id]) {
          delete room.players[socket.id];
          io.to(rid).emit("playerList",
            Object.values(room.players).map(p => ({
              id: p.id,
              name: p.name,
              score: room.state?.scores?.[p.id] || 0,
              selected: room.state?.answers?.[p.id]?.answerIndex ?? null
            }))
          );
        }
      }
    });
  });

  return rooms;
};
