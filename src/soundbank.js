// Sample playback layered on top of the procedural fallbacks.
// Clips are classified by filename keyword, so dropping new files into
// public/sound and re-running `npm run sounds` is enough to wire them up.

const RULES = [
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

  play(event, { volume = 1, rate = 1, jitter = 0.08 } = {}) {
    const list = this.buffers.get(event);
    if (!list) return false;
    const usable = list.filter((e) => e.buffer);
    if (!usable.length) return false;
    const entry = usable[(Math.random() * usable.length) | 0];
    const src = this.ctx.createBufferSource();
    src.buffer = entry.buffer;
    src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * jitter);
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g); g.connect(this.master);
    src.start();
    return true;
  }

  startMusic(volume = 0.32) {
    if (this.musicSource || !this.has('music')) return;
    const list = this.buffers.get('music').filter((e) => e.buffer);
    const entry = list[(Math.random() * list.length) | 0];
    const src = this.ctx.createBufferSource();
    src.buffer = entry.buffer;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g); g.connect(this.master);
    src.start();
    this.musicSource = src;
    this.musicGain = g;
  }

  stopMusic() {
    if (!this.musicSource) return;
    try { this.musicSource.stop(); } catch {}
    this.musicSource = null;
  }
}
