import * as THREE from 'three';

/**
 * Mobile control layer.
 *
 * Two ways to steer, both feeding the same virtual stick the mouse drives, so
 * the flight model and the HUD reticle never need to know where the input came
 * from:
 *
 *   TILT   (default)  the phone's gyroscope — lean the handset to bank and dive
 *   TOUCH             put a finger down anywhere on the left of the glass and
 *                     move it around; the stick springs up under it
 *
 * Everything the keyboard and mouse buttons cover — throttle, boost, brake,
 * both weapons, the ability, target cycling and pause — gets an on-screen key.
 */

export const STEER = { TILT: 'tilt', TOUCH: 'touch' };

/**
 * Both tests have to pass: `pointer:coarse` describes the *primary* pointing
 * device, so a laptop with a touchscreen but a trackpad in charge stays on
 * mouse-and-keyboard and keeps its pointer lock. `?touch=1` / `?touch=0` force
 * the decision either way for testing on a desktop.
 */
export const IS_TOUCH = (() => {
  const forced = new URLSearchParams(location.search).get('touch');
  if (forced !== null) return forced !== '0';
  if (typeof matchMedia !== 'function') return false;
  return matchMedia('(pointer:coarse)').matches && (navigator.maxTouchPoints ?? 0) > 0;
})();

const DOE = typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null;
/** iOS 13+ only hands out orientation data after a gesture-backed ask. */
const GYRO_NEEDS_ASK = !!(DOE && typeof DOE.requestPermission === 'function');

const D = Math.PI / 180;
const _euler = new THREE.Euler();
const _q = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
// DeviceOrientationControls' frame fix: -90 deg about X drops the device's
// screen plane into three's Y-up world.
const _qFlip = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
const ZEE = new THREE.Vector3(0, 0, 1);
const DOWN = new THREE.Vector3(0, -1, 0);
const _g = new THREE.Vector3();

/**
 * Pointer capture keeps a drag alive once the finger leaves the element, but it
 * throws if the pointer has already been released (or was synthesised). Never
 * let that take the button press down with it.
 */
function capture(el, id) {
  try { el.setPointerCapture?.(id); } catch { /* pointer already gone */ }
}

/**
 * Gravity expressed in screen space — x right, y up, z out through the glass —
 * which is all the tilt read needs and is stable in any device orientation.
 *
 * Alpha (compass heading) is deliberately fed in as 0: it is a rotation about
 * the world vertical, so it cancels out of this vector exactly, and leaving it
 * out keeps the read steady on handsets whose magnetometer wanders.
 */
function screenGravity(beta, gamma, orient) {
  _euler.set(beta * D, 0, -gamma * D, 'YXZ');
  _q.setFromEuler(_euler);
  _q.multiply(_qFlip);
  _q.multiply(_qs.setFromAxisAngle(ZEE, -orient * D));
  return _g.copy(DOWN).applyQuaternion(_q.invert());
}

// Tilt away from the calibrated pose needed for full stick throw. Roll gets a
// wider gate than pitch: wrists roll freely, but leaning the handset far enough
// forward to dive also drags the screen out of view.
const ROLL_RANGE = 32 * D;
const PITCH_RANGE = 24 * D;

