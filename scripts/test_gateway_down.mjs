/**
 * Verification: what happens when the Telegram gateway is DOWN.
 *
 * Run: node scripts/test_gateway_down.mjs   (after `npm run build`)
 *
 * Covers both layers:
 *  1. HTTP: cache route must fail fast with an honest 502 JSON, must not
 *     create fake cache artefacts, and cached ranges must still be served.
 *  2. Real browser: opening a gateway title must show the honest maintenance
 *     state after the video error — never a substitute clip or t.me redirect.
 */
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';

const PORT = 4310;
const CDP_PORT = 9334;
const DEAD_GATEWAY = 'http://localhost:8799'; // nothing listens here (Telegram closed)
const ROOT = process.cwd();

const CHROME =
  process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = path.join(os.tmpdir(), `petros-gwdown-${Date.now()}`);

const MOCK_GATEWAY_PATH = path.join(os.tmpdir(), `petros-mock-gateway-${Date.now()}.mjs`);
const MOCK_MEDIA_PATH = path.join(os.tmpdir(), `petros-mock-media-${Date.now()}.mp4`);

// The mock must serve a REAL, decodable MP4: the browser rejects garbage
// bytes with NotSupportedError, which is indistinguishable from a dead
// gateway at the player level.
async function prepareMockMedia() {
  const res = await fetch(
    'https://ia600608.us.archive.org/1/items/youtube-qVId_hDAvHw/qVId_hDAvHw.mp4',
    { headers: { Range: 'bytes=0-4194303' } }
  );
  if (!res.ok) throw new Error('failed to download mock media slice');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1_000_000 || buf[4] !== 0x66 || buf[5] !== 0x74) {
    throw new Error('mock media slice is not an MP4 head');
  }
  fs.writeFileSync(MOCK_MEDIA_PATH, buf);
  fs.writeFileSync(
    MOCK_GATEWAY_PATH,
    `import http from 'node:http';
import fs from 'node:fs';
const DATA = fs.readFileSync(${JSON.stringify(MOCK_MEDIA_PATH)});
http.createServer((req, res) => {
  const range = req.headers.range;
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  if (range) {
    const m = /bytes=(\\d+)-(\\d*)/.exec(range);
    const start = Number(m[1]);
    const end = m[2] === '' ? DATA.length - 1 : Math.min(Number(m[2]), DATA.length - 1);
    res.writeHead(206, {
      'Content-Range': 'bytes ' + start + '-' + end + '/' + DATA.length,
      'Content-Length': String(end - start + 1)
    });
    res.end(DATA.subarray(start, end + 1));
  } else {
    res.writeHead(200, { 'Content-Length': String(DATA.length) });
    res.end(DATA);
  }
}).listen(8799, () => console.log('mock gateway up'));
`
  );
}

let preview;
let chrome;
let ws;
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
let passed = 0;
let total = 0;

function assert(name, condition, detail = '') {
  total += 1;
  if (condition) {
    passed += 1;
    console.log(`✅ [PASS] ${name}`);
  } else {
    console.log(`❌ [FAIL] ${name} -> ${String(detail).slice(0, 300)}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function killPortListeners(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port} " | findstr "LISTENING"`, { shell: 'cmd.exe' }).toString();
    const pids = new Set([...out.matchAll(/\s(\d+)\r?$/gm)].map((m) => m[1]));
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      } catch {}
    }
    if (pids.size) console.log(`killed ${pids.size} stale listener(s) on :${port}`);
  } catch {
    // nothing listening
  }
}


async function waitForHttp(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not ready
    }
    await sleep(400);
  }
  return false;
}

async function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 20000);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function clickText(needle) {
  return evaluate(`(() => {
    const nodes = [...document.querySelectorAll('button,a')];
    const el = nodes.find((n) => (n.innerText || '').trim().includes(${JSON.stringify(needle)}));
    if (!el) return false;
    el.click();
    return true;
  })()`);
}

async function hasText(needle) {
  return evaluate(`document.body.innerText.includes(${JSON.stringify(needle)})`);
}

async function waitForText(needle, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await hasText(needle)) return true;
    await sleep(500);
  }
  return false;
}

