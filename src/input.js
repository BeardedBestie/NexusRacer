import { IS_TOUCH } from './touch.js';

export class Input {
  constructor(domElement) {
    this.dom = domElement;
    // Pointer lock is meaningless on a touch device — and worse, the unlock
    // callback would pause the game the moment a finger lifts.
    this.usePointerLock = !IS_TOUCH;
    this.keys = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.buttons = new Set();
    this.locked = false;
    this.sensitivity = 1.0;
    this.invertY = false;
    this._justPressed = new Set();

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const c = e.code;
      this.keys.add(c);
      this._justPressed.add(c);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(c)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.buttons.clear(); });

    domElement.addEventListener('mousedown', (e) => {
      // A tap on a touchscreen also synthesises a left mousedown; letting that
      // through would fire the primary every time a finger brushed the glass.
      if (IS_TOUCH) return;
      this.buttons.add(e.button);
      if (!this.locked) this.requestLock();
    });
    addEventListener('mouseup', (e) => this.buttons.delete(e.button));
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) this.onUnlock?.();
    });
  }

  requestLock() { if (this.usePointerLock) this.dom.requestPointerLock?.(); }
  releaseLock() { document.exitPointerLock?.(); }

  down(code) { return this.keys.has(code); }
  pressed(code) { return this._justPressed.has(code); }
  mouse(b) { return this.buttons.has(b); }

  axis(negCode, posCode) {
    return (this.down(posCode) ? 1 : 0) - (this.down(negCode) ? 1 : 0);
  }

  // Consume per-frame deltas
  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return [dx, dy];
  }

  endFrame() { this._justPressed.clear(); }
}
