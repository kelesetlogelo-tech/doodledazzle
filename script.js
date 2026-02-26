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
let isSubmittingQA = false;
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
    text: "If I were a sound effect, I'd be....", 
    options: ["The final whistle at the soccer world cup!", "Dramatic gasp", "The sound of someone dropping a tray of silverware in a silent room", "Evil laugh", "A VW Golf GTI from 'Pimp My Ride'", "The 'Law & Order' Dun-Dun... Usually occuring right after I make a questionable life choice"] 
  },
  { 
    text: "If I were a weather forecast, I'd be....", 
    options: ["100% chill", "Partly cloudy with a chance of chaos", "A light breeze that somehow ruins everyone's hair", "90% chance of showers, followed by a sudden unexplainable heatwave", "Sudden torando of opinions" , "A localized hurricane specifically targeting people who talk during movies", "Scorching heat with a 100% chance of being being 'too much' for you"] 
  },
  { 
    text: "If I were a breakfast cereal, I'd be....", 
    options: ["Honey Nut 'Mind Your Business'", "The generic brand in the giant bag:unpretentiuos and surprisingly sweet!", "Rice Krispies", "That weird healthy one no-one eats"] 
  },
  { 
    text: "If I were a bedtime excuse, I'd be....", 
    options: ["I need water", "My closet has eyes", "I can't go to sleep yet; someone is wrong on the internet and they need to know it", "There's a spider in my room", "One more episode", "I can't sleep; I have to remember a cringey thing I did in 1999", "Just one more scroll.... okay, maybe fifty"] 
  },
  { 
    text: "If I were a villain, I'd be....", 
    options: ["The one who steals the hero's chargers and leaves them with 2% battery", "The villain who just wants everyone to be quiet so she can nap", "A mosquito in your room at night", "The one who reveals their entire plan because they finally have someone to talk to"] 
  },
  {
    text: "If I were a kitchen appliance, I'd be....", 
    options: ["A fridge that judges your snack choices", " An espresso machine that refuses to work if you use the wrong beans", "An air-fryer: loud, high-maintenance, but currently everyone's favourite", "A microwave that screams when it's done", "That fancy zester you bought three years ago and have used exactly once", "A toaster that only pops when no-one's looking ", "A blender on high speed with no lid"] 
  },
  { 
    text: "If I were a TikTok dance challenge, I'd be....", 
    options: ["The one where everyone looks like they're trying to swat a wasp", "That Zep dance that is not make sure", "Too fast for you to learn, but easy for me to judge", "The 'I didn't realise I was being recorded", "Trending for six hours befre being replaced by a talking dog" , "Mostly just standing there while the text bubbles do the work"] 
  },
  { 
    text: "If I were a text message, I'd be....", 
    options: ["A 3-hour late 'LOL'", "A mysterious 'K.' with no context", "A group chat gif spammer", "A typo-ridden voice to text disaster", "We need to talk (about what we're having for dinner)", "A 'read' receipt with no follow-up for three business days", "The 'Typing....' bubbles that last for twenty minutes and then disappear forever"] 
  },
  { 
    text: "If I were a warning label,I'd be....", 
   options: ["Caution: May spontaneously break into song", "Warning: Will talk your ear off about random facts", "Dangerous opinions", "Fragile: Do not shake or provide constructive criticism", "Contents under pressure. Keep away from direct sunlight and early morning meetings", "For external use only. Do not engage without caffeine", "May contain traces of impulsive decisions", "Do not approach without a compliment and a good cup of coffee"] 
  },
  { 
    text: "If I were a chair, I'd be....", 
    options: ["A creaky antique that screams when you sit", "A throne made of regrets and snack crumbs", "One of those folding chairs that attack your fingers", "That sofa at Phala Phala", "The one that makes a fart sound when you sit" , "A throne. Next question...", "A beanbag: impossible to get out of once you've committed" , "An electric chair", "The swivel chair with one squeaky wheel that follows you everywhere", "A Victorian armchair: looks sophisticated, but incredibly uncomforatble for long periods"] 
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
  transitionToPhase("waiting-to-guess");
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

  const countdownEl = $("guess-intro-countdown");
  let secondsLeft = 10;

  // Show starting number immediately
  if (countdownEl) countdownEl.textContent = secondsLeft;

  // Only host starts the timer (everyone else just displays it)
  if (isHost && !window._guessIntroTimerStarted) {
    window._guessIntroTimerStarted = true;

    // Clear any old interval if it exists
    if (window._guessIntroInterval) clearInterval(window._guessIntroInterval);

    window._guessIntroInterval = setInterval(() => {
      secondsLeft--;

      if (countdownEl) countdownEl.textContent = secondsLeft;

      if (secondsLeft <= 0) {
        clearInterval(window._guessIntroInterval);
        window._guessIntroInterval = null;
      }
    }, 1000);

    setTimeout(() => {
      // move everyone into guessing
      gameRef.child("phase").set("guessing");

      // reset guard for next time
      window._guessIntroTimerStarted = false;

      // safety cleanup
      if (window._guessIntroInterval) {
        clearInterval(window._guessIntroInterval);
        window._guessIntroInterval = null;
      }
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

// --- Host-only Next Target button: ONLY when everyone (except target) is done ---
const nextBtn = $("next-target-btn");
const revealBtn = $("reveal-results-btn");

// default: hide both
if (nextBtn) nextBtn.classList.add("hidden");
if (revealBtn) revealBtn.classList.add("hidden");

// done map for THIS target
const doneMap = data.guessDone?.[targetPlayer] || {};

// everyone except target must be done
const allNonTargetDone = Object.keys(players)
  .filter(name => name !== targetPlayer)
  .every(name => doneMap[name] === true);

const isLastTarget = (currentIndex === targetOrder.length - 1);

if (isHost) {
  if (allNonTargetDone) {
    // If last target finished -> show Reveal Results
    if (isLastTarget) {
      if (revealBtn) revealBtn.classList.remove("hidden");
      if (nextBtn) nextBtn.classList.add("hidden");
    } else {
      // Otherwise show Next Target
      if (nextBtn) nextBtn.classList.remove("hidden");
      if (revealBtn) revealBtn.classList.add("hidden");
    }
  } else {
    // Not everyone done yet -> keep hidden
    if (nextBtn) nextBtn.classList.add("hidden");
    if (revealBtn) revealBtn.classList.add("hidden");
  }
} else {
  // Non-host never sees these buttons
  if (nextBtn) nextBtn.classList.add("hidden");
  if (revealBtn) revealBtn.classList.add("hidden");
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
  renderScoreboard(scores);

  // Optional: host saves computed scores once (so everyone sees same ranking)
  if (isHost && !data.scores) {
    gameRef.child("scores").set(scores);
  }

  return;
}

// ---------- Q&A ----------
function startQA() {
  window.qaStarted = true;
  currentQuestionIndex = 0;      // ✅ RESET INDEX
  playerAnswers = [];
  isSubmittingQA = false;
  
  if (submitBtn) submitBtn.style.display = "none"; // ✅ HIDE SUBMIT BUTTON
  renderQuestion();
}

function renderQuestion() {
  const q = questions[currentQuestionIndex];

  // If no more questions, finish Q&A
  if (!q) {
    console.log("✅ Q&A complete for", playerId);
    handleAllQuestionsAnswered();
    return;
  }

  // Make sure submit is hidden until end (you said submit only after Q10)
  if (submitBtn) submitBtn.style.display = "none";

  // Reset click guard
  isSubmittingQA = false;

  // Build ONE tile
  const tileHTML = `
    <div class="qa-tile slide-in" id="qa-tile">
      <div class="guess-progress">Question ${currentQuestionIndex + 1} / ${questions.length}</div>
      <div class="guess-q" style="margin-top:10px; font-weight:800; color:#000;">
        ${escapeHtml(q.text)}
      </div>

      <div class="guess-options" style="margin-top:14px;">
        ${q.options
          .map(opt => `
            <button class="guess-opt-btn" data-opt="${escapeHtml(opt)}">
              ${escapeHtml(opt)}
            </button>
          `)
          .join("")}
      </div>
    </div>
  `;

  // Inject into your existing Q&A container
  // (Your HTML already has #question-text and #answer-options, but we’ll render inside #answer-options as the tile holder)
  if (!answersEl) {
    console.error("🚨 Missing #answer-options element in HTML");
    return;
  }

  // Keep questionTextEl for banner layout if you want, but we’re rendering the question inside tile now.
  if (questionTextEl) questionTextEl.textContent = ""; 

  answersEl.innerHTML = tileHTML;

  const tile = document.getElementById("qa-tile");
  const optionButtons = answersEl.querySelectorAll(".guess-opt-btn");

  optionButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      if (isSubmittingQA) return;
      isSubmittingQA = true;

      const chosen = btn.getAttribute("data-opt");

      try {
        // Save locally
        playerAnswers[currentQuestionIndex] = chosen;

        // Save to Firebase (IMPORTANT for guessing + results)
        if (gameRef && playerId) {
          await gameRef
            .child(`players/${playerId}/answers/${String(currentQuestionIndex)}`)
            .set(chosen);
        }

        // Slide out the tile
        if (tile) tile.classList.add("slide-out");

        // After slide-out, move to next question and slide in next tile
        setTimeout(() => {
          currentQuestionIndex++;
          renderQuestion();
        }, 240);

      } catch (err) {
        console.error("❌ Failed saving QA answer:", err);
        isSubmittingQA = false;
      }
    });
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
  
  function renderScoreboard(scores) {
  const listEl = $("scoreboard-list");
  if (!listEl) {
    console.error("🚨 Missing #scoreboard-list in Results HTML");
    return;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const winnerName = sorted[0]?.[0];

  listEl.innerHTML = sorted.map(([name, score], idx) => {
    const isWinner = name === winnerName;
    return `
      <li class="${isWinner ? "winner" : ""}">
        <span class="name">${idx + 1}. ${name}</span>
        <span class="score">${score}</span>
      </li>
    `;
  }).join("");
}

  function calculateScores(data) {
  const players = data.players || {};
  const playerNames = Object.keys(players);

  const scores = {};
  playerNames.forEach(n => (scores[n] = 0));

  const targetOrder = data.targetOrder || playerNames.slice().sort((a,b)=>a.localeCompare(b));

  for (const target of targetOrder) {
    const targetAnswers = players[target]?.answers || {};

    for (const guesser of playerNames) {
      if (guesser === target) continue;

      for (let i = 0; i < questions.length; i++) {
        const actual = targetAnswers[i] ?? targetAnswers[String(i)];
        const guess =
          data.guesses?.[target]?.[guesser]?.[i] ??
          data.guesses?.[target]?.[guesser]?.[String(i)];

        if (actual === undefined || guess === undefined) continue;

        if (guess === actual) scores[guesser] += 1;
        // else +0 (do nothing)
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














