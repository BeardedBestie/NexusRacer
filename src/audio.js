import { SoundBank } from './soundbank.js';

/**
 * Sample-only audio. Every sound comes from a clip in public/sound — there is
 * no synthesised fallback, so an event with no matching clip is simply silent.
 * Drop new files in and re-run `npm run sounds` to wire them up.
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('nexusracer.muted.v2') === 'true';
    this.wantMusic = true;
    this.volume = 0.6;
    this.musicVolume = 0.32;
    this.track = 'music';
    this.bank = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);

      this.bank = new SoundBank(this.ctx, this.master);
      this.bank.load(import.meta.env.BASE_URL).then(() => {
        if (!this.muted && this.wantMusic) this.bank.startMusic(this.musicVolume, this.track);
      });
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('nexusracer.muted.v2', String(m));
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
    if (this.bank) {
      if (m) this.bank.stopMusic();
      else if (this.wantMusic) this.bank.startMusic(this.musicVolume, this.track);
    }
  }

  toggleMute() { this.ensure(); this.setMuted(!this.muted); return this.muted; }

  /** @param track 'music' for the main theme pool, 'chillMusic' for the lofi set */
  music(on, track = this.track) {
    this.wantMusic = on;
    this.track = track;
    if (!this.bank) return;
    if (on && !this.muted) this.bank.startMusic(this.musicVolume, track);
    else this.bank.stopMusic();
  }

  play(event, opts) {
    if (this.muted || !this.bank) return false;
    return this.bank.play(event, opts);
  }

  // ---- game events -------------------------------------------------------
  ui()            { this.play('ui', { volume: 0.5 }); }
  shot(kind) {
    if (kind === 'missile') { this.play('missile', { volume: 0.5, minGap: 0.12, voices: 3 }); return; }
    // Rapid fire: one clip per ~110ms with pitch spread, so a vulcan burst
    // reads as a burst instead of a wall of overlapping copies of one sample.
    this.play('shot', { volume: 0.3, rate: 1.25, jitter: 0.22, minGap: 0.11, voices: 3 });
  }
  boom()          { this.play('boom', { volume: 0.7, rate: 0.85, minGap: 0.07, voices: 4 }); }
  pickup(big)     { this.play('pickup', { volume: big ? 0.7 : 0.42, rate: big ? 0.9 : 1.2, minGap: 0.05, voices: 5 }); }
  gate()          { this.play('gate', { volume: 0.5 }); }
  hurt()          { this.play('hurt', { volume: 0.5, minGap: 0.35, voices: 2 }); }
  ability()       { this.play('boost', { volume: 0.5, rate: 1.1, minGap: 0.3, voices: 2 }); }
  miss()          { this.play('hurt', { volume: 0.35, rate: 0.8 }); }

  /** Fires once on the rising edge of the boost input. */
  engine(speed01, boosting) {
    if (boosting && !this._wasBoosting) this.play('boost', { volume: 0.55, minGap: 0.5, voices: 2 });
    this._wasBoosting = boosting;
  }
}
