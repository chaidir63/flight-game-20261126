// Nusa Air — take the entry's screenshots with the Chrome already on this machine, driven
// over the DevTools protocol with Node's own WebSocket: no Playwright, no Chromium download,
// no npm install.
//
//   node tools/shoot.mjs           all three scenes from shots.json
//   node tools/shoot.mjs cover     just one, for iterating
//
// The game is loaded straight from disk (file://) at 1280x800; each ?shot= URL stages its
// scene, waits for window.__shotReady, and is captured as a JPEG at quality 80. It fails
// loudly on any console error, page error or failed request, and on anything leaving the disk.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const here = fileURLToPath(new URL('..', import.meta.url));
const gameRoot = resolve(join(here, 'game'));
const shotsFile = join(here, 'shots.json');
const outDir = join(here, 'screenshots');
const CHROME = process.env.CHROME_PATH ?? '/opt/meta-chromium/chrome';
const WIDTH = 1280;
const HEIGHT = 800;
const QUALITY = 80;
const MAX_BYTES = 256 * 1024;

// This machine's Chromium is a HATCH build: it refuses to start without a "WebGL domain
// policy" file, so the launch below writes one and hands Chrome its SHA-256. The policy only
// decides which origins may use WebGL; this game is plain Canvas 2D and never touches WebGL.
const POLICY_NAME = 'webgl-domains.txt';
const POLICY_BODY = 'hatch-webgl-all-origins-v1\n';

function connect(wsUrl) {
  return new Promise((done, fail) => {
    const socket = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    const listeners = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data));
      if (message.id !== undefined) {
        const entry = pending.get(message.id);
        if (entry === undefined) return;
        pending.delete(message.id);
        if (message.error) entry.fail(new Error(`${entry.method}: ${message.error.message}`));
        else entry.done(message.result);
        return;
      }
      const bucket = listeners.get(message.method);
      if (bucket !== undefined) for (const listener of bucket) listener(message.params);
    });
    socket.addEventListener('error', () => fail(new Error('the devtools websocket failed')));
    socket.addEventListener('open', () => {
      done({
        send(method, params, sessionId) {
          return new Promise((res, rej) => {
            const id = nextId++;
            pending.set(id, { done: res, fail: rej, method });
            socket.send(JSON.stringify({ id, method, params: params ?? {}, sessionId }));
          });
        },
        on(method, listener) {
          if (!listeners.has(method)) listeners.set(method, []);
          listeners.get(method).push(listener);
        },
        close() {
          socket.close();
        },
      });
    });
  });
}

