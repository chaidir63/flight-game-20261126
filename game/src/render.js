// Nusa Air — drawing. A chase view: the camera rides behind and just above the plane, looking
// along its heading. Islands, rings, clouds and the runway are projected with one small
// perspective step; the plane itself is a drawn sprite, banked with the turn. The HUD is the
// instruments: altitude, speed, heading, fuel, throttle, score and the mission line.
import { VIEW, COLORS, RUNWAY, FLIGHT, WORLD } from './config.js';
import { headingLabel } from './world.js';

const CX = VIEW.width / 2;
const F = VIEW.focal;
const HORIZON = VIEW.horizon;

// Camera-space for a world point: forward along the heading, right across it.
function cameraSpace(plane, x, z) {
  const dx = x - plane.x;
  const dz = z - plane.dist;
  const sin = Math.sin(plane.heading);
  const cos = Math.cos(plane.heading);
  return {
    fwd: dx * sin + dz * cos,
    right: dx * cos - dz * sin,
  };
}

// Project a world point (x, y, z) to screen space. Returns null when behind the camera.
function project(plane, x, y, z) {
  const c = cameraSpace(plane, x, z);
  if (c.fwd < 3) return null;
  const scale = F / c.fwd;
  return {
    x: CX + c.right * scale,
    y: HORIZON + (plane.alt + 6 - y) * scale,
    s: scale,
    fwd: c.fwd,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSky(ctx, world) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 40);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(0.55, COLORS.skyMid);
  g.addColorStop(1, COLORS.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, HORIZON + 40);
  // Sun, upper middle-right, clear of the HUD panels, with a soft glow.
  const sx = 860;
  const sy = 108;
  const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 130);
  glow.addColorStop(0, 'rgba(255,243,196,0.95)');
  glow.addColorStop(0.35, 'rgba(255,243,196,0.35)');
  glow.addColorStop(1, 'rgba(255,243,196,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 140, sy - 140, 280, 280);
  ctx.fillStyle = COLORS.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, 34, 0, Math.PI * 2);
  ctx.fill();
}

