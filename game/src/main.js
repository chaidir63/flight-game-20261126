// Nusa Air — boot and the game loop. A normal visit plays the game; a ?shot=cover|flight|
// landing visit stages that screenshot scene, draws one frame, and raises window.__shotReady
// so the screenshot tool knows the frame is real and finished.
import { VIEW } from './config.js';
import { createWorld, startFlight, stepWorld, tickCrashed, tickLanded } from './world.js';
import { render } from './render.js';
import { installInput, readInput } from './input.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '7', 10);
const seed = Number.isFinite(seedParam) ? seedParam : 7;

const world = createWorld(seed);
let paused = false;

installInput(canvas, {
  onEnter() {
    if (world.state === 'title') startFlight(world);
    else if (world.state === 'over') startFlight(world);
  },
  onPause() {
    if (world.state === 'play') {
      world.state = 'paused';
      paused = true;
    } else if (world.state === 'paused') {
      world.state = 'play';
      paused = false;
    }
  },
  onRestart() {
    if (world.state === 'over' || world.state === 'play' || world.state === 'paused') {
      startFlight(world);
      paused = false;
    }
  },
});

// A screenshot visit: stage the scene, draw it once, and signal readiness.
if (shotName !== null) {
  const staged = stageShot(shotName, world);
  world.state = 'play';
  render(ctx, world);
  window.__shotReady = true;
  window.__shotInfo = { name: shotName, score: staged.best, landed: staged.landed };
} else {
  // The live game: fixed-step physics, render every animation frame.
  const STEP = 1 / 60;
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      if (!paused) {
        if (world.state === 'play') stepWorld(world, readInput(), STEP);
        else if (world.state === 'crashed') tickCrashed(world, STEP);
        else if (world.state === 'landed') tickLanded(world, STEP);
        else world.time += STEP; // title screen: let the sun shimmer and the prop spin
      }
    }
    render(ctx, world);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
