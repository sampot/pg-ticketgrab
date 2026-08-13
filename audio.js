const W = 480, H = 640;

export class TicketGrabAudio {
  constructor() {
    this.ctx = null;
    this.muted = true; // default muted to respect user gesture on load
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtor();
    } catch (_) {}
  }

  _ensure() {
    if (!this.ctx) return null;
    if (typeof this.ctx.resume === "function") {
      try { this.ctx.resume(); } catch (_) {}
    }
    return this.ctx;
  }

  toggle() { this.muted = !this.muted; return this.muted; }

  _beep(freq, duration = 0.12, type = "sine", gain = 0.15) {
    if (this.muted || !this._ensure()) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, 0);
    g.gain.exponentialRampToValueAtTime(0.001, duration + 0.1);
    osc.connect(g).connect(this.ctx.destination);
    osc.start();
    setTimeout(() => osc.stop(), (duration + 0.2) * 1000);
  }

  insertCoin() { this._beep(880, 0.2, "triangle", 0.2); }   // coin drop sound
  clawMove() { this._beep(440, 0.05, "sine", 0.1); }         // motor hum
  grabSuccess() { this._beep(660, 0.15, "square", 0.2); }    // successful grab
  ticketWin() { this._beep(784, 0.3, "sine", 0.25); }        // ticket payout jingle (ascending)
}

export const audio = new TicketGrabAudio();