function drawSea(ctx, world) {
  const g = ctx.createLinearGradient(0, HORIZON, 0, VIEW.height);
  g.addColorStop(0, COLORS.seaTop);
  g.addColorStop(1, COLORS.seaDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, HORIZON, VIEW.width, VIEW.height - HORIZON);
  // Wave streaks: fixed world distances, so they stream past as you fly.
  ctx.strokeStyle = COLORS.wave;
  ctx.lineWidth = 2;
  const plane = world.plane;
  for (let z = 140; z < 3200; z += 150) {
    const rel = z - (plane.dist % 150);
    const p = project(plane, 0, 0, plane.dist + rel);
    if (p === null || p.y < HORIZON + 4 || p.y > VIEW.height) continue;
    const width = Math.min(VIEW.width, 240 + p.s * 260);
    ctx.globalAlpha = Math.max(0.08, Math.min(0.4, 900 / p.fwd));
    ctx.beginPath();
    const wob = Math.sin((plane.dist + rel) * 0.05) * 8;
    ctx.moveTo(CX - width / 2 + wob, p.y);
    ctx.lineTo(CX + width / 2 + wob, p.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCloud(ctx, world, cloud) {
  const p = project(world.plane, cloud.x, cloud.y, cloud.z);
  if (p === null || p.x < -160 || p.x > VIEW.width + 160) return;
  const r = cloud.r * p.s;
  if (r < 2) return;
  ctx.fillStyle = COLORS.cloud;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.ellipse(p.x - r * 0.55, p.y + r * 0.1, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
  ctx.ellipse(p.x + r * 0.55, p.y + r * 0.08, r * 0.65, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawIsland(ctx, world, island) {
  const plane = world.plane;
  const p = project(plane, island.x, 0, island.z);
  if (p === null) return;
  const rx = island.r * p.s;
  if (rx < 1.5 || p.x < -rx - 40 || p.x > VIEW.width + rx + 40) return;
  const ry = rx * 0.3;
  // Sand rim.
  ctx.fillStyle = COLORS.sand;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Green body.
  ctx.fillStyle = island.hue === 0 ? COLORS.grass : island.hue === 1 ? COLORS.grassDark : COLORS.hill;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - ry * 0.12, rx * 0.78, ry * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  // A low hill bump for depth.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(p.x - rx * 0.15, p.y - ry * 0.3, rx * 0.42, ry * 0.4, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // Palms when close enough to see them.
  if (rx > 22) {
    ctx.strokeStyle = '#1e5c26';
    ctx.lineWidth = Math.max(1, rx * 0.02);
    for (let i = 0; i < island.palms; i += 1) {
      const a = ((island.seed * 997 + i * 2.399) % (Math.PI * 2));
      const px = p.x + Math.cos(a) * rx * 0.5;
      const py = p.y - ry * 0.2 + Math.sin(a) * ry * 0.4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - rx * 0.09);
      ctx.stroke();
      ctx.fillStyle = '#2f7d32';
      ctx.beginPath();
      ctx.arc(px, py - rx * 0.1, rx * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Island name, when it is big on screen.
  if (rx > 60) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${Math.max(12, Math.min(20, rx * 0.14))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(island.name, p.x, p.y - ry - 8);
  }
}

function drawRunway(ctx, world) {
  const plane = world.plane;
  const rw = world.runway;
  if (rw === null) return;
  const halfW = RUNWAY.width / 2;
  const halfL = RUNWAY.length / 2;
  const corners = [
    project(plane, rw.x - halfW, 0, rw.z - halfL),
    project(plane, rw.x + halfW, 0, rw.z - halfL),
    project(plane, rw.x + halfW, 0, rw.z + halfL),
    project(plane, rw.x - halfW, 0, rw.z + halfL),
  ];
  if (corners.some((c) => c === null)) return;
  ctx.fillStyle = COLORS.runway;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes, sampled along the strip.
  ctx.fillStyle = COLORS.runwayMark;
  const steps = 9;
  for (let i = 0; i < steps; i += 1) {
    const t0 = -halfL + (i * RUNWAY.length) / steps;
    const t1 = t0 + RUNWAY.length / steps / 2;
    const a = project(plane, rw.x, 0, rw.z + t0);
    const b = project(plane, rw.x, 0, rw.z + t1);
    if (a === null || b === null) continue;
    const w = Math.max(1.5, 3 * a.s);
    ctx.fillRect(a.x - w / 2, Math.min(a.y, b.y), w, Math.abs(b.y - a.y) + 1);
  }
  // Threshold bars at the near end.
  const near = project(plane, rw.x, 0, rw.z - halfL);
  if (near !== null) {
    const w = Math.max(2, 8 * near.s);
    ctx.fillRect(near.x - halfW * near.s * 0.8, near.y - 4, w * 1.6, 4);
  }
  // Windsock on the side.
  const sock = project(plane, rw.x + halfW + 26, 0, rw.z - halfL + 40);
  if (sock !== null && sock.s > 0.02) {
    const h = 34 * sock.s;
    ctx.strokeStyle = '#c8ccd4';
    ctx.lineWidth = Math.max(1, 2 * sock.s);
    ctx.beginPath();
    ctx.moveTo(sock.x, sock.y);
    ctx.lineTo(sock.x, sock.y - h);
    ctx.stroke();
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(sock.x, sock.y - h);
    ctx.lineTo(sock.x + 16 * sock.s, sock.y - h + 4 * sock.s);
    ctx.lineTo(sock.x, sock.y - h + 8 * sock.s);
    ctx.closePath();
    ctx.fill();
  }
  // Runway label when it is near.
  const mid = project(plane, rw.x, 0, rw.z);
  if (mid !== null && mid.s > 0.06) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`RWY ${rw.name}`, mid.x, mid.y - 26);
  }
}

function drawRing(ctx, world, ring) {
  if (ring.passed) return;
  const p = project(world.plane, ring.x, ring.y, ring.z);
  if (p === null || p.x < -120 || p.x > VIEW.width + 120) return;
  const pr = ring.r * p.s;
  if (pr < 2) return;
  const color = ring.kind === 'fuel' ? COLORS.ringFuel : COLORS.ringScore;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.min(26, pr * 0.5);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2.5, pr * 0.14);
  ctx.beginPath();
  ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1, pr * 0.04);
  ctx.beginPath();
  ctx.arc(p.x, p.y, pr * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if (pr > 14) {
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.max(11, Math.min(18, pr * 0.28))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(ring.kind === 'fuel' ? 'FUEL' : 'RING', p.x, p.y - pr - 8);
  }
}

// The aircraft, drawn from behind and slightly above, banked with the turn.
function drawPlane(ctx, world) {
  const p = world.plane;
  const x = VIEW.planeX;
  const y = VIEW.planeY;
  const bank = p.bank;
  const pitch = p.pitch;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bank);
  ctx.scale(1, 1 - pitch * 0.25);
  // Soft shadow on the sea below.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 118, 66, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wings.
  ctx.fillStyle = COLORS.planeBody;
  ctx.strokeStyle = '#b9c4cc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, 8);
  ctx.lineTo(-96, 26);
  ctx.lineTo(-96, 38);
  ctx.lineTo(-12, 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(14, 8);
  ctx.lineTo(96, 26);
  ctx.lineTo(96, 38);
  ctx.lineTo(12, 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Red wingtips.
  ctx.fillStyle = COLORS.planeStripe;
  ctx.fillRect(-96, 26, 12, 12);
  ctx.fillRect(84, 26, 12, 12);
  // Tailplane.
  ctx.fillStyle = COLORS.planeBody;
  ctx.beginPath();
  ctx.moveTo(-8, -34);
  ctx.lineTo(-34, -26);
  ctx.lineTo(-34, -18);
  ctx.lineTo(-8, -20);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, -34);
  ctx.lineTo(34, -26);
  ctx.lineTo(34, -18);
  ctx.lineTo(8, -20);
  ctx.closePath();
  ctx.fill();
  // Vertical fin with the NUSA mark.
  ctx.fillStyle = COLORS.planeStripe;
  ctx.beginPath();
  ctx.moveTo(-7, -34);
  ctx.lineTo(0, -62);
  ctx.lineTo(7, -34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('N', 0, -40);
  // Fuselage.
  ctx.fillStyle = COLORS.planeBody;
  ctx.beginPath();
  ctx.moveTo(-13, -30);
  ctx.quadraticCurveTo(-16, 6, -11, 34);
  ctx.quadraticCurveTo(0, 42, 11, 34);
  ctx.quadraticCurveTo(16, 6, 13, -30);
  ctx.quadraticCurveTo(0, -40, -13, -30);
  ctx.fill();
  ctx.strokeStyle = '#b9c4cc';
  ctx.stroke();
  // Red cheatline.
  ctx.fillStyle = COLORS.planeStripe;
  ctx.fillRect(-14, 12, 28, 6);
  // Cockpit windows.
  ctx.fillStyle = COLORS.planeGlass;
  ctx.beginPath();
  ctx.moveTo(-9, -24);
  ctx.lineTo(9, -24);
  ctx.lineTo(7, -12);
  ctx.lineTo(-7, -12);
  ctx.closePath();
  ctx.fill();
  // Spinning prop blur at the nose (top, since we look from behind).
  const spin = (world.time * 22) % Math.PI;
  ctx.fillStyle = COLORS.planeProp;
  ctx.save();
  ctx.translate(0, -44);
  ctx.rotate(spin);
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#2a3542';
  ctx.beginPath();
  ctx.arc(0, -44, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.hudPanel;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(127,227,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawHUD(ctx, world) {
  const p = world.plane;
  const hdg = headingLabel(p.heading);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Top-left: the flight instruments.
  panel(ctx, 16, 16, 250, 108);
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 13px monospace';
  ctx.fillText('ALTITUDE', 30, 40);
  ctx.fillText('SPEED', 30, 70);
  ctx.fillText('HEADING', 30, 100);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 24px monospace';
  ctx.fillText(`${Math.round(p.alt)} m`, 150, 42);
  ctx.fillText(`${Math.round(p.speed)} km/h`, 150, 72);
  ctx.fillText(`${String(hdg.deg).padStart(3, '0')}° ${hdg.name}`, 150, 102);
  // Top-centre: heading tape.
  panel(ctx, CX - 150, 16, 300, 44);
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  for (let i = -2; i <= 2; i += 1) {
    const idx = (((Math.round(hdg.deg / 45) + i) % 8) + 8) % 8;
    const alpha = i === 0 ? 1 : 0.55;
    ctx.globalAlpha = alpha;
    ctx.fillText(names[idx], CX + i * 58, 44);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.hudWarn;
  ctx.fillText('▲', CX, 30);
  // Top-right: score and mission.
  panel(ctx, VIEW.width - 266, 16, 250, 108);
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 13px monospace';
  ctx.fillText('SCORE', VIEW.width - 252, 40);
  ctx.fillText('DELIVERY', VIEW.width - 252, 70);
  ctx.fillText('RINGS', VIEW.width - 252, 100);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 24px monospace';
  ctx.fillText(`${Math.floor(world.score)}`, VIEW.width - 150, 42);
  ctx.fillText(`${world.delivery}`, VIEW.width - 150, 72);
  ctx.fillText(`${world.ringsHit}/${world.ringsNeeded}`, VIEW.width - 150, 102);
  // Bottom-left: fuel and throttle bars.
  panel(ctx, 16, VIEW.height - 108, 250, 92);
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 13px monospace';
  ctx.fillText('FUEL', 30, VIEW.height - 82);
  ctx.fillText('THR', 30, VIEW.height - 44);
  const fuelW = 150 * Math.max(0, p.fuel / 100);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(84, VIEW.height - 94, 150, 14);
  ctx.fillStyle = p.fuel <= 25 ? COLORS.hudBad : p.fuel <= 50 ? COLORS.hudWarn : COLORS.hudGood;
  ctx.fillRect(84, VIEW.height - 94, fuelW, 14);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`${Math.round(p.fuel)}%`, 240 - 6, VIEW.height - 81);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(84, VIEW.height - 56, 150, 14);
  ctx.fillStyle = COLORS.hudAccent;
  ctx.fillRect(84, VIEW.height - 56, 150 * p.throttle, 14);
  ctx.fillStyle = COLORS.hudText;
  ctx.fillText(`${Math.round(p.throttle * 100)}%`, 234, VIEW.height - 43);
  if (p.boosting) {
    ctx.fillStyle = COLORS.hudWarn;
    ctx.font = 'bold 13px monospace';
    ctx.fillText('BOOST', 84, VIEW.height - 22);
  }
  // Bottom-right: lives as little planes.
  panel(ctx, VIEW.width - 266, VIEW.height - 108, 250, 92);
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 13px monospace';
  ctx.fillText('LIVES', VIEW.width - 252, VIEW.height - 82);
  for (let i = 0; i < WORLD.maxLives; i += 1) {
    const lx = VIEW.width - 240 + i * 44;
    const ly = VIEW.height - 56;
    ctx.fillStyle = i < world.lives ? COLORS.hudText : 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(lx, ly - 12);
    ctx.lineTo(lx + 16, ly + 8);
    ctx.lineTo(lx, ly + 4);
    ctx.lineTo(lx - 16, ly + 8);
    ctx.closePath();
    ctx.fill();
  }
  // Bottom-centre: the mission line.
  const mission = world.runway !== null
    ? `DELIVERY ${world.delivery} — fly ${world.ringsNeeded} rings, then land on ${world.runway.name}`
    : `DELIVERY ${world.delivery} — fly the rings, then land`;
  ctx.font = 'bold 16px monospace';
  const mw = ctx.measureText(mission).width;
  panel(ctx, CX - mw / 2 - 16, VIEW.height - 52, mw + 32, 36);
  ctx.fillStyle = COLORS.hudText;
  ctx.textAlign = 'center';
  ctx.fillText(mission, CX, VIEW.height - 28);
  // Centre message.
  if (world.messageTime > 0 && world.message !== '') {
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(world.message, CX, 210);
    ctx.shadowBlur = 0;
  }
  // Stall warning.
  if (world.state === 'play' && p.speed < FLIGHT.minSpeed) {
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = COLORS.hudBad;
    ctx.textAlign = 'center';
    ctx.fillText('STALL — THROTTLE UP', CX, 260);
  }
}

function drawTitle(ctx, world) {
  ctx.fillStyle = 'rgba(4,18,30,0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px monospace';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 16;
  ctx.fillText('NUSA AIR', CX, 250);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 26px monospace';
  ctx.fillText('ISLAND HOPPER — a bush-pilot delivery game', CX, 296);
  panel(ctx, CX - 330, 340, 660, 190);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '17px monospace';
  ctx.fillText('Fly the rings, then land on the runway to finish each delivery.', CX, 378);
  ctx.fillText('Green rings refuel. Watch the fuel gauge — an empty tank glides.', CX, 408);
  ctx.fillText('Three lives. Crashes cost one. Landings pay 500 points.', CX, 438);
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 17px monospace';
  ctx.fillText('← → turn      ↑ ↓ climb / descend      W / S throttle', CX, 478);
  ctx.fillText('Mouse steers too      SPACE boost      P pause      R restart', CX, 504);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px monospace';
  const blink = Math.floor(world.time * 2) % 2 === 0;
  if (blink) ctx.fillText('PRESS ENTER TO FLY', CX, 600);
}

function drawOver(ctx, world) {
  ctx.fillStyle = 'rgba(4,18,30,0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px monospace';
  ctx.fillText('OUT OF LIVES', CX, 320);
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 28px monospace';
  ctx.fillText(`Final score ${Math.floor(world.score)} — ${world.delivery - 1} ${world.delivery - 1 === 1 ? 'delivery' : 'deliveries'} done`, CX, 380);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('PRESS R TO FLY AGAIN', CX, 460);
}

function drawPaused(ctx, world) {
  ctx.fillStyle = 'rgba(4,18,30,0.5)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px monospace';
  ctx.fillText('PAUSED', CX, 380);
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 22px monospace';
  ctx.fillText('Press P to resume', CX, 430);
}

export function render(ctx, world) {
  drawSky(ctx, world);
  drawSea(ctx, world);
  // Far to near: clouds, then islands, the runway, then rings.
  const sortedClouds = [...world.clouds].sort((a, b) => (b.z - world.plane.dist) - (a.z - world.plane.dist));
  for (const cloud of sortedClouds) drawCloud(ctx, world, cloud);
  const sortedIslands = [...world.islands].sort((a, b) => (b.z - world.plane.dist) - (a.z - world.plane.dist));
  for (const island of sortedIslands) drawIsland(ctx, world, island);
  drawRunway(ctx, world);
  const sortedRings = [...world.rings].sort((a, b) => (b.z - world.plane.dist) - (a.z - world.plane.dist));
  for (const ring of sortedRings) drawRing(ctx, world, ring);
  drawPlane(ctx, world);
  if (world.state !== 'title') drawHUD(ctx, world);
  if (world.state === 'title') drawTitle(ctx, world);
  if (world.state === 'over') drawOver(ctx, world);
  if (world.state === 'paused') drawPaused(ctx, world);
}