const CSS = `
#touch{position:absolute;inset:0;z-index:7;pointer-events:none;
  font-family:"Rajdhani","Chakra Petch",ui-sans-serif,system-ui,sans-serif;
  touch-action:none;-webkit-user-select:none;user-select:none;
  -webkit-tap-highlight-color:transparent}
#touch.off{display:none}
#touch .zone,#touch .tbtn,#touch .thr{pointer-events:auto;touch-action:none}

/* The steering half is invisible until a finger lands on it. */
#touch .zone{position:absolute;left:0;top:0;bottom:0;width:52%}
#touch.tilt .zone{display:none}
#touch .stick{position:absolute;left:0;top:0;width:0;height:0;opacity:0;
  transition:opacity .16s}
#touch .stick.on{opacity:1}
#touch .stick i{position:absolute;border-radius:50%;transform:translate(-50%,-50%);
  display:block;pointer-events:none}
#touch .stick .base{width:132px;height:132px;border:1.5px solid rgba(94,242,255,.34);
  background:radial-gradient(circle,rgba(94,242,255,.09),transparent 70%)}
#touch .stick .knob{width:56px;height:56px;border:1.5px solid #5ef2ff;
  background:rgba(94,242,255,.2);box-shadow:0 0 20px rgba(94,242,255,.45)}

/* One cluster, bottom-right: a row of utility keys over the action keys. Both
   rows wrap toward the right edge so a portrait handset stacks them instead of
   pushing the fire key off-screen. */
#touch .deck{position:absolute;right:calc(14px + env(safe-area-inset-right));
  bottom:calc(16px + env(safe-area-inset-bottom));max-width:62vw;
  display:flex;flex-direction:column;align-items:flex-end;gap:10px}
#touch .util{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
#touch .acts{display:flex;flex-direction:row-reverse;flex-wrap:wrap-reverse;
  align-items:flex-end;justify-content:flex-start;gap:10px}
#touch .tbtn{border:1.5px solid rgba(120,150,200,.4);background:rgba(8,14,32,.5);
  color:#9db6d6;border-radius:50%;font-family:inherit;font-weight:700;letter-spacing:.1em;
  font-size:11px;width:62px;height:62px;backdrop-filter:blur(3px);
  display:flex;align-items:center;justify-content:center;transition:.1s;padding:0}
#touch .tbtn.fire{width:92px;height:92px;font-size:14px;letter-spacing:.16em;
  border-color:rgba(255,79,216,.55);color:#ffb8ee;background:rgba(60,10,44,.42)}
#touch .tbtn.sm{width:44px;height:44px;font-size:9.5px;letter-spacing:.06em}
#touch .tbtn.hot{background:rgba(94,242,255,.3);color:#eaffff;border-color:#5ef2ff;
  box-shadow:0 0 22px rgba(94,242,255,.5)}
#touch .tbtn.fire.hot{background:rgba(255,79,216,.34);border-color:#ff4fd8;
  box-shadow:0 0 26px rgba(255,79,216,.5);color:#fff}

/* Throttle rail, bottom-left, under the steering thumb. */
#touch .thr{position:absolute;left:calc(14px + env(safe-area-inset-left));
  bottom:calc(16px + env(safe-area-inset-bottom));width:56px;height:172px;
  border:1.5px solid rgba(120,150,200,.4);border-radius:28px;background:rgba(8,14,32,.5);
  backdrop-filter:blur(3px);overflow:hidden}
#touch .thr b{position:absolute;left:0;right:0;bottom:0;display:block;
  background:linear-gradient(0deg,rgba(182,255,61,.55),rgba(94,242,255,.4));
  transition:height .05s linear}
#touch .thr span{position:absolute;left:0;right:0;top:8px;text-align:center;font-size:9px;
  letter-spacing:.18em;color:#c8dcf2;text-shadow:0 1px 3px #000}
#touch .thr em{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:13px;
  font-style:normal;font-weight:700;color:#e8f4ff;text-shadow:0 1px 3px #000}

@media (max-height:430px){
  #touch .tbtn{width:52px;height:52px;font-size:10px}
  #touch .tbtn.fire{width:76px;height:76px;font-size:12.5px}
  #touch .thr{height:132px;width:50px}
}
`;

/**
 * Reads the on-screen deck and the gyroscope. Nothing here talks to the game
 * directly — main.js pulls the axes and flags each frame.
 */
export class TouchControls {
  constructor(root) {
    this.root = root;
    this.sensitivity = 1;

    this.mode = localStorage.getItem('nexusracer.steer') === STEER.TOUCH
      ? STEER.TOUCH : STEER.TILT;

    // stick, -1..1, in the same sense as the mouse-driven one
    this.x = 0; this.y = 0;
    this.steering = false;

    this.throttleSet = null;    // 0..1 absolute demand from the rail, or null
    this._shownThrottle = -1;
    this.boost = false; this.brake = false;
    this.primary = false; this.secondary = false;
    this._taps = new Set();

    this.gyroLive = false;
    this._zero = null;                    // calibration pose, radians
    this._tilt = { roll: 0, pitch: 0 };   // smoothed read, radians

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'touch';
    el.className = 'off';
    el.innerHTML = `
      <div class="zone">
        <div class="stick">
          <i class="base"></i><i class="knob"></i>
        </div>
      </div>
      <div class="thr" aria-label="Throttle">
        <b></b><span>THR</span><em>72</em>
      </div>
      <div class="deck">
        <div class="util">
          <button class="tbtn sm" data-tap="camera" aria-label="Camera">CAM</button>
          <button class="tbtn sm" data-tap="target" aria-label="Cycle target">TGT</button>
          <button class="tbtn sm" data-tap="recentre" aria-label="Recentre steering">⊙</button>
          <button class="tbtn sm" data-tap="pause" aria-label="Pause">❚❚</button>
        </div>
        <div class="acts">
          <button class="tbtn fire" data-hold="primary">FIRE</button>
          <button class="tbtn" data-hold="secondary">MSL</button>
          <button class="tbtn" data-tap="ability">ABL</button>
          <button class="tbtn" data-hold="boost">BST</button>
          <button class="tbtn" data-hold="brake">BRK</button>
        </div>
      </div>`;
    root.appendChild(el);

    this.el = el;
    this.zone = el.querySelector('.zone');
    this.stick = el.querySelector('.stick');
    this.knob = el.querySelector('.knob');
    this.base = el.querySelector('.base');
    this.rail = el.querySelector('.thr');
    this.railFill = el.querySelector('.thr b');
    this.railNum = el.querySelector('.thr em');

    this._wireButtons();
    this._wireStick();
    this._wireThrottle();
    this._applyMode();
  }

