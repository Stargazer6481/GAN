<<<<<<< HEAD
# GAN - Self-Hosted Party Game Framework

A lightweight, self-hosted multiplayer game platform for hosting party night games. Think of it like a self-hosted Jackbox Party Pack, but for developers who want to build and customize their own games.

> **⚠️ Disclaimer:** This is a small passion project that was **heavily vibed coded with the help of AI**. It works, but it's rough around the edges. Don't expect production-grade polish.

## What is GAN?

GAN is **not** a trivia game. GAN is a **framework** for hosting multiplayer party games. It comes with a built-in Example Trivia game as a demo, but the real power is in building your own games.

Key features:
- 🎮 Self-hosted multiplayer game framework
- 🎯 Multiple games in one server
- 📱 Works on phones, tablets, and desktop browsers
- 🎨 Easy to create custom games
- 🐳 Docker support or vanilla Node.js
- 🔌 Real-time communication with Socket.io

## Installation

### Prerequisites
- **Node.js 20+** (or use Docker)
- **npm** or **yarn**

### Option 1: Local Installation with Node.js

1. Clone the repository:
```bash
git clone https://github.com/Stargazer6481/GAN.git
cd GAN
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

The server will listen on `http://localhost:3000`

For development with hot-reload:
```bash
npm run dev
```

### Option 2: Docker Installation

Docker support is available, but **note:** The Docker setup does not include a pre-built database. You still need to clone the repository and the games are loaded from the local `./games` directory.

1. Clone the repository:
```bash
git clone https://github.com/Stargazer6481/GAN.git
cd GAN
```

2. Build and run with Docker Compose:
```bash
docker-compose up --build
```

The server will be accessible at `http://localhost:3000`

The Docker setup mounts:
- `./games` - Your game directories
- `./public` - Static host dashboard

You can add new games to the `./games` directory and they'll be loaded automatically.

## How to Use

### As a Host

1. Open `http://localhost:3000` in your browser
2. Click on a game to start hosting
3. A room ID will be generated (e.g., `A1B2C3`)
4. Share the room ID with players
5. Players can scan the QR code or enter the room ID manually
6. Once all players have joined, click "Start Game" to begin

### As a Player

1. Go to `http://localhost:3000/games/[game-id]/player.html`
2. Enter the room ID shared by the host
3. Wait for the game to start
4. Follow the game instructions

## Creating Your Own Games

### Game Structure

Each game is a folder in the `games/` directory with this structure:

```
games/your-game/
├── game.json          # Game metadata
├── logic.js           # Game logic & rules
└── public/
    ├── host.html      # Host interface
    └── player.html    # Player interface
```

### Step 1: Create `game.json`

```json
{
  "name": "Your Game Name",
  "id": "your-game-id",
  "minPlayers": 2,
  "maxPlayers": 8,
  "categories": [
    { "id": 1, "name": "Category 1" },
    { "id": 2, "name": "Category 2" }
  ]
}
```

### Step 2: Create `logic.js`

This is where the game logic lives. You need to export an object with specific methods:

```javascript
module.exports = {
  // Initialize the room/game state
  initRoom(room, categories, maxTime, questionCount) {
    room.state = {
      maxTime: maxTime || 30000,
      questionCount: questionCount || 10,
      currentQuestion: 0,
      scores: {},
      answers: {}
    };
    
    // Initialize scores for all players
    Object.keys(room.players).forEach(playerId => {
      room.state.scores[playerId] = 0;
    });
  },

  // Get the current question/data
  getCurrentQuestion(room) {
    return {
      question: "What is 2+2?",
      options: ["1", "4", "5"]
    };
  },

  // Process a player's answer
  submitAnswer(room, playerId, answerIndex, timeTakenMs) {
    // Check if correct, update scores, etc.
    room.state.scores[playerId] += 10;
  },

  // Check if all players have answered
  allAnswered(room) {
    return Object.keys(room.players).length ===
           Object.keys(room.state.answers).length;
  },

  // Finalize the question and return reveal data
  finalizeQuestion(room) {
    return {
      correctAnswer: 1,
      explanations: {}
    };
  },

  // Move to next question
  nextQuestion(room) {
    room.state.currentQuestion++;
    return this.getCurrentQuestion(room);
  },

  // Check if game is over
  isGameOver(room) {
    return room.state.currentQuestion >= room.state.questionCount;
  },

  // Get final stats when game ends
  getGameEndStats(room) {
    return {
      scores: room.state.scores,
      winner: /* calculate winner */
    };
  }
};
```

### Step 3: Create HTML Files

Create `public/host.html` and `public/player.html` for your game UI.

