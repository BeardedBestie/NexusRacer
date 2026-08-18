// Sample playback layered on top of the procedural fallbacks.
// Clips are classified by filename keyword, so dropping new files into
// public/sound and re-running `npm run sounds` is enough to wire them up.

const RULES = [
  // chill tracks are picked out before the general music rule
  { event: 'chillMusic', match: /bgmusic[45]|lofi|chill|ambient/i },
  { event: 'music',  match: /bgmusic|music|theme|track/i },
  { event: 'boost',  match: /boost|thrust|afterburn/i },
  { event: 'gate',   match: /whoosh|swoosh|pass|gate/i },
  { event: 'shot',   match: /laser|shoot|shot|blast|gun|pew/i },
  { event: 'missile',match: /missile|rocket|launch/i },
  { event: 'boom',   match: /explos|boom|blast|impact|destroy/i },
  { event: 'pickup', match: /pickup|coin|collect|shard|chime|reward|ring/i },
  { event: 'hurt',   match: /hurt|damage|hit|alarm/i },
  { event: 'ui',     match: /ui|click|select|menu|confirm/i },
];

// Generic "video_game_space_shi_#N" style clips have no usable keyword, so they
// get spread across the events that most need a sample, in filename order.
const FILLER_ORDER = ['shot', 'ui', 'pickup', 'boom', 'missile', 'hurt'];

export class SoundBank {
  constructor(ctx, master) {
    this.ctx = ctx;
    this.master = master;
    this.buffers = new Map();   // event -> AudioBuffer[]
    this.ready = false;
    this.musicSource = null;
    this._last = new Map();      // event -> last trigger time
    this._voices = new Map();    // event -> live source count
  }

  async load(base = '/') {
    let files = [];
    try {
      const res = await fetch(`${base}sound/manifest.json`);
      if (!res.ok) return;
      files = await res.json();
    } catch { return; }

    const assign = (event, file) => {
      if (!this.buffers.has(event)) this.buffers.set(event, []);
      this.buffers.get(event).push({ file, buffer: null });
    };

    const unclaimed = [];
    for (const f of files) {
      const rule = RULES.find((r) => r.match.test(f));
      if (rule) assign(rule.event, f);
      else unclaimed.push(f);
    }
    unclaimed.sort();
    unclaimed.forEach((f, i) => assign(FILLER_ORDER[i % FILLER_ORDER.length], f));

    // decode in parallel; a failed clip just falls back to the synth
    const jobs = [];
    for (const [, list] of this.buffers) {
      for (const entry of list) {
        jobs.push((async () => {
          try {
            const r = await fetch(`${base}sound/${encodeURIComponent(entry.file)}`);
            entry.buffer = await this.ctx.decodeAudioData(await r.arrayBuffer());
          } catch { entry.buffer = null; }
        })());
      }
    }
    await Promise.all(jobs);
    this.ready = true;
  }

  has(event) {
    const l = this.buffers.get(event);
    return !!l && l.some((e) => e.buffer);
  }

  /**
   * @param minGap  seconds this event must wait before retriggering
   * @param voices  how many copies of this event may sound at once
   *
   * A rapid-fire weapon asks for a sample every 55ms; layering that many copies
   * of one clip phases into mud and stacks gain until it clips. Gating the
   * retrigger and capping concurrent voices keeps it reading as a burst.
   */
  play(event, { volume = 1, rate = 1, jitter = 0.08, minGap = 0, voices = 6 } = {}) {
    const list = this.buffers.get(event);
    if (!list) return false;
    const usable = list.filter((e) => e.buffer);
    if (!usable.length) return false;

    const now = this.ctx.currentTime;
    if (minGap > 0) {
      const last = this._last.get(event) ?? -1e9;
      if (now - last < minGap) return false;
      this._last.set(event, now);
    }

    const active = this._voices.get(event) ?? 0;
    if (active >= voices) return false;
    this._voices.set(event, active + 1);

    const entry = usable[(Math.random() * usable.length) | 0];
    const src = this.ctx.createBufferSource();
    src.buffer = entry.buffer;
    src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * jitter);
    const g = this.ctx.createGain();
    // trim each extra simultaneous voice so a burst does not stack into clipping
    g.gain.value = volume / (1 + active * 0.45);
    src.connect(g); g.connect(this.master);
    src.onended = () => this._voices.set(event, Math.max(0, (this._voices.get(event) ?? 1) - 1));
    src.start();
    return true;
  }

  /**
   * Rotate through the pool rather than looping one track forever: each clip
   * plays to the end, then the next in a shuffled order takes over, so the
   * hangar does not always greet you with the same song.
   */
  startMusic(volume = 0.32, event = 'music') {
    if (this.musicSource && this.musicEvent === event) return;
    if (this.musicSource) this.stopMusic();
    if (!this.has(event)) return;

    this.musicEvent = event;
    this.musicVolume = volume;
    this._queue = this._shuffled(event);
    this._playNextTrack();
  }

  _shuffled(event) {
    const list = this.buffers.get(event).filter((e) => e.buffer);
    const order = list.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [order[i], order[j]] = [order[j], order[i]];
    }
    // avoid opening on the same track twice in a row across restarts
    if (order.length > 1 && order[0].file === this._lastTrack) {
      [order[0], order[1]] = [order[1], order[0]];
    }
    return order;
  }

  _playNextTrack() {
    if (!this.musicEvent) return;
    if (!this._queue || !this._queue.length) this._queue = this._shuffled(this.musicEvent);
    const entry = this._queue.shift();
    if (!entry) return;
    this._lastTrack = entry.file;

    const src = this.ctx.createBufferSource();
    src.buffer = entry.buffer;
    src.loop = false;
    const g = this.ctx.createGain();
    g.gain.value = this.musicVolume;
    src.connect(g); g.connect(this.master);
    src.onended = () => {
      if (this.musicSource !== src) return;   // stopped or replaced deliberately
      this.musicSource = null;
      this._playNextTrack();
    };
    src.start();
    this.musicSource = src;
    this.musicGain = g;
  }

  stopMusic() {
    const src = this.musicSource;
    this.musicSource = null;      // cleared first so onended does not advance
    this.musicEvent = null;
    this._queue = null;
    if (src) { try { src.stop(); } catch { /* already stopped */ } }
  }
}
