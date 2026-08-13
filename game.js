const W = 480;
const H = 640;

export const COLORS = {
  bg: "#1e293b",
  panel: "#1e293b",
  claw: "#fbbf24",
  ballColors: ["#ef4444", "#22c55e", "#a78bfa", "#f97316"],
};

export class Ball {
  constructor(x, y, colorIdx) {
    this.x = x;
    this.y = y;
    this.r = 12;
    this.colorIdx = colorIdx;
    this.vx = (Math.random() - 0.5) * 40;
    this.vy = 0;
    this.collected = false;
    this.targetX = x + (Math.random() - 0.5) * 80;
  }

  update(dt, collectedBalls) {
    if (this.collected) return;
    // Gentle floating motion when not grabbed
    this.x += this.vx * dt * 10;
    this.y += Math.sin(performance.now() / 500 + this.x * 0.1) * 0.3;

    if (this.x < 24 || this.x > W - 24) {
      this.vx *= -1;
    }

    // Check collision with collected balls group
    for (const other of collectedBalls) {
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      if (dx * dx + dy * dy < (this.r * 2 + 4) ** 2 && !other.collected) {
        // Push apart slightly
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.1) {
          this.x += (dx / dist) * 2;
          this.y += (dy / dist) * 2;
        }
      }
    }
  }

  draw(ctx) {
    const colors = COLORS.ballColors;
    ctx.fillStyle = colors[this.colorIdx];
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.arc(this.x - 3, this.y - 3, this.r / 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Claw {
  constructor() {
    this.x = W / 2;
    this.y = H / 2 - 60;
    this.targetX = W / 2;
    this.targetY = H / 2 - 60;
    this.speed = 180; // pixels per second when moving to target
    this.open = true;
    this.depth = 320; // how far down the claw can go
  }

  update(dt) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 2) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    } else {
      this.x = this.targetX;
      this.y = this.targetY;
    }
  }

  moveTo(x, y) {
    // Clamp target within play area
    const minX = 40, maxX = W - 40;
    const minY = H / 2 + 20, maxY = Math.min(H - this.depth + 30, H - 60);

    if (this.y < H / 2) {
      // Still moving down — clamp to play area bounds
      y = Math.max(minY, Math.min(maxY, y));
    }
    x = Math.max(minX, Math.min(maxX, x));

    this.targetX = x;
    this.targetY = y;
  }

  grab(balls) {
    const grabbed = [];
    for (const ball of balls) {
      if (!ball.collected && !this.open) {
        // Check if claw is over the ball and descending
        const dx = ball.x - this.x;
        const dy = ball.y - this.y + 30; // offset to grabber position
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < ball.r + 14) {
          grabbed.push(ball);
        }
      }
    }

    for (const ball of grabbed) {
      ball.collected = true;
      // Position relative to claw as it rises
      ball.x = this.x + (Math.random() - 0.5) * 24;
      ball.y = this.y - 30 + (grabbed.length - 1) * 6;
    }

    return grabbed;
  }

  draw(ctx) {
    ctx.save();
    // Claw arm (line from top center to current position)
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2 - this.depth - 10);
    ctx.lineTo(this.x, this.y + 10);
    ctx.stroke();

    // Claw body (circle at current position)
    const grabOffset = this.open ? 24 : -30;

    if (!this.open) {
      // Open claws — draw two "fingers" opening outward
      const fingerLen = 18;
      ctx.strokeStyle = COLORS.claw;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      // Left claw finger (angled left-down)
      ctx.beginPath();
      ctx.moveTo(this.x - 14, this.y + grabOffset);
      ctx.lineTo(this.x - 28, this.y + grabOffset + 10);
      ctx.stroke();
      // Right claw finger (angled right-down)
      ctx.beginPath();
      ctx.moveTo(this.x + 14, this.y + grabOffset);
      ctx.lineTo(this.x + 28, this.y + grabOffset + 10);
      ctx.stroke();
    } else {
      // Closed claws — fingers together pointing down
      const fingerLen = 20;
      ctx.strokeStyle = COLORS.claw;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(this.x - 12, this.y + grabOffset);
      ctx.lineTo(this.x - 6, this.y + grabOffset + fingerLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.x + 12, this.y + grabOffset);
      ctx.lineTo(this.x + 6, this.y + grabOffset + fingerLen);
      ctx.stroke();
    }

    // Claw pivot point
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.arc(W / 2, H / 2 - this.depth - 10, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

export class TicketGrabGame {
  constructor() {
    this.balls = [];
    this.collectedBalls = [];
    this.claw = new Claw();
    this.score = 0;
    this.tickets = 0;
    this.credits = 10;
    this.status = "ready"; // ready | descending | ascending | gameover
    this.ballColors = [0, 0, 1, 1, 2, 2, 3, 3]; // color distribution
    this._spawnBalls();
  }

  _spawnBalls() {
    this.balls = [];
    const playAreaTop = H / 2 + 40;
    const playAreaBottom = H - 80;
    const playWidth = W - 60;

    // Arrange balls in a grid with some randomness
    let colorIdx = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const x = 50 + (playWidth / 4) * col + Math.random() * 20 - 10;
        const y = playAreaTop + row * 60 + Math.random() * 10;
        this.balls.push(new Ball(x, y, colorIdx % this.ballColors.length));
        colorIdx++;
      }
    }
  }

  reset() {
    this._spawnBalls();
    this.collectedBalls = [];
    this.claw = new Claw();
    this.score = 0;
    this.tickets = 0;
    this.credits = 10;
    this.status = "ready";
  }

  start() {
    if (this.credits <= 0) return false;
    this.credits--;
    this.collectedBalls = [];
    // Reset claw to top position
    this.claw.x = W / 2;
    this.claw.y = H / 2 - this.claw.depth - 10;
    this.claw.targetX = W / 2;
    this.claw.targetY = H / 2 + 40; // start descending to play area center
    this.status = "descending";

    // Reset collected balls back to normal
    for (const ball of this.balls) {
      ball.collected = false;
      // Give them a little velocity reset
      ball.vx = (Math.random() - 0.5) * 40;
    }
  }

  update(dt, pointerPos) {
    if (this.status === "ready") return;

    this.claw.update(dt);

    // Handle descent/ascend phases based on claw position
    const playAreaCenter = H / 2 + 40;
    const topPosition = H / 2 - this.claw.depth - 10;

    if (this.status === "descending") {
      // Update target to follow pointer while descending
      if (pointerPos) {
        this.claw.moveTo(pointerPos.x, playAreaCenter + 40);
      }

      // When claw reaches near bottom of descent path
      if (Math.abs(this.claw.y - (playAreaCenter)) < 20 && Math.abs(this.claw.targetY - (playAreaCenter + 60)) < 10) {
        this.status = "grabbing";
        const grabbed = this.claw.grab(this.balls);

        // Move collected balls to the collection area as claw ascends
        for (const ball of grabbed) {
          this.collectedBalls.push(ball);
          ball.x = this.claw.x + (Math.random() - 0.5) * 24;
          ball.y = playAreaCenter - 30;
        }

        // Score based on number collected and color matches
        const scoreGain = grabbed.length * 10;
        this.score += scoreGain;

        // Check for ticket rewards — if we grabbed balls of the same color, award tickets
        const colorCounts = {};
        for (const ball of grabbed) {
          colorCounts[ball.colorIdx] = (colorCounts[ball.colorIdx] || 0) + 1;
        }

        let comboTickets = 0;
        for (const count of Object.values(colorCounts)) {
          if (count >= 2) {
            comboTickets += count * 5; // bonus tickets for color matches!
          } else {
            comboTickets += count * 3; // base ticket per ball
          }
        }

        this.tickets += Math.max(comboTickets, grabbed.length * 3);

        // Retract claw — target back to top
        this.claw.targetX = W / 2 + (Math.random() - 0.5) * 60;
        this.claw.targetY = playAreaCenter;
      }
    } else if (this.status === "grabbing") {
      // After grabbing, move to collection area and then back up
      const collectedX = W / 2 + (Math.random() - 0.5) * 60;

      this.claw.moveTo(collectedX, playAreaCenter);

      if (Math.abs(this.claw.x - collectedX) < 3 && Math.abs(this.claw.y - playAreaCenter) < 3) {
        // Move back up to starting position
        this.status = "ascending";
        this.claw.targetX = W / 2 + (Math.random() - 0.5) * 40;
        this.claw.targetY = topPosition;
      }

      // Update collected ball positions as they're carried up by the claw
      for (const ball of this.collectedBalls) {
        if (!ball.collected) continue;
        ball.x += (Math.random() - 0.5) * 2;
        ball.y = this.claw.y + 10 + (this.collectedBalls.indexOf(ball)) * 8;
      }

    } else if (this.status === "ascending") {
      // Update collected balls following the claw up
      for (let i = 0; i < this.collectedBalls.length; i++) {
        const ball = this.collectedBalls[i];
        if (!ball.collected) continue;
        ball.x = this.claw.x + (Math.random() - 0.5) * 24;
        ball.y = this.claw.y + 10 + i * 8;
      }

      // When claw reaches top, finalize and reset collected balls to play area or remove them
      if (this.claw.y < H / 2 - this.claw.depth) {
        // Move all non-collected remaining balls back into the play area with fresh positions
        let colorIdx = Math.floor(Math.random() * this.ballColors.length);
        for (const ball of this.balls) {
          if (!ball.collected) {
            const row = Math.floor(this.balls.indexOf(ball) / 4);
            const col = this.balls.indexOf(ball) % 4;
            ball.x = 50 + ((W - 60) / 4) * col + (Math.random() - 0.5) * 20;
            ball.y = H / 2 + 40 + row * 60 + (Math.random() - 0.5) * 10;
            ball.vx = (Math.random() - 0.5) * 40;
          } else {
            // Reset collected balls for next round — put them back in play area
            ball.collected = false;
            const idx = this.balls.indexOf(ball);
            if (idx >= 0) {
              const row = Math.floor(idx / 4);
              const col = idx % 4;
              ball.x = 50 + ((W - 60) / 4) * col + (Math.random() - 0.5) * 20;
              ball.y = H / 2 + 40 + row * 60 + (Math.random() * 10);
              ball.vx = (Math.random() - 0.5) * 40;
            }
          }
        }

        this.collectedBalls = [];
        this.status = "ready";
      } else {
        // Continue updating collected balls as they rise with the claw
        for (const ball of this.balls) {
          if (!ball.collected && !this.collectedBalls.includes(ball)) continue;
          // These are in collectedBalls and being tracked above
        }

        // Update non-collected balls' floating motion
        const activeBalls = this.balls.filter(b => !b.collected);
        for (const ball of activeBalls) {
          ball.update(dt, []);
        }
      }
    }

    // Continuous update for uncollected balls
    if (this.status === "ready" || (this.status !== "descending")) {
      const activeBalls = this.balls.filter(b => !b.collected && !this.collectedBalls.includes(b));
      for (const ball of activeBalls) {
        ball.update(dt, []);
      }
    }

    // Update collected balls floating while carried by claw during descent
    if (this.status === "descending") {
      const activeBalls = this.balls.filter(b => !b.collected);
      for (const ball of activeBalls) {
        ball.update(dt, []);
      }
    }

    // Check win condition — all balls collected
    if (this.status === "ready" && this.balls.every(b => b.collected)) {
      this.tickets += 50; // bonus for clearing!
      this._spawnBalls();
    }

    // Auto-add credits if very low (for continuous play) — no, keep it strict
  }

  draw(ctx) {
    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // Draw glass/metal frame around play area
    const playTop = H / 2 + 30;
    const playBottom = H - 50;
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 4;
    ctx.strokeRect(28, playTop, W - 56, playBottom - playTop);

    // Draw glass reflection overlay
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(28, playTop, W - 56, (playBottom - playTop) / 2);

    // Draw all balls
    for (const ball of this.balls) {
      if (!ball.collected || !this.collectedBalls.includes(ball)) {
        ball.draw(ctx);
      }
    }

    // Draw collected balls (being carried by claw) on top
    for (const ball of this.collectedBalls) {
      ball.draw(ctx);
    }

    // Draw the claw machine structure — top rail with "coin slot" visual
    ctx.fillStyle = "#334155";
    ctx.fillRect(28, H / 2 - 100, W - 56, 20);
    // Coin slot indicators
    for (let i = 0; i < this.credits; i++) {
      const cx = 40 + i * 14;
      if (cx > W - 30) break;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(cx, H / 2 - 90, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw the claw itself
    this.claw.draw(ctx);

    // Status overlay for game messages
    if (this.status === "ready" && this.credits <= 0) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
      ctx.fillRect(W / 2 - 100, H / 2 + 60, 200, 60);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 18px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("幣不足！", W / 2, H / 2 + 95);
    }

    // Draw ticket count animation if recently won tickets
    if (this.tickets > 0 && this.status === "ready") {
      const elapsed = performance.now() % 3000;
      if (elapsed < 1500) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 20px -apple-system, sans-serif";
        ctx.textAlign = "center";
        const alpha = elapsed / 1500;
        ctx.globalAlpha = alpha > 0.7 ? (1 - (alpha - 0.7) * 3) : alpha;
        ctx.fillText(`🎫 +${this.tickets} 彩券！`, W / 2, playTop + 40);
        ctx.globalAlpha = 1;
      }
    }
  }
}

export const gameInstance = new TicketGrabGame();
