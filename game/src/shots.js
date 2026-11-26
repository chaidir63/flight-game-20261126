// Nusa Air — the screenshot scenes behind ?shot=cover|flight|landing. Each one plays the real
// rules forward from a fresh world for a fixed time, steered by a simple autopilot (turn toward
// the next ring, hold its altitude, slow and descend for the runway), so the frame is what a
// real flight looks like and the same seed always gives the same frame.
import { FLIGHT } from './config.js';
import { createWorld, resetWorld, stepWorld, tickCrashed, tickLanded } from './world.js';

const STEP = 1 / 60;
const COVER_SECONDS = 36;
const FLIGHT_SECONDS = 58;

/** The next thing to fly at: an unpassed ring, else the runway. */
function targetOf(world) {
  for (const ring of world.rings) {
    if (!ring.passed) return { x: ring.x, y: ring.y, z: ring.z, ring: true };
  }
  const rw = world.runway;
  if (rw !== null) return { x: rw.x, y: 0, z: rw.z, ring: false };
  return null;
}

/** Steer toward the target: turn to its bearing, hold its height, ease off near the strip. */
function autopilot(world) {
  const p = world.plane;
  const target = targetOf(world);
  if (target === null) return { turn: 0, pitch: 0, throttle: 0, boost: false };
  const relZ = target.z - p.dist;
  const bearing = Math.atan2(target.x - p.x, Math.max(1, relZ));
  let headingError = bearing - p.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const turn = Math.max(-1, Math.min(1, headingError * 2.2));
  let desiredAlt;
  let desiredThrottle = 0.7;
  if (target.ring) {
    desiredAlt = target.y;
  } else {
    // Glide slope to the strip: lose height as the runway nears, slow down for it.
    desiredAlt = Math.max(6, relZ * 0.055);
    desiredThrottle = relZ < 700 ? 0.42 : 0.6;
  }
  const pitch = Math.max(-1, Math.min(1, (desiredAlt - p.alt) * 0.045));
  const throttle = Math.max(-1, Math.min(1, (desiredThrottle - p.throttle) * 2.5));
  return { turn, pitch, throttle, boost: false };
}

/** Run the world forward for `seconds` of autopilot flight. */
function flyFor(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.state === 'play') {
      stepWorld(world, autopilot(world), STEP);
    } else if (world.state === 'crashed') {
      tickCrashed(world, STEP);
    } else if (world.state === 'landed') {
      tickLanded(world, STEP);
      if (world.state === 'play') break;
    } else {
      break;
    }
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * cover: mid-flight, a ring ahead and the runway island in the distance.
 * flight: deeper in, close to a ring and an island, clouds around.
 * landing: flown all the way to the strip (or the approach, if it overshoots).
 */
export function stageShot(name, world) {
  resetWorld(world);
  world.state = 'play';
  if (name === 'landing') {
    // Final approach, staged: the rings of this delivery are already flown (the HUD shows
    // 3/3), the plane is put on the glide path 480 m out, low and slow and lined up with
    // the strip, then flown forward a few seconds by the autopilot so the frame is a live
    // moment of the approach, not a posed picture.
    const p = world.plane;
    const rw = world.runway;
    for (const ring of world.rings) ring.passed = true;
    world.ringsHit = world.ringsNeeded;
    world.nextRingZ = 1e9; // no fresh rings mid-approach: the runway is the target
    p.dist = rw.z - 480;
    p.x = rw.x;
    p.alt = 30;
    p.heading = 0;
    p.speed = 125;
    p.throttle = 0.45;
    p.fuel = 45;
    p.bank = 0;
    p.pitch = 0;
    flyFor(world, 2.5);
    return { screen: 'play', best: Math.floor(world.score), landed: false };
  }
  const seconds = name === 'flight' ? FLIGHT_SECONDS : COVER_SECONDS;
  flyFor(world, seconds);
  return { screen: 'play', best: Math.floor(world.score), landed: false };
}

export { createWorld };
