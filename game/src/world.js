// Nusa Air — the world: one island-hopper flight. The plane flies forward along its heading;
// everything ahead (islands, rings, clouds, the runway) sits in world coordinates and the plane
// moves through them. All steps are pure functions of the state and the input, so a fixed seed
// plus a fixed input script always gives the same flight (the screenshot scenes rely on this).
import { FLIGHT, WORLD, RUNWAY } from './config.js';
import { makeRandom, range, intRange, pick } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1 << 0; // flew through a score ring
export const EVENT_FUEL = 1 << 1; // flew through a fuel ring
export const EVENT_LANDED = 1 << 2; // touched down on the runway
export const EVENT_CRASH = 1 << 3; // hit the sea or terrain
export const EVENT_OVER = 1 << 4; // out of lives
export const EVENT_DELIVERY = 1 << 5; // finished a delivery (landing counted)

const ISLAND_NAMES = [
  'Pulau Senja', 'Pulau Karang', 'Pulau Ombak', 'Pulau Lumba', 'Pulau Angin',
  'Pulau Terumbu', 'Pulau Pasir', 'Pulau Nusa', 'Pulau Damai', 'Pulau Biru',
];

function makeIsland(rng, z, runway) {
  return {
    x: runway ? 0 : range(rng, -WORLD.corridor, WORLD.corridor),
    z,
    r: runway ? 220 : range(rng, WORLD.islandMinR, WORLD.islandMaxR),
    height: runway ? 0 : WORLD.islandHeight,
    hue: pick(rng, [0, 1, 2]),
    palms: intRange(rng, 3, 9),
    seed: rng(),
    runway: runway || false,
    name: pick(rng, ISLAND_NAMES),
  };
}

function makeRing(rng, z, kind, x, y) {
  return {
    x: x !== undefined ? x : range(rng, -260, 260),
    y: y !== undefined ? y : range(rng, 55, 130),
    z,
    r: WORLD.ringRadius,
    kind: kind || 'score',
    passed: false,
  };
}

function makeCloud(rng, z) {
  return {
    x: range(rng, -500, 500),
    y: range(rng, WORLD.cloudMinY, WORLD.cloudMaxY),
    z,
    r: range(rng, 40, 110),
    seed: rng(),
  };
}

export function createWorld(seed) {
  const world = {
    seed,
    rng: makeRandom(seed),
    time: 0,
    state: 'title', // title | play | paused | landed | over
    plane: {
      x: 0,
      alt: 110,
      dist: 0,
      heading: 0, // radians, 0 = north
      speed: FLIGHT.cruiseSpeed,
      throttle: 0.7,
      fuel: 100,
      bank: 0,
      pitch: 0,
      boosting: false,
    },
    islands: [],
    rings: [],
    clouds: [],
    runway: null, // { x, z, name } — the current delivery runway
    score: 0,
    lives: WORLD.maxLives,
    delivery: 1,
    ringsHit: 0,
    ringsNeeded: WORLD.ringsPerDelivery,
    message: '',
    messageTime: 0,
    landedAt: 0,
    respawnAt: 0,
    nextIslandZ: 0,
    nextRingZ: 0,
    nextCloudZ: 0,
    sunAngle: 0.6,
  };
  resetWorld(world);
  return world;
}

export function resetWorld(world) {
  world.rng = makeRandom(world.seed);
  world.time = 0;
  world.state = 'title';
  world.plane = {
    x: 0,
    alt: 110,
    dist: 0,
    heading: 0,
    speed: FLIGHT.cruiseSpeed,
    throttle: 0.7,
    fuel: 100,
    bank: 0,
    pitch: 0,
    boosting: false,
  };
  world.islands = [];
  world.rings = [];
  world.clouds = [];
  world.score = 0;
  world.lives = WORLD.maxLives;
  world.delivery = 1;
  world.ringsHit = 0;
  world.ringsNeeded = WORLD.ringsPerDelivery;
  world.message = '';
  world.messageTime = 0;
  world.landedAt = 0;
  world.respawnAt = 0;
  world.nextIslandZ = 500;
  world.nextRingZ = 700;
  world.nextCloudZ = 300;
  // The first runway island sits ahead; its rings lead the player to it.
  placeRunway(world, 2600);
  spawnAhead(world);
}

function placeRunway(world, z) {
  const island = makeIsland(world.rng, z, true);
  island.name = pick(world.rng, ISLAND_NAMES);
  world.islands.push(island);
  world.runway = { x: island.x, z: island.z, name: island.name };
  // Three score rings on the approach, then the strip.
  world.rings = [];
  const approach = [z - 1500, z - 1000, z - 500];
  for (const rz of approach) {
    world.rings.push(makeRing(world.rng, rz, 'score', range(world.rng, -60, 60), range(world.rng, 70, 110)));
  }
  // One green fuel ring off the approach line, for the pilot who looks for it.
  world.rings.push(makeRing(world.rng, z - 1200, 'fuel', range(world.rng, -240, 240), range(world.rng, 60, 120)));
  world.nextRingZ = z + 600;
}

