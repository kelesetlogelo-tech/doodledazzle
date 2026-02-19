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
let introTimerStarted = false;
let guessingQuestionIndex = 0;
let currentGuessTarget = null;
let isSubmittingGuess = false;
let lastRenderedGuessKey = null; // prevents duplicate tiles
let lastTargetAdvanced = null;      // host-only guard
let lastGuessDoneMarked = null;     // per player guard


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
  if (!isHost || !gameRef) return;
  gameRef.child("phase").set("guessing-intro");
});

  $("next-target-btn")?.addEventListener("click", async () => {
  if (!isHost || !gameRef) return;

  // move to next target
  await gameRef.child("currentTargetIndex").transaction(i => (i || 0) + 1);

  // optional: clear per-target done so the UI doesn't think everyone is still done
  // (safe to keep if your doneMap is nested by target)
});


  $("submit-answers-btn")?.addEventListener("click", async () => {
  if (!gameRef || !playerId) return;

  await gameRef.child(`players/${playerId}/ready`).set(true);
  $("submit-answers-btn").classList.add("hidden");
  });
  
$("reveal-results-btn")?.addEventListener("click", async () => {
  if (!isHost || !gameRef) return;

  // Get the latest room snapshot so scoring is accurate
  const snap = await gameRef.once("value");
  const data = snap.val();
  if (!data) return;

  const scores = calculateScores(data);

  // Save scores to Firebase + move everyone to results phase
  await gameRef.update({
    scores,
    phase: "results"
  });
});

});  

// ---------- Page Switching ----------
function transitionToPhase(phaseId) {
  const allSections = Array.from(document.querySelectorAll("section.page"));

  //Hide everything
  allSections.forEach(s => {
      s.classList.add("hidden");
      s.classList.remove("is-active");
    });
  
  // 2) Turn ON the requested page
  const target = document.getElementById(phaseId);
  if (!target) {
    console.error("❌ Missing section id:", phaseId);
    return;
  }

    target.classList.remove("hidden");
    // Force reflow so fade-in always triggers
    void target.offsetWidth;
    target.classList.add("is-active");
    
    updateBackgroundForPhase(phaseId);
}

