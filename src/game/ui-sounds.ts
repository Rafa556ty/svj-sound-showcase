// Menu music, button clicks and the car-claim "purchase" sound.
// Browser only: created lazily from event handlers / effects.
import musicAsset from "@/assets/sounds/menu-music.mp3.asset.json";
import buyAsset from "@/assets/sounds/claim-purchase.mp3.asset.json";

export type MusicState = { title: boolean; phase: "loading" | "menu" | "playing" | "over" };

/** Menu music plays on the title screen and every menu, never while driving. */
export const wantsMenuMusic = (s: MusicState) => s.title || s.phase !== "playing";

export const MUSIC_VOLUME = 0.55;
export const MUSIC_FADE_OUT_MS = 600;
export const CLICK_VOLUME = 0.35;
export const BUY_VOLUME = 0.9;

class UiSounds {
  private ctx: AudioContext | null = null;
  private music: HTMLAudioElement | null = null;
  private buy: HTMLAudioElement | null = null;
  private muted = false;
  private wantMusic = false;
  private fadeRaf = 0;
  private stopTimer: ReturnType<typeof setTimeout> | undefined;

  private ensure() {
    if (typeof window === "undefined") return;
    if (!this.music) {
      // Pause the menu music whenever the app is in the background.
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.music?.pause();
        else if (this.wantMusic && !this.muted) this.startMusic();
      });
      const m = new Audio(musicAsset.url);
      m.loop = true; m.preload = "auto"; m.volume = 0;
      this.music = m;
      const b = new Audio(buyAsset.url);
      b.preload = "auto"; b.volume = BUY_VOLUME;
      this.buy = b;
    }
  }

  private audioCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Call from any user gesture: retries music the browser blocked. */
  unlock() {
    this.ensure();
    this.audioCtx();
    if (this.wantMusic && !this.muted && this.music?.paused) this.startMusic();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.ensure();
    if (m) { this.music?.pause(); }
    else if (this.wantMusic) this.startMusic();
  }

  setMusic(on: boolean) {
    this.ensure();
    this.wantMusic = on;
    clearTimeout(this.stopTimer);
    if (on && !this.muted) { this.startMusic(); return; }
    this.fadeTo(0, MUSIC_FADE_OUT_MS);
    // Hard stop on a timer, not the fade: a busy race start can starve
    // animation frames, and phones may ignore volume changes entirely.
    this.stopTimer = setTimeout(() => { if (!this.wantMusic) this.music?.pause(); }, MUSIC_FADE_OUT_MS + 50);
  }

  private startMusic() {
    const m = this.music;
    if (!m || document.hidden) return;
    if (m.paused) {
      m.play()
        // a slow phone may finish starting playback after the race began
        .then(() => { if (!this.wantMusic || this.muted) m.pause(); })
        .catch(() => { /* blocked until the first tap/key */ });
    }
    this.fadeTo(MUSIC_VOLUME, 1200);
  }

  private fadeTo(target: number, ms: number, done?: () => void) {
    const m = this.music;
    if (!m) return;
    cancelAnimationFrame(this.fadeRaf);
    const from = m.volume, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      m.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k < 1) this.fadeRaf = requestAnimationFrame(step);
      else done?.();
    };
    this.fadeRaf = requestAnimationFrame(step);
  }

  stopAll() {
    this.wantMusic = false;
    clearTimeout(this.stopTimer);
    cancelAnimationFrame(this.fadeRaf);
    this.music?.pause();
  }

  /** Short soft tick for menu buttons. */
  click() {
    if (this.muted) return;
    const ctx = this.audioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(CLICK_VOLUME, t);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    out.connect(ctx.destination);
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(1650, t);
    o.frequency.exponentialRampToValueAtTime(820, t + 0.07);
    o.connect(out); o.start(t); o.stop(t + 0.1);
    // a little noise "snap" on top
    const len = Math.floor(ctx.sampleRate * 0.025);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = ctx.createBufferSource(); n.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 4200; bp.Q.value = 1.2;
    const ng = ctx.createGain(); ng.gain.value = CLICK_VOLUME * 0.5;
    n.connect(bp).connect(ng).connect(ctx.destination); n.start(t);
  }

  /** Rising whoosh when leaving the title screen. */
  confirm() {
    if (this.muted) return;
    const ctx = this.audioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 2;
    bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(5000, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    n.connect(bp).connect(g).connect(ctx.destination); n.start(t); n.stop(t + 0.6);
    this.click();
  }

  /** The owner's purchase sound, played when a car is claimed. */
  purchase() {
    this.ensure();
    if (this.muted || !this.buy) return;
    try { this.buy.currentTime = 0; } catch { /* not loaded yet */ }
    this.buy.play().catch(() => {});
  }
}

export const uiSounds = new UiSounds();
// Dev hot reloads create a new instance; silence the old one so its music
// can never keep playing during a race.
if (import.meta.hot) import.meta.hot.dispose(() => uiSounds.stopAll());
