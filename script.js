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
let roomCode = null;
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
      gameRef.child("phase").set("guessing-intro");
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

  roomCode = code;
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

  roomCode = code;
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

//UPDATE ROOM UI
function updateRoomUI(data, code) {

  const players = data.players || {};
  const total = data.numPlayers || 0;
  const numPlayers = Object.keys(players).length;
  const phase = data.phase;
  const readyCount = Object.values(players).filter(p => p.ready).length;
  const allReady = numPlayers === total && Object.values(players).every(p => p.ready);

  // ------------------------
  // WAITING
  // ------------------------
  if (phase === "waiting") {

    transitionToPhase("waiting");

    $("room-code-display-game").textContent = code;
  

    $("players-list").innerHTML = Object.keys(players)
      .map(p => `<li>${p}${players[p].ready ? " ✅" : ""}</li>`)
      .join("");

    $("begin-game-btn").classList.toggle(
      "hidden",
      !(isHost && numPlayers === total)
    );

    return;
  }

  // ------------------------
  // QA
  // ------------------------
  if (phase === "qa") {

    transitionToPhase("qa");

   if (allReady && isHost) {

  const updates = { phase: "waiting-to-guess" };

  Object.keys(players).forEach(p => {
    updates[`players/${p}/ready`] = false;
  });

  gameRef.update(updates);
  return;
}

    if (!window.qaStarted) startQA();
    return;
  }

  // ------------------------
  // WAITING TO GUESS
  // ------------------------
  // ------------------------
// WAITING (Lobby)
// ------------------------
if (phase === "waiting") {

  transitionToPhase("waiting");

  // Update room code
  $("room-code-display-game").textContent = code;

  // Update player count correctly
  const playersNeeded = total - numPlayers;

  if (playersNeeded > 0) {
    $("players-count").textContent =
      `Waiting on ${playersNeeded} player${playersNeeded > 1 ? "s" : ""}...`;
  } else {
    $("players-count").textContent =
      `All ${total} players joined ✅`;
  }

  // Update player list
  $("players-list").innerHTML = Object.keys(players)
    .map(p => `<li>${p}</li>`)
    .join("");

  // Show Begin Game only when full
  $("begin-game-btn").classList.toggle(
    "hidden",
    !(isHost && numPlayers === total)
  );

  return;
}

  // ------------------------
  // GUESSING INTRO
  // ------------------------
  if (phase === "guessing-intro") {

    transitionToPhase("guessing-intro");

    if (isHost) {
      setTimeout(() => {
        gameRef.child("phase").set("guessing");
      }, 7000);
    }

    return;
  }

  // ------------------------
  // GUESSING
  // ------------------------
  if (phase === "guessing") {

    transitionToPhase("guessing");

    if (isHost && !data.targetOrder) {

      const sortedPlayers = Object.keys(players).sort();

      gameRef.update({
        targetOrder: sortedPlayers,
        currentTargetIndex: 0
      });

      return;
    }

    const targetOrder = data.targetOrder;
    const currentIndex = data.currentTargetIndex;

    if (!targetOrder || currentIndex === undefined) return;

    if (currentIndex >= targetOrder.length) {
      gameRef.child("phase").set("results");
      return;
    }

    const targetPlayer = targetOrder[currentIndex];
    renderGuessingUI(targetPlayer, data);

    return;
  }

}

  // --- Update room code and player count ---
  $("room-code-display-game").textContent = roomCode;

  // --- Host-only Begin Game button ---
  $("begin-game-btn").classList.toggle(
    "hidden",
    !(isHost && phase === "waiting" && numPlayers === total)
  );

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
  
  transitionToPhase("qa");
 }

function renderGuessingUI(targetPlayer, data) {

  console.log("Rendering UI for:", targetPlayer);

  const titleEl = document.getElementById("guess-target-name");
  const container = document.getElementById("guess-container");

  console.log("Title element:", titleEl);
  console.log("Container element:", container);

  if (!titleEl || !container) {
    console.error("🚨 Guessing HTML elements missing!");
    return;
  }

  titleEl.textContent = "TARGET: " + targetPlayer;
  container.innerHTML = "<h3>Guessing phase is rendering correctly 🎉</h3>";
}

function renderGuessCards(targetPlayer, data) {

  const container = $("guess-container");
  container.innerHTML = "";

  questions.forEach((q, index) => {

    const card = document.createElement("div");
    card.className = "guess-card";

    const question = document.createElement("h3");
    question.textContent = q.text;

    card.appendChild(question);

    q.options.forEach(option => {
      const btn = document.createElement("button");
      btn.textContent = option;

      btn.addEventListener("click", () => {
        saveGuess(targetPlayer, index, option);
      });

      card.appendChild(btn);
    });

    container.appendChild(card);
  });
}

function saveGuess(targetPlayer, questionIndex, answer) {

  gameRef
    .child(`guesses/${targetPlayer}/${playerId}/${questionIndex}`)
    .set(answer);

  checkIfAllGuessesComplete(targetPlayer);
}

function checkIfAllGuessesComplete(targetPlayer) {

  gameRef.child("guesses/" + targetPlayer).once("value", snap => {

    const guesses = snap.val() || {};
    const guessers = Object.keys(guesses);

    const totalPlayers = Object.keys(players).length;

    if (guessers.length === totalPlayers - 1) {

      if (isHost) {
        gameRef.child("currentTargetIndex").transaction(i => i + 1);
      }
    }
  });
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


















