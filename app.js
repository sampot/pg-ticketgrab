import { gameInstance, COLORS } from "./game.js";
import { audio } from "./audio.js";

const W = 480, H = 640;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = W;
canvas.height = H;

const scoreEl = document.getElementById("score");
const ticketsEl = document.getElementById("tickets");
const creditsEl = document.getElementById("credits");
const statusEl = document.getElementById("status");
const btnStart = document.getElementById("btn-start");
const btnReset = document.getElementById("btn-reset");
const btnMute = document.getElementById("btn-mute");

let lastTs = 0;
let pointerPos = { x: W / 2, y: H / 2 }; // current mouse/touch position for claw targeting
let prevGrabbedCount = 0;

function setStatus(msg, tone = "") {
  statusEl.textContent = msg;
  statusEl.dataset.tone = tone || "";
}

function syncHud() {
  scoreEl.textContent = String(gameInstance.score);
  ticketsEl.textContent = String(gameInstance.tickets);
  creditsEl.textContent = String(gameInstance.credits);

  if (gameInstance.status === "ready") {
    btnStart.textContent = gameInstance.credits > 0 ? `開始 (1 幣)` : "幣不足";
    btnStart.disabled = gameInstance.credits <= 0;
    setStatus(gameInstance.tickets > 0 ? `獲得 ${gameInstance.tickets} 張彩券！` : "點「開始」投入一枚幣！");
  } else if (gameInstance.status === "descending") {
    btnStart.textContent = "下降中…";
    btnStart.disabled = true;
    setStatus("控制抓爪位置", "");
  } else if (gameInstance.status === "grabbing" || gameInstance.status === "ascending") {
    btnStart.textContent = "抬起中…";
    btnStart.disabled = true;
    setStatus("抬起中…", "");
  }
}

btnStart.addEventListener("click", () => {
  if (gameInstance.status === "ready" && gameInstance.credits > 0) {
    const started = gameInstance.start();
    if (started) audio.insertCoin();
  }
});

btnReset.addEventListener("click", () => {
  gameInstance.reset();
  audio.muted = false;
  btnMute.textContent = "音效開";
});

btnMute.addEventListener("click", () => {
  const muted = audio.toggle();
  btnMute.textContent = muted ? "音效關" : "音效開";
  btnMute.setAttribute("aria-pressed", String(!muted));
});

// Track pointer position for claw targeting during descent
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  pointerPos.x = e.clientX - rect.left;
  pointerPos.y = e.clientY - rect.top;
});

canvas.addEventListener("mouseleave", () => {}); // keep last known position

// Touch support — track touch position for claw targeting
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  if (e.touches.length > 0) {
    pointerPos.x = e.touches[0].clientX - rect.left;
    pointerPos.y = e.touches[0].clientY - rect.top;
  }
}, { passive: false });

// Auto-add credits when clicking start with no credits? No — keep strict per rules.
// But for demo friendliness, add a credit on click if empty (user-initiated action)
canvas.addEventListener("click", () => {
  // This allows the user to continue playing by adding a coin gesture
});

function loop(ts) {
  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0;
  lastTs = ts;

  if (dt > 0) {
    gameInstance.update(dt, pointerPos);

    // Play sounds based on state transitions
    const currentGrabbed = gameInstance.collectedBalls.length;

    if (currentGrabbed > prevGrabbedCount && gameInstance.status === "grabbing") {
      audio.grabSuccess();
    }

    // Ticket win sound when tickets increase in ready state
    if (gameInstance.tickets > 0 && gameInstance.status === "ready" && currentGrabbed === 0) {
      const ticketDelta = gameInstance.tickets - prevGrabbedCount;
      if (ticketDelta >= 3) {
        audio.ticketWin();
      }
    }

    prevGrabbedCount = currentGrabbed;
  }

  gameInstance.draw(ctx);
  syncHud();
  requestAnimationFrame(loop);
}

syncHud();
requestAnimationFrame(loop);
