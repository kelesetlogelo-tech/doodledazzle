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

// ---------- Questions ----------
const questions = [
  { id: "q1", text: "If I were a sound effect, I'd be:", options: ["Ka-ching!", "Dramatic gasp", "Boing!", "Evil laugh"] },
  { id: "q2", text: "If I were a weather forecast, I'd be:", options: ["100% chill", "Chance of chaos", "Heatwave vibes", "Sudden drama"] },
  { id: "q3", text: "If I were a breakfast cereal, I'd be:", options: ["Jungle Oats", "WeetBix", "Rice Krispies", "That weird healthy one"] },
  { id: "q4", text: "If I were a bedtime excuse, I'd be:", options: ["I need water", "There's a spider", "One more episode", "I'm not tired"] },
  { id: "q5", text: "If I were a villain, I'd be:", options: ["Grinch", "Thanos", "Mosquito", "Darth Vader"] },
  { id: "q6", text: "If I were a kitchen appliance:", options: ["Judgy fridge", "Loud microwave", "Toaster of betrayal", "Blender of chaos"] },
  { id: "q7", text: "If I were a dance move:", options: ["Awkward shuffle", "Kwasakwasa", "Invisible groove", "Knee regret"] },
  { id: "q8", text: "If I were a text message:", options: ["Late LOL", "K.", "Gif spam", "Voice note typo"] },
  { id: "q9", text: "If I were a warning label:", options: ["May sing", "May overshare", "Dangerous opinions", "Unfiltered thoughts"] },
  { id: "q10", text: "If I were a chair:", options: ["Creaky antique", "Snack throne", "Finger trap", "Royal regret"] }
];

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

  if (phase === "qa" && allReady && isHost) {
    gameRef.child("phase").set("pre-guess");
  }

  // Host-only Begin Guessing
  $("begin-guessing-btn").classList.toggle(
    "hidden",
    !(isHost && phase === "pre-guess")
  );

  transitionToPhase(phase);

  if (phase === "qa" && !window.qaStarted) startQA();
}

// ---------- Q&A ----------
function startQA() {
  window.qaStarted = true;
  currentQuestion = 0;
  answers = {};
  renderQuestion();
}

function renderQuestion() {
  const container = $("qa-container");
  container.innerHTML = "";

  const q = questions[currentQuestion];
  if (!q) return markReady();

  container.innerHTML = `
    <h3>${q.text}</h3>
    ${q.options.map(o => `<button class="option-btn">${o}</button>`).join("")}
  `;

  container.querySelectorAll(".option-btn").forEach(btn => {
    btn.onclick = async () => {
      await gameRef
        .child(`players/${playerId}/answers/${q.id}`)
        .set(btn.textContent);
      currentQuestion++;
      renderQuestion();
    };
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