**Tip:** Look at the Example Trivia game in `games/example-trivia/` for a complete working example.

### Step 4: Communication with Socket.io

To communicate between the client and server, use Socket.io events.

**From client to server:**
```javascript
socket.emit("eventName", { data });
socket.on("eventName", (data) => {
  // Handle response
});
```

**From server to clients:**
```javascript
io.to(roomId).emit("eventName", data);
```

### Advanced: Custom Socket Events

If you need custom events beyond the standard game flow, you'll need to modify `server/socket.js`:

1. Add a new socket event handler:
```javascript
socket.on("myCustomEvent", ({ roomId, data }) => {
  const room = rooms[roomId];
  // Your logic here
  io.to(roomId).emit("myCustomEventResponse", result);
});
```

2. Use it in your game's HTML:
```javascript
socket.emit("myCustomEvent", { roomId, data });
```

## File Structure

```
GAN/
├── server/
│   ├── index.js          # Express server & routes
│   ├── socket.js         # Socket.io room management
│   └── core/
│       └── game-loader.js # Loads games from /games
├── games/
│   ├── example-trivia/    # Demo trivia game
│   └── pictionary/        # Draw & guess game
├── public/
│   ├── index.html         # Landing page
│   ├── host-dashboard.html # Host control center
│   ├── styles.css
│   └── assets/
├── package.json
├── docker-compose.yml
└── Dockerfile
```

## API Endpoints

### `GET /api/games`
Returns a list of all available games with metadata.

```json
[
  {
    "id": "example-trivia",
    "name": "Example Trivia",
    "minPlayers": 2,
    "maxPlayers": 10,
    "categories": [...]
  }
]
```

## Socket.io Events

### Host Events
- `createRoom({ gameId, hostName })` - Create a new game room
- `startGame({ roomId, categories, maxTime, questionCount })` - Start the game

### Player Events
- `joinRoom({ roomId, playerName })` - Join an existing room
- `playerAnswer({ roomId, playerId, answerIndex })` - Submit an answer

### Broadcast Events
- `playerList` - Updated list of connected players
- `newQuestion` - New question/round data
- `reveal` - Reveal correct answer
- `gameEnd` - Game finished with stats

## Troubleshooting

### Game not loading?
- Check console for errors in `socket.js`
- Ensure `game.json` is in the correct format
- Verify `logic.js` exports the required methods

### Players can't connect?
- Make sure they're accessing the right room ID
- Check firewall/network settings
- Verify Socket.io is connecting (check browser console)

### Custom events not working?
- Check `socket.js` for the event handler
- Make sure you're emitting to the correct room ID
- Check browser console and server logs for errors

## Known Limitations

- **No persistent storage** - All game data is in-memory (resets on server restart)
- **No authentication** - Anyone with the room ID can join
- **No data persistence** - Example Trivia fetches from OpenTDB (external API)
- **Single-instance only** - No multi-server support

## Tech Stack

- **Frontend:** Vanilla JavaScript + HTML/CSS
- **Backend:** Node.js + Express.js
- **Real-time:** Socket.io
- **Containerization:** Docker

## Development Notes

This project was built quickly with AI assistance and prioritizes functionality over elegance. If you're planning to extend it:

- The socket.js file handles all game flow - this is where most custom logic goes
- Games are dynamically loaded from the `games/` directory
- Each game's `logic.js` is responsible for its own rules and state management
- UI frameworks aren't used - it's all vanilla JS, which makes it easy to customize

## License

Feel free to fork and modify as needed.

---

**Made with vibes and a little help from AI** 🚀
=======
# **GAN – Game Answer Network**  
*A tiny, chaotic, heavily vibe-coded trivia game powered by OpenTDB categories.*

## ⭐️ What is This?
GAN is a lightweight real-time multiplayer trivia game built with:

- **Node.js**
- **Express**
- **Socket.IO**
- **OpenTDB** (for categories & questions)
- **QR Code join system**
- **Point scoring based on answer speed**
- **Countdown timer per question**

This was a **small little project that was heavily vibe-coded** — not meant to be fancy, but it’s fun, fast, and actually works.

---

# 🚀 Features

### ✔ Multiplayer lobby via QR code  
Scan → join → play instantly.

### ✔ Choose ANY category from **OpenTDB.com**  
The host picks the question category before starting.

### ✔ Fast-answer scoring  
Answer faster → get more points.

### ✔ Question timer  
A visible timer bar counts down.

### ✔ Auto game tracking  
Scores, rounds, and results tracked live.

### ✔ Frontend is clean, simple, and optimized for phone players.

---

# 📦 Folder Structure

>>>>>>> da9ff72748ad77f92ac764befcc558d1071b9cdf
