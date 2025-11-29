const fs = require("fs");
const path = require("path");

function loadGames(gamesDir) {
  const games = {};
  if (!fs.existsSync(gamesDir)) return games;

  for (const folder of fs.readdirSync(gamesDir)) {
    const gamePath = path.join(gamesDir, folder);
    const configPath = path.join(gamePath, "game.json");
    if (!fs.existsSync(configPath)) continue;
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const logicPath = path.join(gamePath, config.entry || "logic.js");
      const logic = fs.existsSync(logicPath) ? require(logicPath) : null;
      games[config.id] = { config, logic, path: gamePath };
      console.log(`Loaded game: ${config.id}`);
    } catch (e) {
      console.warn(`Failed to load game ${folder}:`, e.message);
    }
  }
  return games;
}

module.exports = loadGames;