function updateBackgroundForPhase(phaseId) {
  document.body.className = document.body.className
    .split(" ")
    .filter(c => !c.endsWith("-phase"))
    .join(" ");
  document.body.classList.add(`${phaseId}-phase`);
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
  const allReady = numPlayers === total && readyCount === total;

  // ------------------------
  // GUESSING INTRO (MUST BE FIRST)
  // ------------------------
  if (phase === "guessing-intro") {
    console.log("🎬 Showing guessing intro");

    transitionToPhase("guessing-intro"); // hides all other pages

    if (isHost && !window._guessIntroTimerStarted) {
      window._guessIntroTimerStarted = true;

      setTimeout(() => {
        gameRef.child("phase").set("guessing");
        window._guessIntroTimerStarted = false;
      }, 10000);
    }

    return;
  }

  // ------------------------
  // WAITING TO GUESS
  // ------------------------
  if (phase === "waiting-to-guess") {
    transitionToPhase("waiting-to-guess");

    $("room-code-display-game").textContent = code;

    $("players-list").innerHTML = Object.keys(players)
      .map(p => `<li>${p}${players[p].ready ? " ✅" : ""}</li>`)
      .join("");

    // ✅ host should ONLY see button when everyone is ready
    $("begin-guessing-btn").classList.toggle(
      "hidden",
      !(isHost && allReady)
    );

    return;
  }

  // ------------------------
  // QA
  // ------------------------
  if (phase === "qa") {
    transitionToPhase("qa");

    console.log("QA check → ready:", readyCount, "/", total);

    if (allReady && isHost) {
      console.log("All players done. Moving to waiting-to-guess.");
      gameRef.child("phase").set("waiting-to-guess");
      return;
    }

    if (!window.qaStarted) startQA();
    return;
  }

  // ------------------------
  // WAITING (LOBBY)
  // ------------------------
  if (phase === "waiting") {
    transitionToPhase("waiting");

    $("room-code-display-game").textContent = code;

    const playersNeeded = total - numPlayers;
    $("players-count").textContent =
      playersNeeded > 0
        ? `Waiting on ${playersNeeded} player${playersNeeded > 1 ? "s" : ""}...`
        : `All ${total} players joined ✅`;

    $("players-list").innerHTML = Object.keys(players)
      .map(p => `<li>${p}</li>`)
      .join("");

    $("begin-game-btn").classList.toggle(
      "hidden",
      !(isHost && numPlayers === total)
    );

    return;
  }

 // ------------------------
// GUESSING
// ------------------------
if (phase === "guessing") {
  transitionToPhase("guessing");

  // Host sets up target order once
  if (isHost && !data.targetOrder) {
    const sortedPlayers = Object.keys(players).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    gameRef.update({
      targetOrder: sortedPlayers,
      currentTargetIndex: 0
    });

    return;
  }

  const targetOrder = data.targetOrder;
  const currentIndex = data.currentTargetIndex;

  if (!targetOrder || currentIndex === undefined) return;

  // Finished all targets
  if (currentIndex >= targetOrder.length) {
    gameRef.child("phase").set("results");
    return;
  }

  const targetPlayer = targetOrder[currentIndex];

 // Host-only Reveal Results button when LAST target round is finished
const revealBtn = $("reveal-results-btn");
const nextBtn = $("next-target-btn");

if (revealBtn) revealBtn.classList.add("hidden"); // default hidden

// Determine if everyone except target is done for THIS round
const doneMap = data.guessDone?.[targetPlayer] || {};
const allNonTargetDone = Object.keys(players)
  .filter(name => name !== targetPlayer)
  .every(name => doneMap[name] === true);

const isLastTarget = (currentIndex === (targetOrder.length - 1));

if (isHost) {
  // If last target is finished → show Reveal button, hide Next
  if (isLastTarget && allNonTargetDone) {
    if (revealBtn) revealBtn.classList.remove("hidden");
    if (nextBtn) nextBtn.classList.add("hidden");
  } else {
    // otherwise show Next (your existing logic)
    if (nextBtn) nextBtn.classList.remove("hidden");
  }
} else {
  // non-hosts never see these buttons
  if (revealBtn) revealBtn.classList.add("hidden");
  if (nextBtn) nextBtn.classList.add("hidden");
}

  // Render the guessing UI for this round
  renderGuessingRound(targetPlayer, data, players);

  return;
}

    // ------------------------
  // RESULTS
  // ------------------------
  if (phase === "results") {
    transitionToPhase("results");

    const scores = data.scores || calculateScores(data);
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const winnerName = sorted[0]?.[0];

    const listEl = $("scoreboard-list");
    if (listEl) {
      listEl.innerHTML = sorted.map(([name, score], idx) => {
        const isWinner = name === winnerName;

        return `
          <li class="${isWinner ? "winner-row" : ""}">
            <span class="name">
              ${idx + 1}. ${name}
              ${isWinner ? `<span class="fireworks" aria-hidden="true">🎆</span>` : ""}
            </span>
            <span class="score">${score}</span>
          </li>
        `;
      }).join("");
    }

    return;
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

    btn.addEventListener("click", async () => {
  // save locally
  playerAnswers[currentQuestionIndex] = option;

  // ✅ save to Firebase so guessing/results can score it
  if (gameRef && playerId) {
    await gameRef.child(`players/${playerId}/answers/${String(currentQuestionIndex)}`).set(option);
  }

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

// ------------------------
// GUESSING ROUND ENGINE
// ------------------------
function renderGuessingRound(targetPlayer, data, players) {
  const titleEl = $("guess-target-name");
  const taglineEl = $("guess-tagline");
  const cardEl = $("guess-card");

  if (!titleEl || !taglineEl || !cardEl) {
    console.error("🚨 Missing guessing phase elements (guess-target-name / guess-tagline / guess-card)");
    return;
  }

  // Reset local index if target changed
  if (currentGuessTarget !== targetPlayer) {
    currentGuessTarget = targetPlayer;
    guessingQuestionIndex = 0;
    isSubmittingGuess = false;
    lastRenderedGuessKey = null; // ✅ reset
  }

  titleEl.textContent = `TARGET: ${targetPlayer}`;

  // Target player should NOT guess their own answers
  if (playerId === targetPlayer) {
    const totalPlayers = Object.keys(players).length;
    const doneCount = countGuessDone(data, targetPlayer);
    taglineEl.textContent = `Sit tight 😌 Everyone else is exposing themselves… (${doneCount}/${totalPlayers - 1} finished)`;
    cardEl.innerHTML = `<div style="margin-top:2rem;font-weight:700;">You can’t guess your own vibe 😭</div>`;
    return;
  }

  taglineEl.textContent = `Pick what you think ${targetPlayer} answered 👀`;

  // Find the next unanswered question index for THIS guesser + THIS target
  const nextIndex = findNextUnansweredIndex(data, targetPlayer, playerId);

  // If finished all 10 guesses, mark done + show waiting text
  if (nextIndex >= questions.length) {
    cardEl.innerHTML = `<div style="margin-top:2rem;font-weight:800;">Done ✅ Waiting for others…</div>`;
    markGuessDone(targetPlayer);
    // Host may advance to next target when everyone is done
    maybeAdvanceTargetIfHost(data, players, targetPlayer);
    return;
  }

  // Render 1 card
  renderGuessCard(cardEl, titleEl, taglineEl, targetPlayer, nextIndex, data, players);
}

function renderGuessCard(cardEl, titleEl, taglineEl, targetPlayer, qIndex, data, players) {
  // ✅ Prevent duplicate rendering of the same tile
  const key = `${targetPlayer}|${playerId}|${qIndex}`;
  if (lastRenderedGuessKey === key) return;
  lastRenderedGuessKey = key;

  const q = questions[qIndex];
  if (!q) return;

  // Basic slide-in animation class (CSS optional, but recommended)
  cardEl.innerHTML = `
    <div class="guess-tile slide-in">
      <div class="guess-q">${q.text}</div>
      <div class="guess-options">
        ${q.options.map(opt => `<button class="guess-opt-btn" data-opt="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join("")}
      </div>
      <div class="guess-progress">Question ${qIndex + 1} / ${questions.length}</div>
    </div>
  `;

  const tile = cardEl.querySelector(".guess-tile");
  cardEl.querySelectorAll(".guess-opt-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (isSubmittingGuess) return;
      isSubmittingGuess = true;

      const chosen = btn.getAttribute("data-opt");

      try {
        await saveGuess(targetPlayer, qIndex, chosen);

        // slide out then render next
        if (tile) tile.classList.add("slide-out");

  setTimeout(() => {
          isSubmittingGuess = false;

      // ✅ Move to the next question locally
         const nextIndex = qIndex + 1;
         if (nextIndex >= questions.length) {
           cardEl.innerHTML = `<div style="margin-top:2rem;font-weight:800;">Done ✅ Waiting for others…</div>`;
           markGuessDone(targetPlayer);
           maybeAdvanceTargetIfHost(data, players, targetPlayer);
           return;
  }

  renderGuessCard(cardEl, titleEl, taglineEl, targetPlayer, nextIndex, data, players);
}, 280);

      } catch (err) {
        console.error("Failed to save guess:", err);
        isSubmittingGuess = false;
      }
    });
  });
}

async function saveGuess(targetPlayer, questionIndex, answerText) {
  if (!gameRef || !playerId) return;

  // Save guess: rooms/{code}/guesses/{target}/{guesser}/{qIndex} = answerText
  await gameRef.child(`guesses/${targetPlayer}/${playerId}/${String(questionIndex)}`).set(answerText);
}

function findNextUnansweredIndex(data, targetPlayer, guesserId) {
  const guessesForTarget = data.guesses?.[targetPlayer]?.[guesserId] || {};
  for (let i = 0; i < questions.length; i++) {
    const a = guessesForTarget[i];
    const b = guessesForTarget[String(i)];
    if (a === undefined && b === undefined) return i;
  }
  return questions.length;
}

async function markGuessDone(targetPlayer) {
  if (!gameRef || !playerId) return;
    // ✅ prevent re-writing "done" repeatedly for same target
  const key = `${targetPlayer}|${playerId}`;
  if (lastGuessDoneMarked === key) return;
  lastGuessDoneMarked = key;
  
  await gameRef.child(`guessDone/${targetPlayer}/${playerId}`).set(true);
}

function countGuessDone(data, targetPlayer) {
  const doneMap = data.guessDone?.[targetPlayer] || {};
  // counts how many players (excluding target) marked done
  return Object.values(doneMap).filter(v => v === true).length;
}

function maybeAdvanceTargetIfHost(data, players, targetPlayer) {
  if (!isHost || !gameRef) return;

  const doneMap = data.guessDone?.[targetPlayer] || {};
  const playerNames = Object.keys(players);

  const allNonTargetDone = playerNames
    .filter(name => name !== targetPlayer)
    .every(name => doneMap[name] === true);

  if (!allNonTargetDone) return;

  // ✅ prevent advancing twice for the same target
  if (lastTargetAdvanced === targetPlayer) return;
  lastTargetAdvanced = targetPlayer;

  // advance to next target
  gameRef.child("currentTargetIndex").transaction(i => (i || 0) + 1);
}

// Tiny helper for safe HTML in templates
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

  function calculateScores(data) {
  const players = data.players || {};
  const playerNames = Object.keys(players);

  // init scores
  const scores = {};
  playerNames.forEach(name => (scores[name] = 0));

  const targetOrder = data.targetOrder || playerNames.slice().sort();

  for (const target of targetOrder) {
    const targetAnswers = players[target]?.answers || {};

    for (const guesser of playerNames) {
      if (guesser === target) continue; // target doesn’t guess own answers

      for (let i = 0; i < questions.length; i++) {
        const actual =
          targetAnswers[i] ?? targetAnswers[String(i)];

        const guess =
          data.guesses?.[target]?.[guesser]?.[i] ??
          data.guesses?.[target]?.[guesser]?.[String(i)];

        // Only score if both exist
        if (actual === undefined || guess === undefined) continue;

        if (guess === actual) scores[guesser] += 1;
        else scores[guesser] -= 1;
      }
    }
  }

  return scores;
 }
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

