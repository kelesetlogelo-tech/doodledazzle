// ================================
// script.js — CLEAN & STABLE
// ================================
console.log("script.js loaded");

const $ = id => document.getElementById(id);

// ---------- GLOBAL STATE ----------
let gameRef = null;
let playerId = null;
let isHost = false;
let qaStarted = false;

// ---------- QUESTIONS ----------
const questions = [
  { id: "q1", text: "If I were a sound effect, I'd be:", options: ["Ka-ching!", "Dramatic gasp", "Boing!", "Evil laugh"] },
  { id: "q2", text: "If I were a weather forecast, I'd be:", options: ["100% chill", "Partly dramatic", "Heatwave vibes", "Chaos incoming"] },
  { id: 'q3', text: "If I were a breakfast cereal, I'd be:", options: ['Jungle Oats', 'WeetBix', 'Rice Krispies', 'MorVite', 'That weird healthy one no-one eats'] },
  { id: 'q4', text: "If I were a bedtime excuse, I'd be...", options: ['I need water','There\'s a spider in my room','I can\'t sleep without "Pillow"','There see shadows outside my window','Just one more episode'] },
  { id: 'q5', text: "If I were a villain in a movie, I'd be...", options: ['Scarlet Overkill','Grinch','Thanos','A mosquito in your room at night','Darth Vader'] }, 
  { id: 'q6', text: "If I were a kitchen appliance, I'd be...", options: ['A blender on high speed with no lid','A toaster that only pops when no one’s looking','Microwave that screams when it’s done','A fridge that judges your snack choices'] },
  { id: 'q7', text: "If I were a dance move, I'd be...", options: ['The awkward shuffle at weddings','Kwasakwasa, Ba-baah!','The “I thought no one was watching” move','The knee-pop followed by a regretful sit-down'] },
  { id: 'q8', text: "If I were a text message, I'd be...", options: ['A typo-ridden voice-to-text disaster','A three-hour late “LOL”','A group chat gif spammer','A mysterious “K.” with no context'] },
  { id: 'q9', text: "If I were a warning label, I'd be...", options: ['Caution: May spontaneously break into song','Contents may cause uncontrollable giggles','Qaphela: Gevaar/Ingozi','Warning: Will talk your ear off about random facts','May contain traces of impulsive decisions'] },
  { id: 'q10', text: "If I were a type of chair, I’d be…", options: ['A Phala Phala sofa','A creaky antique that screams when you sit','One of those folding chairs that attack your fingers','A throne made of regrets and snack crumbs'] } 
];

// ---------- PHASE HANDLING ----------
function transitionToPhase(phase) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  const page = document.getElementById(phase);
  if (page) page.classList.remove("hidden");

  document.body.className = document.body.className
    .split(" ")
    .filter(c => !c.endsWith("-phase"))
    .join(" ");

  document.body.classList.add(`${phase}-phase`);
}

// ---------- ROOM HEADER UI ----------
function renderRoomHeader(code, joined, total) {
  const roomCodeEl = $("room-code-display-game");
  const countEl = $("players-count");

  if (roomCodeEl) {
    roomCodeEl.innerHTML = `
      <div class="room-code-pill" title="Click to copy">
        ${code}
      </div>
      <div class="copy-hint">Tap to copy room code</div>
    `;

    roomCodeEl.onclick = async () => {
      try {
        await navigator.clipboard.writeText(code);
        roomCodeEl.querySelector(".copy-hint").textContent = "Copied!";
      } catch {
        alert("Copy failed. Select and copy manually.");
      }
    };
  }

  if (countEl) {
    countEl.textContent = `Players joined: ${joined} / ${total}`;
  }
}

// ---------- DOM READY ----------
document.addEventListener("DOMContentLoaded", () => {
  $("createRoomBtn")?.addEventListener("click", createRoom);
  $("joinRoomBtn")?.addEventListener("click", joinRoom);
  $("begin-game-btn")?.addEventListener("click", () => {
  if (!isHost || !gameRef) return;
  gameRef.child("phase").set("qa");
});

// ---------- CREATE ROOM ----------
async function createRoom() {
  const name = $("hostName")?.value.trim();
  const count = parseInt($("playerCount")?.value, 10);

  if (!name || count < 2) {
    alert("Enter your name and at least 2 players.");
    return;
  }

  const code = Math.random().toString(36).substring(2, 7).toUpperCase();
  playerId = name;
  isHost = true;

  gameRef = window.db.ref(`rooms/${code}`);

  await gameRef.set({
    host: name,
    numPlayers: count,
    phase: "waiting",
    players: {
      [name]: { score: 0, ready: false }
    }
  });

  transitionToPhase("waiting");
  renderRoomHeader(code, 1, count);
  subscribeToGame(code);

  console.log("Room created:", code);
}

// ---------- JOIN ROOM ----------
async function joinRoom() {
  const name = $("playerName")?.value.trim();
  const code = $("roomCode")?.value.trim().toUpperCase();

  if (!name || !code) {
    alert("Enter name and room code");
    return;
  }

  playerId = name;
  isHost = false;

  gameRef = window.db.ref(`rooms/${code}`);
  const snap = await gameRef.once("value");

  if (!snap.exists()) {
    alert("Room not found");
    return;
  }

  await gameRef.child(`players/${name}`).set({ score: 0, ready: false });

  transitionToPhase("waiting");
  subscribeToGame(code);
}

// ---------- FIREBASE LISTENER ----------
function subscribeToGame(code) {
  gameRef.off();

  gameRef.on("value", snap => {
    const data = snap.val();
    if (!data) return;

    const players = data.players || {};
    renderRoomHeader(code, Object.keys(players).length, data.numPlayers);
    updateBeginButton(players, data.numPlayers);
    updatePlayerList(players);
    transitionToPhase(data.phase);
  });
}

// ---------- PLAYER LIST ----------
function updatePlayerList(players) {
  const list = $("players-list");
  if (!list) return;

  list.innerHTML = Object.keys(players)
    .map(p => `<li>${p}</li>`)
    .join("");
}

function updateBeginButton(players, totalPlayers) {
  const btn = $("begin-game-btn");
  if (!btn) return;

  // Only host ever sees this button
  if (!isHost) {
    btn.classList.add("hidden");
    return;
  }

  const joinedCount = Object.keys(players).length;

  if (joinedCount === totalPlayers) {
    btn.classList.remove("hidden");
    btn.disabled = false;
    btn.textContent = "Begin Game";
  } else {
    btn.classList.remove("hidden");
    btn.disabled = true;
    btn.textContent = `Waiting for players (${joinedCount}/${totalPlayers})`;
  }
}

console.log("✅ Game script ready");
