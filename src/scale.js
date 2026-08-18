/**
 * World scale, in one place.
 *
 * The hulls are the best-looking thing in the game, so they are deliberately
 * oversized relative to a realistic aircraft — think capital ship, not fighter
 * jet. Optics are tuned for readability rather than plausibility: the chase
 * camera pulls back *less* than linearly with hull size and the field of view
 * is tighter than a sim would use, so a bigger ship genuinely fills more of the
 * frame instead of just sitting further away.
 */

export const SHIP_LENGTH = 260;              // nose-to-tail, world units
export const SHIP_RADIUS = SHIP_LENGTH * 0.46;

// Chase camera. Roughly 6x the old distance against a 10x hull, so the ship
// reads about twice as large on screen as it used to.
export const CAM_BACK = 520;
export const CAM_UP = 88;
export const CAM_BACK_FAR = 980;
export const CAM_UP_FAR = 190;
export const CAM_LOOK_AHEAD = 2600;
export const CAM_GROUND_CLEAR = 140;

export const FOV_BASE = 60;                  // tighter than the old 70 = more magnification
export const FOV_SPEED = 14;
export const FOV_BOOST = 10;

export const GROUND_CLEAR = 95;              // hull half-height for terrain contact
export const MUZZLE_FWD = 150;

// Ordnance and effects, sized against the hull rather than the old scale.
export const BOLT_SCALE = 4.2;
export const MISSILE_SCALE = 6;
export const FX_SCALE = 3.6;

// Other craft, as a multiple of the player's hull.
export const HOSTILE_SCALE = 1.3;
export const RACER_SCALE = 1.15;

export const GATE_RADIUS = 430;              // a 260m hull has to fly through it

/**
 * The hangar preview is its own little diorama with its own units — sized for
 * presentation, independent of in-flight scale.
 */
export const HANGAR_SHIP_LENGTH = 52;
