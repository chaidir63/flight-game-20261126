// Nusa Air — island-hopper flight game. All the numbers the rest of the game shares.
// Canvas is a fixed 1280x800 stage; the page scales it to the window.
export const VIEW = {
  width: 1280,
  height: 800,
  horizon: 336, // screen y of the horizon line
  planeX: 640, // screen x of the aircraft (centre)
  planeY: 576, // screen y of the aircraft (lower third)
  focal: 520, // perspective focal length in pixels
};

// Flight model (arcade, not a sim): speeds in km/h, altitudes in metres, distances in metres.
export const FLIGHT = {
  minSpeed: 55, // below this the wing stops flying and the plane sinks
  maxSpeed: 260, // flat out, full throttle and a dive
  cruiseSpeed: 150, // comfortable cruise at 70% throttle
  turnRate: 0.55, // radians per second at full deflection
  climbRate: 26, // metres per second at full pitch up
  sinkRate: 30, // metres per second at full pitch down
  stallSink: 18, // extra sink per second while stalled
  // Throttle: W/S move it; speed chases throttle * maxSpeed with a lag.
  throttleStep: 0.55, // per second held
  speedLag: 0.45, // fraction of the gap closed per second
  // Fuel: 100 units. Drains with throttle; a fuel ring gives +25, a landing refills.
  fuelDrain: 0.011, // per second at full throttle
  fuelRing: 25,
  lowFuel: 25,
  boostDrain: 0.02, // extra per second while boosting (Space)
  boostSpeed: 40, // extra km/h while boosting
};

// The world ahead of the plane: how far we keep objects, and how wide the corridor is.
export const WORLD = {
  spawnAhead: 4200, // metres ahead we keep islands, rings and clouds spawned
  cullBehind: 120, // metres behind the plane before an object is dropped
  corridor: 420, // half-width in metres; islands spawn inside this
  islandMinR: 70,
  islandMaxR: 190,
  islandHeight: 6, // metres; terrain only bites when you are very low
  cloudMinY: 170,
  cloudMaxY: 320,
  ringRadius: 26, // metres; the ring you fly through
  ringScore: 100,
  fuelRingScore: 50,
  deliveryBonus: 500,
  ringsPerDelivery: 3,
  maxLives: 3,
};

// The runway: a strip on one island per delivery, always along heading north (0 rad).
export const RUNWAY = {
  length: 420, // metres
  width: 34, // metres
  // Landing window: slow and low over the strip.
  landAlt: 12, // metres above the ground
  landSpeed: 145, // km/h; faster and you overshoot the strip
};

// Colours for the tropical late-afternoon look.
export const COLORS = {
  skyTop: '#1d6fb8',
  skyMid: '#7ec8e3',
  skyHorizon: '#ffe9bf',
  sun: '#fff3c4',
  seaTop: '#0f5f7d',
  seaDeep: '#0a3d5c',
  wave: 'rgba(255,255,255,0.35)',
  sand: '#e8d8a0',
  grass: '#4a9e4d',
  grassDark: '#2f7d32',
  hill: '#3d8b40',
  runway: '#3a3f4a',
  runwayMark: '#f5f5f5',
  ringScore: '#f6ad55',
  ringFuel: '#48bb78',
  ringGlow: 'rgba(246,173,85,0.35)',
  cloud: 'rgba(255,255,255,0.92)',
  hudPanel: 'rgba(6,24,38,0.72)',
  hudText: '#e8f6ff',
  hudAccent: '#7fe3ff',
  hudWarn: '#ffb020',
  hudBad: '#ff5a5a',
  hudGood: '#7dff9e',
  planeBody: '#f2f5f7',
  planeStripe: '#e0393e',
  planeGlass: '#17324a',
  planeProp: 'rgba(30,40,55,0.45)',
};