  // ------------------------------------------------------------- plumbing ---
  /**
   * Each key owns the pointer that pressed it, so releasing one finger never
   * clears another key — steering, firing and throttling all happen at once.
   * A stuck held key would jam a weapon on, so the release is also caught on
   * lostpointercapture and on losing the window.
   */
  _wireButtons() {
    this._holds = [];
    for (const b of this.el.querySelectorAll('[data-hold],[data-tap]')) {
      const hold = b.dataset.hold, tap = b.dataset.tap;
      let pid = null;
      const on = (e) => {
        e.preventDefault();
        pid = e.pointerId;
        capture(b, e.pointerId);
        b.classList.add('hot');
        if (hold) this[hold] = true;
        if (tap) this._taps.add(tap);
        this.onFeedback?.();
      };
      const off = (e) => {
        if (e && pid !== null && e.pointerId !== pid) return;
        pid = null;
        b.classList.remove('hot');
        if (hold) this[hold] = false;
      };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('lostpointercapture', off);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      this._holds.push(off);
    }
    addEventListener('blur', () => this.releaseAll());
  }

  /** Drop every held key and any drag in progress. */
  releaseAll() {
    for (const off of this._holds ?? []) off(null);
    this._endDrag?.();
  }

  /**
   * Dynamic stick: the base springs up wherever the finger lands, and if the
   * finger outruns the ring the base follows it rather than pinning at full
   * deflection — you can walk the stick across the glass without lifting off.
   */
  _wireStick() {
    let id = null, ox = 0, oy = 0;
    const reach = () => Math.max(58, Math.min(innerWidth, innerHeight) * 0.17);

    const place = (x, y) => {
      this.stick.style.transform = `translate(${ox}px,${oy}px)`;
      this.knob.style.left = `${x - ox}px`;
      this.knob.style.top = `${y - oy}px`;
    };

    const down = (e) => {
      if (id !== null) return;
      id = e.pointerId;
      capture(this.zone, id);
      ox = e.clientX; oy = e.clientY;
      this.steering = true;
      this.stick.classList.add('on');
      const r = reach() * 2;
      this.base.style.width = this.base.style.height = `${r}px`;
      place(e.clientX, e.clientY);
      this.x = 0; this.y = 0;
      e.preventDefault();
    };

    const move = (e) => {
      if (e.pointerId !== id) return;
      const R = reach();
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        // drag the base along behind the finger
        const k = (d - R) / d;
        ox += dx * k; oy += dy * k;
        dx -= dx * k; dy -= dy * k;
      }
      this.x = THREE.MathUtils.clamp(dx / R, -1, 1);
      this.y = THREE.MathUtils.clamp(dy / R, -1, 1);
      place(e.clientX, e.clientY);
      e.preventDefault();
    };

    const up = (e) => {
      if (e && e.pointerId !== id) return;
      id = null;
      this.steering = false;
      this.stick.classList.remove('on');
    };
    this._endDrag = () => up(null);

