// ===============================
// script.js — FINAL CLEAN VERSION
// ===============================
console.log("script.js loaded");

// ---------- Helpers ----------
const $ = id => document.getElementById(id);

// ---------- Globals ----------
let gameRef = null;
let playerId = null;
let isHost = false;
let currentQuestion = 0;
let answers = {};
window.qaStarted = false;

/*************************************************
 * GAME STATE
 *************************************************/

let currentPhase = "waiting";
let currentQuestionIndex = 0;
let playerAnswers = [];

/*************************************************
 * QUESTIONS DATA (10 TOTAL REQUIRED)
 *************************************************/
// ---------- Questions ----------
const questions = [
  { 
    text: "If I were a sound effect, I'd be:", 
    options: ["Ka-ching!", "Dramatic gasp", "Boing!", "Evil laugh"] 
  },
  { 
    text: "If I were a weather forecast, I'd be:", 
    options: ["100% chill", "Chance of chaos", "Heatwave vibes", "Sudden drama"] 
  },
  { 
    text: "If I were a breakfast cereal, I'd be:", 
    options: ["Jungle Oats", "WeetBix", "Rice Krispies", "That weird healthy one"] 
  },
  { 
    text: "If I were a bedtime excuse, I'd be:", 
    options: ["I need water", "There's a spider in my room", "One more episode", "I'm not tired", "I can't sleep without Pillow"] 
  },
  { 
    text: "If I were a villain, I'd be:", 
    options: ["Grinch", "Thanos", "Mosquito", "Darth Vader"] 
  },
  { 
    text: "If I were a kitchen appliance:", 
    options: ["Judgy fridge", "Loud microwave", "Toaster of betrayal", "Blender of chaos"] 
  },
  { 
    text: "If I were a dance move:", 
    options: ["Awkward shuffle", "Kwasakwasa", "Invisible groove", "Knee regret"] 
  },
  { 
    text: "If I were a text message:", 
    options: ["Late LOL", "K.", "Gif spam", "Voice note typo"] 
  },
  { 
    text: "If I were a warning label:", 
   options: ["May sing", "May overshare", "Dangerous opinions", "Unfiltered thoughts"] 
  },
  { 
    text: "If I were a chair:", 
    options: ["Creaky antique", "Snack throne", "Finger trap", "Royal regret", "The one that makes a fart sound when you sit"] 
  }
];

/*************************************************
 * DOM ELEMENT CACHING (POINT #2)
 *************************************************/

const questionTextEl = document.getElementById("question-text");
const answersEl = document.getElementById("answer-options");
const submitBtn = document.getElementById("submit-answers-btn");

/*************************************************
 * HOST: BEGIN GAME → START Q&A PHASE
 *************************************************/

function beginGameAsHost() {
  // transition all players to Q&A phase
  startQnAPhase();
}

/*************************************************
 * AFTER QUESTION 10 (POINT #5)
 *************************************************/

async function handleAllQuestionsAnswered() {
  questionTextEl.textContent = "All questions answered 😈";
  answersEl.innerHTML = "";

  // Mark player ready in Firebase
  if (gameRef && playerId) {
    await gameRef.child(`players/${playerId}/ready`).set(true);
  }

  // Transition THIS player immediately
  transitionToPhase("waiting-to-guess");
}

/*************************************************
 * SUBMIT ANSWERS → WAITING ROOM 2
 *************************************************/

submitBtn.addEventListener("click", () => {
  submitBtn.style.display = "none";
  transitionToWaitingRoomTwo();
});

/*************************************************
 * WAITING ROOM 2
 *************************************************/

function transitionToWaitingRoomTwo() {
  currentPhase = "waiting-to-guess";

  // Example UI updates
  document.getElementById("waiting-room-title").textContent =
    "Waiting to Guess";

  document.getElementById("waiting-room-tagline").textContent =
    "Everyone’s pretending they’re not judging your answers 👀";

  // TODO: sync player readiness via Firebase / WebSocket
}
// ---------- DOM Ready ----------
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded ✅");

  $("createRoomBtn")?.addEventListener("click", createRoom);
  $("joinRoomBtn")?.addEventListener("click", joinRoom);

  $("begin-game-btn")?.addEventListener("click", () => {
    if (isHost && gameRef) {
      gameRef.child("phase").set("qa");
    }
  });

  $("begin-guessing-btn")?.addEventListener("click", () => {
    if (isHost && gameRef) {
      gameRef.child("phase").set("guessing");
    }
  });

  $("submit-answers-btn")?.addEventListener("click", async () => {
  if (!gameRef || !playerId) return;

  await gameRef.child(`players/${playerId}/ready`).set(true);
  $("submit-answers-btn").classList.add("hidden");
  });
});

// ---------- Page Switching ----------
function transitionToPhase(phase) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  const el = $(phase);
  if (el) el.classList.remove("hidden");
  updateBackgroundForPhase(phase);
}

