// Nusa Air — input. Keyboard is the primary control; the mouse steers too.
// The game reads a fresh input snapshot every frame, so holding a key keeps acting.
const keys = new Set();
let mouseX = null; // last mouse x in canvas pixels, null when the mouse never moved
let mouseActive = false;

export function installInput(canvas, hooks) {
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    if (event.key === 'Enter' && hooks.onEnter !== undefined) hooks.onEnter();
    if (event.key === 'p' || event.key === 'P') {
      if (hooks.onPause !== undefined) hooks.onPause();
    }
    if (event.key === 'r' || event.key === 'R') {
      if (hooks.onRestart !== undefined) hooks.onRestart();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  });
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouseActive = true;
  });
  canvas.addEventListener('mouseleave', () => {
    mouseActive = false;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0 && hooks.onEnter !== undefined) hooks.onEnter();
  });
}

// The control snapshot for one frame: turn -1..1, pitch -1..1, throttle -1..1, boost bool.
export function readInput() {
  let turn = 0;
  let pitch = 0;
  let throttle = 0;
  if (keys.has('ArrowLeft') || keys.has('a')) turn -= 1;
  if (keys.has('ArrowRight') || keys.has('d')) turn += 1;
  if (keys.has('ArrowUp')) pitch += 1;
  if (keys.has('ArrowDown')) pitch -= 1;
  if (keys.has('w')) throttle += 1;
  if (keys.has('s')) throttle -= 1;
  // Mouse: hold the pointer left or right of centre to steer that way.
  if (mouseActive && mouseX !== null) {
    const centre = 640;
    const off = (mouseX - centre) / centre; // -1..1
    if (Math.abs(off) > 0.12) turn += Math.max(-1, Math.min(1, off));
  }
  turn = Math.max(-1, Math.min(1, turn));
  return { turn, pitch, throttle, boost: keys.has(' ') };
}