    this.zone.addEventListener('pointerdown', down);
    this.zone.addEventListener('pointermove', move);
    this.zone.addEventListener('pointerup', up);
    this.zone.addEventListener('pointercancel', up);
    // Losing capture mid-drag would otherwise freeze the stick at whatever
    // deflection it held — a permanent bank with nothing to release it.
    this.zone.addEventListener('lostpointercapture', up);
  }

  /** Vertical rail: touch anywhere on it to demand that throttle setting. */
  _wireThrottle() {
    let id = null;
    const read = (e) => {
      const r = this.rail.getBoundingClientRect();
      const t = THREE.MathUtils.clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
      this.throttleSet = t;
      this.setThrottleReadout(t);
    };
    const down = (e) => {
      if (id !== null) return;
      id = e.pointerId;
      capture(this.rail, id);
      read(e); e.preventDefault();
      this.onFeedback?.();
    };
    const move = (e) => { if (e.pointerId === id) { read(e); e.preventDefault(); } };
    const up = (e) => { if (e.pointerId === id) id = null; };
    this.rail.addEventListener('pointerdown', down);
    this.rail.addEventListener('pointermove', move);
    this.rail.addEventListener('pointerup', up);
    this.rail.addEventListener('pointercancel', up);
    this.rail.addEventListener('lostpointercapture', up);
  }

  /** Called every frame from the flight loop, so only touch the DOM on change. */
  setThrottleReadout(t) {
    const pct = Math.round(t * 100);
    if (pct === this._shownThrottle) return;
    this._shownThrottle = pct;
    this.railFill.style.height = `${pct}%`;
    this.railNum.textContent = pct;
  }

  // ----------------------------------------------------------------- gyro ---
  /**
   * Ask for the sensor if the platform gates it, then start listening. Must be
   * called from inside a user gesture on iOS. Resolves to whether tilt is live.
   */
  async enableGyro() {
    if (!DOE) return false;
    if (this.gyroLive) return true;
    if (GYRO_NEEDS_ASK) {
      try {
        if (await DOE.requestPermission() !== 'granted') return false;
      } catch { return false; }
    }
    if (!this._onOrient) {
      this._onOrient = (e) => {
        if (e.beta === null || e.gamma === null) return;
        const orient = screen.orientation?.angle ?? window.orientation ?? 0;
        const g = screenGravity(e.beta, e.gamma, orient);
        const roll = Math.asin(THREE.MathUtils.clamp(g.x, -1, 1));
        const pitch = Math.asin(THREE.MathUtils.clamp(-g.z, -1, 1));
        // light smoothing: handset sensors are noisy at rest
        this._tilt.roll += (roll - this._tilt.roll) * 0.35;
        this._tilt.pitch += (pitch - this._tilt.pitch) * 0.35;
        if (!this._zero) this.recentre();
        this.gyroLive = true;
      };
      addEventListener('deviceorientation', this._onOrient);
    }
    // A handset with no gyro never fires the event; report what we know after
    // giving it a couple of frames to speak up.
    await new Promise((r) => setTimeout(r, 350));
    return this.gyroLive;
  }

  /** Zero the tilt to however the handset is being held right now. */
  recentre() {
    this._zero = { roll: this._tilt.roll, pitch: this._tilt.pitch };
  }

  // ----------------------------------------------------------------- state ---
  setMode(mode) {
    this.mode = mode === STEER.TOUCH ? STEER.TOUCH : STEER.TILT;
    localStorage.setItem('nexusracer.steer', this.mode);
    this._applyMode();
  }

  _applyMode() {
    this.el.classList.toggle('tilt', this.mode === STEER.TILT);
    if (this.mode === STEER.TILT) {
      this.steering = false;
      this.stick.classList.remove('on');
    }
  }

  setVisible(on) {
    this.el.classList.toggle('off', !on);
    if (!on) {
      this.boost = this.brake = this.primary = this.secondary = false;
      this.steering = false;
      this.stick.classList.remove('on');
      for (const b of this.el.querySelectorAll('.tbtn')) b.classList.remove('hot');
      this._taps.clear();
    }
  }

  /** True while the player is actively commanding an attitude. */
  get active() {
    return this.mode === STEER.TILT ? this.gyroLive : this.steering;
  }

  /**
   * Stick deflection, -1..1 on each axis, from whichever source is driving.
   * Tilt is measured against the calibrated pose, so "level" is however the
   * handset was being held when the run started.
   */
  axes(out = { x: 0, y: 0 }) {
    if (this.mode === STEER.TOUCH) {
      out.x = this.x; out.y = this.y;
      return out;
    }
    const z = this._zero;
    if (!this.gyroLive || !z) { out.x = 0; out.y = 0; return out; }
    const s = 1 / Math.max(0.3, this.sensitivity);
    out.x = THREE.MathUtils.clamp((this._tilt.roll - z.roll) / (ROLL_RANGE * s), -1, 1);
    out.y = THREE.MathUtils.clamp((this._tilt.pitch - z.pitch) / (PITCH_RANGE * s), -1, 1);
    return out;
  }

  /** One-shot buttons, consumed the way Input.pressed() is. */
  tapped(name) { return this._taps.has(name); }

  endFrame() { this._taps.clear(); }
}