function updateBackgroundForPhase(phase) {
  document.body.className = document.body.className
    .split(" ")
    .filter(c => !c.endsWith("-phase"))
    .join(" ");
  document.body.classList.add(`${phase}-phase`);
}

// ---------- Create Room ----------
async function createRoom() {
  const name = $("hostName").value.trim();
  const count = parseInt($("playerCount").value, 10);

  if (!name || count < 2) {
    alert("Enter name and at least 2 players");
    return;
  }

  const code = Math.random().toString(36).substring(2, 7).toUpperCase();
  playerId = name;
  isHost = true;

  gameRef = window.db.ref("rooms/" + code);
  await gameRef.set({
    host: name,
    numPlayers: count,
    phase: "waiting",
    players: {
      [name]: { ready: false, score: 0 }
    }
  });

  subscribeToGame(code);
  transitionToPhase("waiting");

  console.log("✅ Room created:", code);
}

// ---------- Join Room ----------
async function joinRoom() {
  const name = $("playerName").value.trim();
  const code = $("roomCode").value.trim().toUpperCase();

  if (!name || !code) return alert("Enter name & room code");

  playerId = name;
  isHost = false;

  gameRef = window.db.ref("rooms/" + code);
  const snap = await gameRef.once("value");
  if (!snap.exists()) return alert("Room not found");

  await gameRef.child("players/" + name).set({ ready: false, score: 0 });

  subscribeToGame(code);
  transitionToPhase("waiting");

  console.log("✅ Joined room:", code);
}

// ---------- Firebase Sync ----------
function subscribeToGame(code) {
  gameRef = window.db.ref("rooms/" + code);
  gameRef.off();

  gameRef.on("value", snap => {
    const data = snap.val();
    if (!data) return;
    updateRoomUI(data, code);
  });
}

// ---------- Update UI ----------
function updateRoomUI(data, code) {
  const players = data.players || {};
  const total = data.numPlayers || 0;
  const numPlayers = Object.keys(players).length;
  const phase = data.phase;
  const readyCount = Object.values(players)
  .filter(p => p.ready === true).length;

const waitingCount = total - readyCount;

if (phase === "waiting-to-guess") {
  const waitingTextEl = $("waiting-on-count");

  if (waitingCount > 0) {
    waitingTextEl.textContent =
      `Waiting on ${waitingCount} player${waitingCount > 1 ? "s" : ""}...`;
  } else {
    waitingTextEl.textContent = "Everyone is ready 👀";
  }
}

  $("room-code-display-game").textContent = code;
  $("players-count").textContent = `Players joined: ${numPlayers} / ${total}`;

  const list = $("players-list");
  list.innerHTML = Object.keys(players)
    .map(p => `<li>${p}${players[p].ready ? " ✅" : ""}</li>`)
    .join("");

  // Host-only Begin Game
  $("begin-game-btn").classList.toggle(
    "hidden",
    !(isHost && phase === "waiting" && numPlayers === total)
  );

  // Detect all ready after QA
  const allReady =
    numPlayers === total &&
    Object.values(players).every(p => p.ready === true);

  // If everyone is ready, allow host to start guessing
if (phase === "waiting-to-guess") {
  $("begin-guessing-btn").classList.toggle(
    "hidden",
    !(isHost && allReady)
  );
}

  transitionToPhase(phase);

  if (phase === "qa" && !window.qaStarted) startQA();
}

// ---------- Q&A ----------
function startQA() {
  window.qaStarted = true;
  currentQuestionIndex = 0;      // ✅ RESET INDEX
  playerAnswers = [];
  submitBtn.style.display = "none"; // ✅ HIDE SUBMIT BUTTON
  renderQuestion();
}

function renderQuestion() {
  const q = questions[currentQuestionIndex]; // ✅ FIXED NAME

  if (!q) {
    console.warn("No question found at index", currentQuestionIndex);
    return;
  }

  questionTextEl.textContent = q.text;
  answersEl.innerHTML = "";

  q.options.forEach(option => {
    const btn = document.createElement("button");
    btn.className = "answer-btn";
    btn.textContent = option;

    btn.addEventListener("click", () => {
      playerAnswers[currentQuestionIndex] = option;
      currentQuestionIndex++;

      if (currentQuestionIndex < questions.length) {
        renderQuestion();
      } else {
        handleAllQuestionsAnswered();
      }
    });

    answersEl.appendChild(btn);
  });
}

async function markReady() {
  await gameRef.child(`players/${playerId}/ready`).set(true);
  transitionToPhase("pre-guess");
}

// ---------- Copy Room Code ----------
document.addEventListener("click", e => {
  if (e.target.id === "room-code-display-game") {
    const code = e.target.textContent.trim();
    navigator.clipboard.writeText(code);
    e.target.textContent = "Copied!";
    setTimeout(() => (e.target.textContent = code), 1000);
  }
});

console.log("✅ Game script ready!");