// Fill the world out to the spawn horizon with islands and clouds.
function spawnAhead(world) {
  const horizon = world.plane.dist + WORLD.spawnAhead;
  while (world.nextIslandZ < horizon) {
    // Never spawn a plain island on top of the runway island.
    const z = world.nextIslandZ;
    if (world.runway === null || Math.abs(z - world.runway.z) > 500) {
      world.islands.push(makeIsland(world.rng, z, false));
    }
    world.nextIslandZ += range(world.rng, 420, 760);
  }
  while (world.nextCloudZ < horizon) {
    world.clouds.push(makeCloud(world.rng, world.nextCloudZ));
    world.nextCloudZ += range(world.rng, 260, 560);
  }
  while (world.nextRingZ < horizon) {
    // Extra score rings between deliveries, so there is always something to chase.
    if (world.rings.filter((r) => !r.passed).length < 6) {
      world.rings.push(makeRing(world.rng, world.nextRingZ, 'score'));
    }
    world.nextRingZ += range(world.rng, 700, 1200);
  }
  // Drop whatever is far behind.
  const behind = world.plane.dist - WORLD.cullBehind;
  world.islands = world.islands.filter((i) => i.z > behind);
  world.rings = world.rings.filter((r) => r.z > behind - 60);
  world.clouds = world.clouds.filter((c) => c.z > behind);
}

function say(world, text, seconds) {
  world.message = text;
  world.messageTime = seconds === undefined ? 2.2 : seconds;
}

function crash(world) {
  world.lives -= 1;
  world.plane.fuel = Math.max(world.plane.fuel, 0);
  if (world.lives <= 0) {
    world.state = 'over';
    return EVENT_CRASH | EVENT_OVER;
  }
  world.state = 'crashed';
  world.respawnAt = world.time + 1.6;
  return EVENT_CRASH;
}

function respawn(world) {
  const p = world.plane;
  p.x = 0;
  p.alt = 110;
  p.heading = 0;
  p.speed = FLIGHT.cruiseSpeed;
  p.throttle = 0.7;
  p.fuel = Math.max(p.fuel, 60);
  p.bank = 0;
  p.pitch = 0;
  world.state = 'play';
  say(world, `Back in the air — ${world.lives} ${world.lives === 1 ? 'life' : 'lives'} left`, 2.5);
}