function launchChrome(profileDir, policyPath) {
  const policySha = createHash('sha256').update(readFileSync(policyPath)).digest('hex');
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${WIDTH},${HEIGHT}`,
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      `--hatch-webgl-allowed-domains-file=${policyPath}`,
      `--hatch-webgl-allowed-domains-sha256=${policySha}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights',
      '--disable-web-security',
      '--allow-file-access-from-files',
      '--mute-audio',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  child.stderr.setEncoding('utf8');
  const address = new Promise((done, fail) => {
    let buffer = '';
    const timer = setTimeout(() => fail(new Error(`chrome printed no devtools address:\n${buffer.slice(-900)}`)), 30000);
    child.stderr.on('data', (chunk) => {
      buffer += chunk;
      const match = buffer.match(/ws:\/\/[^\s]+/);
      if (match !== null) {
        clearTimeout(timer);
        done(match[0]);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      fail(new Error(`chrome exited with code ${code} before it was ready:\n${buffer.slice(-900)}`));
    });
  });
  return { child, address };
}

async function main() {
  const only = process.argv[2];
  const shots = JSON.parse(readFileSync(shotsFile, 'utf8')).filter(
    (shot) => only === undefined || shot.name.includes(only) || shot.query.includes(only),
  );
  if (shots.length === 0) throw new Error(`no shot matches "${only}"`);
  if (!existsSync(CHROME)) throw new Error(`chrome not found at ${CHROME}`);
  mkdirSync(outDir, { recursive: true });

  const profileDir = join(here, '.chrome-profile');
  mkdirSync(profileDir, { recursive: true });
  const policyPath = join(profileDir, POLICY_NAME);
  writeFileSync(policyPath, POLICY_BODY);

  const fileBase = pathToFileURL(join(gameRoot, 'index.html')).href;
  const fileRoot = pathToFileURL(gameRoot).href;
  const { child, address } = launchChrome(profileDir, policyPath);
  const browser = await connect(await address);

  const failures = [];
  const requests = [];
  const report = [];

  function watchErrors(session, into) {
    browser.on('Runtime.exceptionThrown', (params) => {
      if (params.sessionId !== undefined && params.sessionId !== session) return;
      into.push(`exception: ${params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text ?? 'unknown'}`);
    });
    browser.on('Runtime.consoleAPICalled', (params) => {
      if (params.sessionId !== undefined && params.sessionId !== session) return;
      if (params.type !== 'error') return;
      into.push(`console.error: ${params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ')}`);
    });
    browser.on('Log.entryAdded', (params) => {
      if (params.sessionId !== undefined && params.sessionId !== session) return;
      if (params.entry.level !== 'error') return;
      into.push(`log: ${params.entry.text}`);
    });
    browser.on('Network.loadingFailed', (params) => {
      if (params.sessionId !== undefined && params.sessionId !== session) return;
      if (params.canceled === true) return;
      into.push(`request failed: ${params.errorText}`);
    });
  }

  try {
    for (const shot of shots) {
      const url = `${fileBase}${shot.query}`;
      const target = await browser.send('Target.createTarget', { url });
      const attached = await browser.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
      const session = attached.sessionId;
      const pageErrors = [];
      const pageRequests = [];
      watchErrors(session, pageErrors);
      browser.on('Network.requestWillBeSent', (params) => {
        if (params.sessionId === session) pageRequests.push(params.request.url);
      });

      for (const domain of ['Page', 'Runtime', 'Log', 'Network']) await browser.send(`${domain}.enable`, {}, session);
      await browser.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false }, session);

      const started = Date.now();
      let ready = false;
      while (!ready && Date.now() - started < 30000) {
        const probe = await browser.send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true }, session);
        ready = probe.result !== undefined && probe.result.value === true;
        if (!ready) await new Promise((res) => setTimeout(res, 90));
      }
      if (!ready) pageErrors.push('window.__shotReady never became true');

      await browser.send(
        'Runtime.evaluate',
        { expression: 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))', awaitPromise: true },
        session,
      );
      const capture = await browser.send('Page.captureScreenshot', { format: 'jpeg', quality: QUALITY, captureBeyondViewport: false }, session);
      const bytes = Buffer.from(capture.data, 'base64');
      writeFileSync(join(outDir, shot.name), bytes);
      const info = await browser.send('Runtime.evaluate', { expression: 'JSON.stringify(window.__shotInfo ?? null)', returnByValue: true }, session);
      report.push({ name: shot.name, bytes: bytes.length, url: shot.query, info: info.result?.value ?? null });
      if (bytes.length > MAX_BYTES) failures.push(`${shot.name} is ${bytes.length} bytes, over 256 KiB`);
      for (const error of pageErrors) failures.push(`${shot.name}: ${error}`);

      const outside = pageRequests.filter((request) => !request.startsWith(fileRoot));
      for (const request of outside) failures.push(`${shot.name} requested off the disk: ${request}`);
      requests.push(...pageRequests.map((u) => u.slice(fileRoot.length)));

      await browser.send('Target.closeTarget', { targetId: target.targetId });
    }
  } finally {
    browser.close();
    child.kill('SIGTERM');
  }

  console.log(JSON.stringify({ shots: report, requests, failures }, null, 2));
  if (failures.length > 0) {
    console.error('\nFAILED');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack ?? String(error));
  process.exitCode = 1;
});
