const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const loadGames = require("./core/game-loader");
const createRoomManager = require("./socket");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// static files (host UI + landing)
app.use(express.static(path.join(__dirname, "../public")));

// serve game frontends
app.use("/games", express.static(path.join(__dirname, "../games")));

const games = loadGames(path.join(__dirname, "../games"));
const rooms = createRoomManager(io, games);

app.get("/api/games", (req, res) => {
  // list available games (id, name, min/max, categories)
  const list = Object.values(games).map(g => ({
    id: g.config.id,
    name: g.config.name,
    minPlayers: g.config.minPlayers,
    maxPlayers: g.config.maxPlayers,
    categories: g.config.categories || []
  }));
  res.json(list);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`GAN listening on port ${PORT}`);
});
