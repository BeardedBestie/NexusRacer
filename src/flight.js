import * as THREE from 'three';
import { SEA_LEVEL } from './terrain.js';

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export const ASSIST = { ASSISTED: 'assisted', STANDARD: 'standard' };

/**
 * Arcade-leaning flight model: gravity, thrust, quadratic drag, speed-dependent
 * lift, angular inertia, bank-to-turn, and a soft stall.  Fixed timestep.
 */
export class FlightModel {
  constructor(stats, opts = {}) {
    this.s = stats;
    this.assist = opts.assist ?? ASSIST.ASSISTED;

    this.position = new THREE.Vector3(0, 900, 0);
    this.quaternion = new THREE.Quaternion();
    this.velocity = new THREE.Vector3(0, 0, -220);
    this.angVel = new THREE.Vector3(); // pitch(x), yaw(y), roll(z) body rates

    this.throttle = 0.72;
    this.boostFuel = stats.boostMax;
    this.boosting = false;
    this.braking = false;
    this.stallT = 0;
    this.gLoad = 1;

    // control inputs, -1..1
    this.ctl = { pitch: 0, yaw: 0, roll: 0 };

    // modifiers applied by abilities
    this.mods = { speed: 1, thrust: 1, turn: 1, drag: 1 };
  }

  get speed() { return this.velocity.length(); }

  forward(out = _fwd) { return out.set(0, 0, -1).applyQuaternion(this.quaternion); }
  up(out = _up) { return out.set(0, 1, 0).applyQuaternion(this.quaternion); }
  right(out = _right) { return out.set(1, 0, 0).applyQuaternion(this.quaternion); }

  step(dt, hf) {
    const s = this.s;
    const m = this.mods;
    const assisted = this.assist === ASSIST.ASSISTED;

    // --- angular dynamics -------------------------------------------------
    const turnScale = m.turn;
    const targetP = this.ctl.pitch * s.pitchRate * turnScale;
    const targetR = this.ctl.roll * s.rollRate * turnScale;
    let targetY = this.ctl.yaw * s.yawRate * turnScale;

    // bank-to-turn: rolled attitude induces yaw proportional to bank angle
    this.up(_up);
    this.right(_right);
    this.forward(_fwd);
    const bank = Math.atan2(_right.y, _up.y);
    const spd01 = THREE.MathUtils.clamp(this.speed / s.maxSpeed, 0, 1.4);
    targetY += -Math.sin(bank) * s.yawRate * 2.5 * THREE.MathUtils.clamp(spd01, 0.25, 1.2);

    const responsiveness = 1 / s.inertia;
    const k = 1 - Math.exp(-responsiveness * 9 * dt);
    this.angVel.x += (targetP - this.angVel.x) * k;
    this.angVel.y += (targetY - this.angVel.y) * k;
    this.angVel.z += (targetR - this.angVel.z) * k;

    // Assisted: auto-level roll and bleed pitch when hands-off
    if (assisted) {
      if (Math.abs(this.ctl.roll) < 0.12) {
        const ease = 1 - Math.abs(this.ctl.roll) / 0.12;
        this.angVel.z += -bank * 1.6 * dt * 6 * ease * THREE.MathUtils.clamp(spd01, 0.15, 1);
      }
      if (Math.abs(this.ctl.pitch) < 0.12 && Math.abs(bank) < 0.5) {
        const pitchErr = Math.asin(THREE.MathUtils.clamp(_fwd.y, -1, 1));
        this.angVel.x += -pitchErr * 1.0 * dt * 4;
      }
    }

    // stall: low airspeed => control authority collapses
    const stallSpeed = s.maxSpeed * 0.16;
    const authority = THREE.MathUtils.clamp(this.speed / stallSpeed, 0.12, 1);
    _v.copy(this.angVel).multiplyScalar(dt * authority);
    _q.setFromEuler(new THREE.Euler(_v.x, _v.y, _v.z, 'XYZ'));
    this.quaternion.multiply(_q).normalize();

    // --- linear dynamics --------------------------------------------------
    this.forward(_fwd);
    this.up(_up);

    const maxSpeed = s.maxSpeed * m.speed;
    let thrust = s.thrust * this.throttle * m.thrust;

    this.boosting = this.wantBoost && this.boostFuel > 0.5;
    if (this.boosting) {
      thrust += s.boostThrust * m.thrust;
      this.boostFuel = Math.max(0, this.boostFuel - s.boostDrain * dt);
    } else {
      this.boostFuel = Math.min(s.boostMax, this.boostFuel + s.boostRegen * dt);
    }

    const accel = _v.set(0, 0, 0);
    accel.addScaledVector(_fwd, thrust);

    // gravity
    accel.y -= 42;

    // lift: proportional to forward airspeed squared, along body-up
    const vf = this.velocity.dot(_fwd);
    const lift = THREE.MathUtils.clamp((vf * vf) / (maxSpeed * maxSpeed), 0, 1.6) * 44 * s.liftCoef;
    accel.addScaledVector(_up, lift);

    // drag: quadratic + induced drag from off-axis velocity (slip)
    const v = this.velocity;
    const spd = v.length();
    if (spd > 0.001) {
      const linear = spd / maxSpeed;
      const cd = (0.55 + (this.braking ? 3.4 : 0)) * m.drag;
      const dragMag = cd * linear * linear * maxSpeed * 1.15;
      accel.addScaledVector(v, -dragMag / spd);

      // slip damping: velocity is nudged toward the nose ("grip")
      const align = 1 - Math.exp(-dt * (3.2 + s.pitchRate * 1.1));
      _q.set(0, 0, 0, 1);
      const desired = _fwd.clone().multiplyScalar(spd);
      v.lerp(desired, align * 0.55);
    }

    v.addScaledVector(accel, dt);

    // hard speed clamp
    const sp = v.length();
    const hardMax = maxSpeed * (this.boosting ? 1.42 : 1.0);
    if (sp > hardMax) v.multiplyScalar(hardMax / sp);

    this.gLoad = THREE.MathUtils.lerp(this.gLoad, 1 + Math.abs(this.angVel.x) * spd * 0.006, 1 - Math.exp(-dt * 6));

    this.position.addScaledVector(v, dt);

    // --- terrain / sea interaction ---------------------------------------
    this.groundH = hf ? hf.height(this.position.x, this.position.z) : -9999;
    const floor = Math.max(this.groundH, SEA_LEVEL - 6) + 9;
    this.agl = this.position.y - floor;
    this.crashed = false;
    if (this.position.y < floor) {
      this.position.y = floor;
      // Anything more than a gentle skim is fatal: either a hard vertical
      // impact or ploughing into a slope with real speed on the clock.
      const impact = Math.max(0, -v.y);
      const speed = v.length();
      this.crashed = impact > 22 || speed > 95;
      this.lastImpact = Math.max(impact, speed * 0.5);
      if (v.y < 0) v.y = 0;
      v.multiplyScalar(0.72);
    }

    // ceiling
    if (this.position.y > 4200) {
      this.position.y = 4200;
      if (v.y > 0) v.y *= 0.2;
    }

    this.stallT = this.speed < stallSpeed ? this.stallT + dt : 0;
  }
}
