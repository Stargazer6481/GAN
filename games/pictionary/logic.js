// Pictionary word lists by category
const wordLists = {
  animals: [
    "cat", "dog", "elephant", "lion", "tiger", "monkey", "giraffe", "penguin", "dolphin", "shark",
    "butterfly", "eagle", "snake", "crocodile", "zebra", "horse", "pig", "cow", "sheep", "chicken"
  ],
  objects: [
    "apple", "banana", "pizza", "hamburger", "ice cream", "car", "bicycle", "house", "tree", "flower",
    "phone", "computer", "watch", "book", "pen", "cup", "bottle", "chair", "table", "bed"
  ],
  actions: [
    "running", "jumping", "dancing", "sleeping", "eating", "drinking", "swimming", "flying", "driving", "walking",
    "singing", "laughing", "crying", "thinking", "hugging", "kissing", "fighting", "cooking", "painting", "reading"
  ],
  movies: [
    "titanic", "avatar", "frozen", "lion king", "finding nemo", "toy story", "shrek", "batman", "superman", "spider-man",
    "harry potter", "lord of the rings", "star wars", "avengers", "jurassic park", "inception", "the matrix", "jaws", "alien", "e.t."
  ],
  random: [
    "volcano", "rocket", "dinosaur", "mermaid", "robot", "pirate", "ninja", "wizard", "dragon", "ghost",
    "unicorn", "superhero", "teacher", "doctor", "chef", "astronaut", "clown", "monster", "vampire", "zombie"
  ]
};

// Game state management
module.exports = {
  initRoom: function(room, categories = [], maxTime = 60, limitCount = 3) {
    room.gameState = {
      phase: "waiting", // waiting, drawing, reveal, gameover
      currentRound: 0,
      totalRounds: limitCount,
      words: [],
      currentWord: null,
      currentDrawer: null,
      drawerSocketId: null,
      roundStartTime: null,
      maxTimeMs: maxTime * 1000,
      scores: {},
      guesses: {}, // { socketId: guessedWord }
      drawingData: [] // array of drawing strokes
    };

    room.players.forEach(p => {
      room.gameState.scores[p.id] = 0;
    });

    // Load words from selected categories
    let allWords = [];
    const catList = categories && categories.length > 0 ? categories : Object.keys(wordLists);
    catList.forEach(cat => {
      if (wordLists[cat]) {
        allWords = allWords.concat(wordLists[cat]);
      }
    });

    // Shuffle and select words for rounds
    for (let i = 0; i < limitCount; i++) {
      const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
      room.gameState.words.push(randomWord);
    }
  },

  startRound: function(room) {
    if (room.gameState.currentRound >= room.gameState.totalRounds) {
      room.gameState.phase = "gameover";
      return false;
    }

    room.gameState.phase = "drawing";
    room.gameState.currentWord = room.gameState.words[room.gameState.currentRound];
    
    // Rotate drawer (round-robin)
    const playerIds = room.players.map(p => p.id);
    room.gameState.currentDrawer = room.gameState.currentRound % playerIds.length;
    room.gameState.drawerSocketId = playerIds[room.gameState.currentDrawer];
    
    room.gameState.roundStartTime = Date.now();
    room.gameState.guesses = {};
    room.gameState.drawingData = [];

    return true;
  },

  getCurrentWord: function(room) {
    return room.gameState.currentWord;
  },

  getDrawerSocketId: function(room) {
    return room.gameState.drawerSocketId;
  },

  submitGuess: function(room, playerId, guessedWord) {
    if (playerId === room.gameState.drawerSocketId) {
      return { correct: false, message: "Drawer cannot guess" };
    }

    if (room.gameState.guesses[playerId]) {
      return { correct: false, message: "Already guessed" };
    }

    const normalizedGuess = guessedWord.toLowerCase().trim();
    const normalizedWord = room.gameState.currentWord.toLowerCase().trim();

    const isCorrect = normalizedGuess === normalizedWord;

    room.gameState.guesses[playerId] = {
      word: guessedWord,
      correct: isCorrect,
      timestamp: Date.now()
    };

    if (isCorrect) {
      // Award points to guesser
      room.gameState.scores[playerId] = (room.gameState.scores[playerId] || 0) + 100;
      
      // Award points to drawer
      room.gameState.scores[room.gameState.drawerSocketId] = 
        (room.gameState.scores[room.gameState.drawerSocketId] || 0) + 50;
    }

    return { correct: isCorrect };
  },

  getGuesses: function(room) {
    const guessData = {};
    for (const [pid, data] of Object.entries(room.gameState.guesses)) {
      const player = room.players.find(p => p.id === pid);
      guessData[pid] = {
        playerName: player ? player.name : "Unknown",
        word: data.word,
        correct: data.correct
      };
    }
    return guessData;
  },

  storeDrawing: function(room, drawData) {
    room.gameState.drawingData.push(drawData);
  },

  getDrawingData: function(room) {
    return room.gameState.drawingData;
  },

  nextRound: function(room) {
    room.gameState.currentRound++;
    room.gameState.phase = "waiting";
  },

  isGameOver: function(room) {
    return room.gameState.currentRound >= room.gameState.totalRounds;
  },

  getScores: function(room) {
    return room.gameState.scores;
  },

  getGameState: function(room) {
    return room.gameState;
  }
};
