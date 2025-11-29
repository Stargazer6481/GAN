// logic.js - Trivia game logic (scoring = Option C)

let fetchFn = (typeof fetch !== "undefined") ? fetch : null;
if (!fetchFn) {
  try {
    fetchFn = require("node-fetch");
  } catch (e) {
    throw new Error("No fetch available. Install node-fetch or use Node 18+.");
  }
}

const BASE_POINTS = 100;
const TIME_BONUS_MAX = 150;
const FASTEST_BONUS = 100;

module.exports = {
  async initRoom(room, categories = [9], maxTime = 15, limitCount = 10) {
    room.state = {
      currentQ: 0,
      questions: [],
      scores: {},
      answers: {},
      questionStart: null,
      maxTime: maxTime * 1000,
      limitCount,
      // Stat tracking for end game
      playerStats: {}
    };

    Object.values(room.players).forEach(p => {
      room.state.scores[p.id] = 0;
      room.state.playerStats[p.id] = {
        correctCount: 0,
        totalAnswered: 0,
        streak: 0,
        maxStreak: 0,
        responseTimes: [],
        avgResponseTime: 0
      };
    });

    await this.loadQuestions(room, categories, limitCount);
  },

  // NEW: use limitCount instead of fixed 10
  async loadQuestions(room, categoryIds, limitCount) {
    room.state.questions = [];
    for (const catId of categoryIds) {
      const url = `https://opentdb.com/api.php?amount=${limitCount}&category=${catId}&type=multiple&encode=url3986`;
      const res = await fetchFn(url);
      const json = await res.json();
      if (!json.results) continue;

      const mapped = json.results.map(q => {
        const question = decodeURIComponent(q.question);
        const correct = decodeURIComponent(q.correct_answer);
        const incorrect = q.incorrect_answers.map(a => decodeURIComponent(a));

        const answers = [...incorrect, correct].sort(() => Math.random() - 0.5);

        return {
          question,
          options: answers,
          answer: answers.indexOf(correct)
        };
      });

      room.state.questions.push(...mapped);
    }

    room.state.questions.sort(() => Math.random() - 0.5);
  },

  getCurrentQuestion(room) {
    return room.state.questions[room.state.currentQ] || null;
  },

  submitAnswer(room, playerId, answerIndex, timeTakenMs) {
    if (!room.state) return;
    if (room.state.answers[playerId]) return;

    const q = this.getCurrentQuestion(room);
    if (!q) return;

    const isCorrect = answerIndex === q.answer;

    const maxTime = room.state.maxTime;
    const timeRemainingMs = Math.max(0, maxTime - timeTakenMs);
    const timeRatio = Math.max(0, Math.min(1, timeRemainingMs / maxTime));

    const timeBonus = Math.floor(timeRatio * TIME_BONUS_MAX);
    const provisional = isCorrect ? (BASE_POINTS + timeBonus) : 0;

    room.state.answers[playerId] = {
      answerIndex,
      timeTakenMs,
      timeSeconds: (timeTakenMs / 1000).toFixed(1),
      provisionalPoints: provisional,
      correct: isCorrect
    };

    if (!room.state.scores[playerId]) room.state.scores[playerId] = 0;
    if (isCorrect) {
      room.state.scores[playerId] += provisional;
    }

    // Track stats
    const stats = room.state.playerStats[playerId];
    stats.totalAnswered++;
    stats.responseTimes.push(timeTakenMs);
    stats.avgResponseTime = Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length);

    if (isCorrect) {
      stats.correctCount++;
      stats.streak++;
      stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
    } else {
      stats.streak = 0;
    }
  },

  allAnswered(room) {
    const playerCount = Object.keys(room.players).length;
    const ansCount = Object.keys(room.state.answers).length;
    return playerCount > 0 && ansCount >= playerCount;
  },

  finalizeQuestion(room) {
    const q = this.getCurrentQuestion(room);
    if (!q) return null;

    if (Object.keys(room.state.answers).length === 0) {
      return {
        correctIndex: q.answer,
        selections: {},
        scores: { ...room.state.scores }
      };
    }

    let fastestId = null;
    let bestTime = Infinity;
    for (const [pid, ans] of Object.entries(room.state.answers)) {
      if (ans.timeTakenMs < bestTime) {
        bestTime = ans.timeTakenMs;
        fastestId = pid;
      }
    }

    if (fastestId) {
      room.state.scores[fastestId] += FASTEST_BONUS;
    }

    const selections = {};
    for (const [pid, ans] of Object.entries(room.state.answers)) {
      selections[pid] = {
        name: room.players[pid].name, // ⭐ FIX: names now included
        answerIndex: ans.answerIndex,
        correct: ans.answerIndex === q.answer,
        timeSeconds: ans.timeSeconds, // ⭐ readable seconds
        provisionalPoints: ans.provisionalPoints
      };
    }

    return {
      correctIndex: q.answer,
      selections,
      fastestId,
      scores: { ...room.state.scores }
    };
  },

  nextQuestion(room) {
    room.state.answers = {};
    room.state.currentQ++;
    return this.getCurrentQuestion(room);
  },

  isGameOver(room) {
    return room.state.currentQ >= room.state.limitCount;
  },

  getGameEndStats(room) {
    // Build ranked list from last place to first
    const playerIds = Object.keys(room.players);
    const rankings = playerIds.map(pid => ({
      id: pid,
      name: room.players[pid].name,
      score: room.state.scores[pid] || 0,
      stats: room.state.playerStats[pid]
    })).sort((a, b) => a.score - b.score); // Ascending: last place first

    // Assign traits based on performance
    const traits = {};
    const playerStats = room.state.playerStats;

    // Identify special achievements
    let bestAccuracy = -1, bestAccuracyId = null;
    let fastestAvg = Infinity, fastestId = null;
    let longestStreak = -1, streakId = null;
    let mostImproved = -1, improvedId = null;

    playerIds.forEach(pid => {
      const stats = playerStats[pid];
      const accuracy = stats.totalAnswered > 0 ? stats.correctCount / stats.totalAnswered : 0;

      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        bestAccuracyId = pid;
      }
      if (stats.avgResponseTime < fastestAvg) {
        fastestAvg = stats.avgResponseTime;
        fastestId = pid;
      }
      if (stats.maxStreak > longestStreak) {
        longestStreak = stats.maxStreak;
        streakId = pid;
      }
    });

    // Assign traits to each player
    rankings.forEach((player, index) => {
      const rank = index + 1;
      const stats = player.stats;
      const accuracy = stats.totalAnswered > 0 ? stats.correctCount / stats.totalAnswered : 0;

      let trait = "";
      let description = "";

      if (rank === rankings.length) {
        // Winner
        trait = "🏆 Champion";
        description = `${stats.correctCount}/${stats.totalAnswered} correct`;
      } else if (player.id === bestAccuracyId && bestAccuracy > 0.6) {
        trait = "🎯 Sharpshooter";
        description = `${Math.round(accuracy * 100)}% accuracy`;
      } else if (player.id === fastestId) {
        trait = "⚡ Speed Demon";
        description = `${Math.round(fastestAvg)}ms avg response`;
      } else if (player.id === streakId && longestStreak >= 3) {
        trait = "🔥 On Fire";
        description = `${longestStreak} question streak`;
      } else if (stats.correctCount === 0) {
        trait = "🎓 Learning";
        description = "Keep practicing!";
      } else if (accuracy >= 0.7) {
        trait = "💪 Consistent";
        description = `${Math.round(accuracy * 100)}% accuracy`;
      } else if (stats.avgResponseTime < fastestAvg + 500) {
        trait = "⚙️ Thoughtful";
        description = "Quality over speed";
      } else {
        trait = "🎮 Gamer";
        description = `${stats.correctCount} correct answers`;
      }

      traits[player.id] = {
        trait,
        description,
        rank,
        score: player.score,
        stats: {
          correct: stats.correctCount,
          total: stats.totalAnswered,
          accuracy: Math.round(accuracy * 100),
          avgResponseTime: Math.round(stats.avgResponseTime),
          maxStreak: stats.maxStreak
        }
      };
    });

    return {
      rankings: rankings.map(p => ({
        ...p,
        trait: traits[p.id].trait,
        description: traits[p.id].description,
        stats: traits[p.id].stats
      })),
      traits
    };
  }
};