async function main() {
  console.log('================================================================');
  console.log('AI PETROS // GATEWAY DOWN (TELEGRAM CLOSED) VERIFICATION');
  console.log('================================================================\n');

  // clean cache so nothing pre-exists
  fs.rmSync(path.join(ROOT, 'cache'), { recursive: true, force: true });

  killPortListeners(PORT);
  preview = spawn('npx', ['tsx', 'server.ts'], {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'production',
      STREAM_GATEWAY_URL: DEAD_GATEWAY
    }
  });
  const ready = await waitForHttp(`http://localhost:${PORT}/app.html`);
  if (!ready) throw new Error('server did not start');
  console.log(`server ready on ${PORT} (gateway intentionally dead)\n`);

  // ------------------------------------------------------------------
  // 1. HTTP layer: gateway closed
  // ------------------------------------------------------------------
  console.log('--- HTTP: cache route with dead gateway ---');
  const base = `http://localhost:${PORT}/api/stream/cache/tg-aipetros-2008`;

  const rangeResp = await fetch(base, { headers: { Range: 'bytes=0-1023' } });
  const rangeBody = await rangeResp.json().catch(() => ({}));
  assert(
    'Range request with dead gateway returns honest 502',
    rangeResp.status === 502 && rangeBody.error === 'upstream_unavailable',
    `${rangeResp.status} ${JSON.stringify(rangeBody)}`
  );
  assert('502 carries a Persian explanation for the user', typeof rangeBody.messageFa === 'string' && rangeBody.messageFa.length > 10, rangeBody.messageFa);

  const fullResp = await fetch(base);
  const fullBody = await fullResp.json().catch(() => ({}));
  assert(
    'Full request with dead gateway also returns honest 502 (not an empty 200)',
    fullResp.status === 502 && fullBody.error === 'upstream_unavailable',
    `${fullResp.status} ${JSON.stringify(fullBody)}`
  );

  const headResp = await fetch(base, { method: 'HEAD' });
  assert('HEAD does not fabricate a Content-Length when nothing is cached', !headResp.headers.get('content-length'), JSON.stringify([...headResp.headers]));

  // no fake artefacts were persisted while the gateway is down
  const cacheDir = path.join(ROOT, 'cache', 'media_chunks');
  const artefacts = fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir) : [];
  assert('No fake cache artefacts are written while the gateway is down', artefacts.length === 0, JSON.stringify(artefacts));

  // ------------------------------------------------------------------
  // 2. Real browser: open a gateway title and watch the honest failure
  // ------------------------------------------------------------------
  console.log('\n--- Browser: player behaviour with gateway closed ---');
  chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${PROFILE}`,
      '--window-size=1440,1000',
      `http://localhost:${PORT}/app.html`
    ],
    { stdio: 'ignore' }
  );
  const cdpReady = await waitForHttp(`http://localhost:${CDP_PORT}/json/version`, 30000);
  if (!cdpReady) throw new Error('Chrome CDP did not start');
  const pages = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json();
  const page = pages.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.consoleAPICalled' && data.params?.type === 'warning') {
      consoleErrors.push('warn: ' + (data.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 200));
    }
    if (data.id && pending.has(data.id)) {
      const job = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) job.reject(new Error(JSON.stringify(data.error)));
      else job.resolve(data.result);
      return;
    }
    if (data.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(data.params?.exceptionDetails?.exception?.description || 'exception');
    }
  };
  await cdp('Runtime.enable');

  await sleep(9000);
  await waitForText('AI PETROS', 20000);

  // Native media event instrumentation (independent of React handlers)
  await evaluate(`(() => {
    window.__mediaEvents = [];
    document.addEventListener('error', (e) => {
      const t = e.target;
      if (t && t.tagName === 'VIDEO') {
        window.__mediaEvents.push({ type: 'error', src: (t.currentSrc || t.src || '').slice(-80), ts: Date.now() });
      }
    }, true);
    document.addEventListener('stalled', (e) => {
      const t = e.target;
      if (t && t.tagName === 'VIDEO') window.__mediaEvents.push({ type: 'stalled', src: (t.currentSrc || t.src || '').slice(-80), ts: Date.now() });
    }, true);
    return true;
  })()`);

  // search the gateway title (Persian title of tg-aipetros-2008)
  await clickText('Search');
  await sleep(800);
  const searched = await evaluate(`(() => {
    const input = document.querySelector('input[placeholder]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'ترس از اشک');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return true;
  })()`);
  assert('Search accepts the gateway title query', searched === true);
  await sleep(2500);

  const cardDebug = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('button,div[role=button],article')]
      .filter((n) => (n.innerText || '').includes('ترس از اشک'));
    return cards.slice(0, 3).map((n) => ({ tag: n.tagName, text: (n.innerText || '').slice(0, 80) }));
  })()`);
  const opened = await evaluate(`(() => {
    const nodes = [...document.querySelectorAll('button,div[role=button],article')];
    const el =
      nodes.find((n) => (n.innerText || '').trim().startsWith('ترس از اشک')) ||
      nodes.find((n) => (n.innerText || '').includes('ترس از اشک'));
    if (!el) return false;
    el.click();
    return true;
  })()`);
  assert('Gateway title card is clickable', opened === true, JSON.stringify(cardDebug));
  // Clicking the card opens the cinematic player directly for this title
  // (some titles skip the detail modal). Wait for the player chrome instead.
  const playerOpened = await waitForText('Exit Fullscreen', 8000);
  assert('Cinematic player opens for the gateway title', playerOpened === true);
  // Poll up to 30s: the video must hit the dead cache route, fire onError,
  // and the honest maintenance state must replace the player.
  // Also record the full transition timeline for diagnosis.
  await evaluate(`(() => { window.__timeline = []; return true; })()`);
  let state = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    state = await evaluate(`(() => {
    const vids = [...document.querySelectorAll('video')];
    const text = document.body.innerText;
    return {
      videoSrc: vids[0]?.src || '',
      allVideos: vids.map((x) => x.src),
      readyState: vids[0]?.readyState ?? -1,
      networkState: vids[0]?.networkState ?? -1,
      markers: {
        maintenance_en: text.includes('Server Under Maintenance'),
        maintenance_fa: text.includes('سرور اختصاصی'),
        noSub_en: text.includes('No substitute clip'),
        noSub_fa: text.includes('هیچ کلیپ جایگزینی'),
        retry: text.includes('تلاش مجدد') || text.includes('Retry Playback'),
        gatewayBadge: text.includes('Telegram Range Gateway Required')
      },
      textLen: text.length,
      text,
      hasMaintenance:
        text.includes('Server Under Maintenance') ||
        text.includes('سرور اختصاصی در حال آماده') ||
        text.includes('در حال آماده‌سازی'),
      hasRetry: text.includes('Retry Playback') || text.includes('تلاش مجدد'),
      noForeignClip: !text.includes('Cosmic Neon Odyssey') || text.includes('ترس از اشک')
    };
  })()`);
    await evaluate(`window.__timeline.push({ t: Date.now(), src: (document.querySelector('video')?.src || '').slice(-40), maint: document.body.innerText.includes('Server Under Maintenance') || document.body.innerText.includes('سرور اختصاصی'), videos: document.querySelectorAll('video').length })`);
    if (state.hasMaintenance) break;
    await sleep(1000);
  }
  const timeline = await evaluate('window.__timeline');
  console.log('TIMELINE:', JSON.stringify(timeline));

  assert(
    'Player shows the honest maintenance state after gateway failure',
    state.hasMaintenance === true,
    JSON.stringify(state.markers) + ' videos=' + JSON.stringify(state.allVideos) + ' mediaEvents=' + JSON.stringify(await evaluate('window.__mediaEvents')) + ' || ' + state.text.slice(0, 600)
  );
  assert('Retry control is offered', state.hasRetry === true);
  assert(
    'No unrelated substitute clip was attached',
    !(state.videoSrc || '').includes('X-Men-Apocalypse-Final-Trailer'),
    state.videoSrc
  );
  assert(
    'No redirect to t.me / external hosts happened',
    !(state.videoSrc || '').includes('t.me') && !(state.videoSrc || '').includes('abrtech'),
    state.videoSrc
  );
  // console.warn entries from the engine are expected honesty logs;
  // only uncaught exceptions are failures.
  const uncaught = consoleErrors.filter((e) => !e.startsWith('warn:'));
  assert('No uncaught browser exceptions', uncaught.length === 0, uncaught.join(' | ').slice(0, 300));
  console.log('engine warn log:', consoleErrors.filter((e) => e.startsWith('warn:')).join(' | ').slice(0, 300));

  // ------------------------------------------------------------------
  // 3. Recovery: gateway comes back online -> Retry must restore playback.
  // ------------------------------------------------------------------
  console.log('--- Recovery: gateway back online + Retry ---');
  const mock = spawn('node', [MOCK_GATEWAY_PATH], { stdio: 'ignore' });
  const mockUp = await waitForHttp(`${DEAD_GATEWAY}/Aipetros/2008`, 15000);
  assert('Mock gateway (simulated Telegram) is reachable again', mockUp === true);

  const retryClicked = await clickText('Retry Playback') || await clickText('تلاش مجدد برای پخش');
  assert('Retry Playback control was clicked', retryClicked === true);

  let recovered = null;
  for (let attempt = 0; attempt < 25; attempt++) {
    recovered = await evaluate(`(() => {
      const v = document.querySelector('video');
      return {
        src: v?.src || '',
        hasMaintenance: document.body.innerText.includes('Server Under Maintenance') ||
          document.body.innerText.includes('سرور اختصاصی'),
        readyState: v?.readyState ?? -1
      };
    })()`);
    if (recovered.src && !recovered.hasMaintenance && recovered.readyState > 0) break;
    await sleep(1000);
  }
  assert('Retry re-attaches the cache route after gateway recovery', (recovered?.src || '').includes('/api/stream/cache/tg-aipetros-2008'), JSON.stringify(recovered) + ' || events=' + JSON.stringify(await evaluate('window.__mediaEvents')) + ' || warns=' + consoleErrors.filter((e) => e.startsWith('warn:')).slice(-4).join(' | ').slice(0, 400));
  assert('Maintenance state is cleared after successful retry', recovered?.hasMaintenance === false, JSON.stringify(recovered));
  console.log('ALL WARNS:', consoleErrors.filter((e) => e.startsWith('warn:')).map((e) => e.slice(0, 120)).join(' || '));

  // the server actually fetched the recovered upstream and cached it
  // The tee-to-disk metadata persists when the response completes (media ends
  // or the player closes the connection), so poll for it.
  const { createHash } = await import('node:crypto');
  const key = createHash('sha1').update(`${DEAD_GATEWAY}/Aipetros/2008`).digest('hex');
  const metaPath = path.join(ROOT, 'cache', 'media_chunks', key + '.meta.json');
  let afterRecovery = { ok: false };
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      const meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf8'));
      if (meta.ranges.length > 0 && meta.totalLength > 0) {
        afterRecovery = { ok: true, meta: { totalLength: meta.totalLength, ranges: meta.ranges } };
        break;
      }
    } catch (error) {
      afterRecovery = { ok: false, error: String(error) };
    }
    await sleep(1000);
  }
  assert('Recovered playback wrote real bytes into the rolling cache', afterRecovery.ok === true, JSON.stringify(afterRecovery).slice(0, 220));

  try {
    mock.kill();
  } catch {}

  // ------------------------------------------------------------------
  // 4. Server health after all failures + recovery.
  // ------------------------------------------------------------------
  const health = await (await fetch(`http://localhost:${PORT}/api/health`)).json();
  assert('Server stays healthy after gateway failures', health?.status === 'ok', JSON.stringify(health).slice(0, 120));

  console.log('\n================================================================');
  console.log(`🏁 GATEWAY-DOWN RESULTS: ${passed}/${total} assertions PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================');
  if (passed !== total) process.exit(1);
}

main()
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(() => {
    try {
      if (chrome) chrome.kill();
    } catch {}
    try {
      if (preview) preview.kill();
    } catch {}
    try {
      fs.rmSync(PROFILE, { recursive: true, force: true });
    } catch {}
    try {
      fs.rmSync(MOCK_GATEWAY_PATH, { force: true });
    } catch {}
  });

  await prepareMockMedia(); // real decodable MP4 for the recovery phase