// One physics step. `input` is { turn: -1..1, pitch: -1..1, throttle: -1..1, boost: bool }.
// Returns an event bitmask. Only runs while the state is 'play'.
export function stepWorld(world, input, dt) {
  if (world.state !== 'play') return EVENT_NONE;
  const p = world.plane;
  let events = EVENT_NONE;
  world.time += dt;
  if (world.messageTime > 0) world.messageTime -= dt;

  // --- Controls ---
  if (input.throttle !== 0) {
    p.throttle = Math.min(1, Math.max(0, p.throttle + input.throttle * FLIGHT.throttleStep * dt));
  }
  const targetSpeed = p.throttle * FLIGHT.maxSpeed + (input.boost ? FLIGHT.boostSpeed : 0);
  p.speed += (targetSpeed - p.speed) * Math.min(1, FLIGHT.speedLag * dt);
  p.boosting = input.boost === true;

  p.heading += input.turn * FLIGHT.turnRate * dt;
  p.bank += (input.turn * 0.5 - p.bank) * Math.min(1, 6 * dt);
  const climb = input.pitch * FLIGHT.climbRate;
  p.pitch += (input.pitch * 0.35 - p.pitch) * Math.min(1, 5 * dt);

  // Speed bleeds in a climb and grows in a dive; a slow wing sinks.
  const speedFactor = p.speed / FLIGHT.cruiseSpeed;
  let climbRate = climb * (0.55 + 0.45 * speedFactor);
  const stalled = p.speed < FLIGHT.minSpeed;
  if (stalled) climbRate -= FLIGHT.stallSink;
  p.alt += climbRate * dt;
  if (p.alt < 0) p.alt = 0;

  // Move forward along the heading; the world slides past.
  const speedMs = (p.speed * 1000) / 3600;
  p.x += Math.sin(p.heading) * speedMs * dt;
  p.dist += Math.cos(p.heading) * speedMs * dt;
  p.x = Math.max(-900, Math.min(900, p.x));

  // --- Fuel ---
  const drain = (p.throttle * FLIGHT.fuelDrain + (p.boosting ? FLIGHT.boostDrain : 0)) * 100 * dt;
  p.fuel = Math.max(0, p.fuel - drain);
  if (p.fuel <= WORLD.lowFuel && p.fuel > 0 && world.messageTime <= 0) {
    say(world, 'LOW FUEL — find a green ring or land', 2.0);
  }
  if (p.fuel <= 0 && p.throttle > 0) {
    p.throttle = 0;
    say(world, 'ENGINE OUT — glide to the runway', 2.5);
  }

  // Distance trickle of points.
  world.score += speedMs * dt * 0.02;

  // --- Rings: passed when their z crosses the plane and we are inside the circle. ---
  for (const ring of world.rings) {
    if (ring.passed) continue;
    const relZ = ring.z - p.dist;
    if (relZ > 12 || relZ < -12) continue;
    const dx = ring.x - p.x;
    const dy = ring.y - p.alt;
    const inside = Math.sqrt(dx * dx + dy * dy) <= ring.r + 10;
    if (inside) {
      ring.passed = true;
      if (ring.kind === 'fuel') {
        p.fuel = Math.min(100, p.fuel + WORLD.fuelRing);
        world.score += WORLD.fuelRingScore;
        say(world, `FUEL +${WORLD.fuelRing} — tank topped up`, 2.0);
        events |= EVENT_FUEL;
      } else {
        world.score += WORLD.ringScore;
        world.ringsHit += 1;
        say(world, `RING +${WORLD.ringScore}`, 1.4);
        events |= EVENT_RING;
      }
    } else if (relZ < -12) {
      ring.passed = true; // missed: it just sails past
    }
  }

  // --- Runway: land slow and low over the strip. ---
  const rw = world.runway;
  if (rw !== null) {
    const relZ = rw.z - p.dist;
    const overStrip = Math.abs(p.x - rw.x) < RUNWAY.width / 2 + 14 && relZ > -RUNWAY.length / 2 && relZ < RUNWAY.length / 2;
    if (overStrip && p.alt <= RUNWAY.landAlt && p.speed <= RUNWAY.landSpeed && p.alt >= 0) {
      const bonus = WORLD.deliveryBonus + (world.ringsHit >= world.ringsNeeded ? 150 : 0);
      world.score += bonus;
      p.fuel = 100;
      world.state = 'landed';
      world.landedAt = world.time;
      say(world, `DELIVERY ${world.delivery} COMPLETE +${bonus}`, 3.0);
      events |= EVENT_LANDED | EVENT_DELIVERY;
      return events;
    }
    // Too fast over the strip: overshoot, keep flying (no crash, just a missed chance).
    // Too low anywhere else over land: terrain.
    if (p.alt <= 0) {
      // On the sea, away from the strip.
      if (!overStrip) {
        return events | crash(world);
      }
    }
  }

  // --- Terrain: islands bite below their height. ---
  if (p.alt <= WORLD.islandHeight + 1) {
    for (const island of world.islands) {
      if (island.runway) continue; // the strip island is flat where it matters
      const dx = island.x - p.x;
      const dz = island.z - p.dist;
      if (Math.abs(dz) < island.r * 0.9 && Math.abs(dx) < island.r * 0.9) {
        const inside = Math.sqrt(dx * dx + dz * dz) < island.r * 0.85;
        if (inside) return events | crash(world);
      }
    }
  }

  // --- Sea: touching the water away from a runway is a crash. ---
  if (p.alt <= 0) {
    return events | crash(world);
  }

  spawnAhead(world);
  return events;
}

// After a crash, the world waits in 'crashed' until the respawn timer fires.
export function tickCrashed(world, dt) {
  if (world.state !== 'crashed') return;
  world.time += dt;
  if (world.time >= world.respawnAt) respawn(world);
}

// After a landing, the next delivery starts once the celebration has played.
export function tickLanded(world, dt) {
  if (world.state !== 'landed') return;
  world.time += dt;
  if (world.messageTime > 0) world.messageTime -= dt;
  if (world.time - world.landedAt < 2.6) return;
  world.delivery += 1;
  world.ringsHit = 0;
  const p = world.plane;
  p.x = 0;
  p.alt = 110;
  p.heading = 0;
  p.speed = FLIGHT.cruiseSpeed;
  p.throttle = 0.7;
  p.fuel = 100;
  p.bank = 0;
  p.pitch = 0;
  placeRunway(world, p.dist + 2600);
  world.state = 'play';
  say(world, `Delivery ${world.delivery} — fly the rings, land on ${world.runway.name}`, 3.0);
}

export function startFlight(world) {
  resetWorld(world);
  world.state = 'play';
  say(world, `Delivery 1 — fly the rings, land on ${world.runway.name}`, 3.2);
}

export function headingLabel(heading) {
  const deg = ((heading * 180) / Math.PI % 360 + 360) % 360;
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const name = names[Math.round(deg / 45) % 8];
  return { deg: Math.round(deg), name };
}
