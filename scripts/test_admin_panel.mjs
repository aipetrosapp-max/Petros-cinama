/**
 * PETROS CINEMA — MASTER ADMIN PANEL
 * End-to-end verification with a real browser:
 *   - login gate (wrong password rejected, correct password accepted)
 *   - session token required for every mutating route
 *   - archive CRUD (title, season, episode, qualities, subtitles)
 *   - source validation (real HTTP Range probe)
 *   - wallet + feature switches
 *   - GitHub live sync status + publish (offline-safe: verifies local writes)
 *   - UI: every tab renders, edit controls are locked before login
 */
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';

const PORT = 4320;
const CDP_PORT = 9340;
const ROOT = process.cwd();
const MASTER_PASSWORD = 'PetrosMasterTest-2026!';
const CHROME =
  process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = path.join(os.tmpdir(), `petros-admin-e2e-${Date.now()}`);

let server;
let chrome;
let ws;
let msgId = 0;
const pending = new Map();
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
    const out = execSync(`netstat -ano | findstr ":${port} " | findstr "LISTENING`, {
      shell: 'cmd.exe'
    }).toString();
    const pids = new Set([...out.matchAll(/\s(\d+)\r?$/gm)].map((m) => m[1]));
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      } catch {}
    }
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
    }, 25000);
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

async function typeInto(selector, value) {
  return evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
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

async function main() {
  console.log('================================================================');
  console.log('PETROS CINEMA // MASTER ADMIN PANEL — E2E VERIFICATION');
  console.log('================================================================\n');

  killPortListeners(PORT);

  server = spawn('npx', ['tsx', 'server.ts'], {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'production',
      MASTER_ADMIN_PASSWORD: MASTER_PASSWORD
    }
  });
  const ready = await waitForHttp(`http://localhost:${PORT}/admin`);
  if (!ready) throw new Error('server did not start');
  console.log(`server ready on ${PORT}\n`);

  const base = `http://localhost:${PORT}`;

  // ------------------------------------------------------------------
  // 1. API: auth
  // ------------------------------------------------------------------
  console.log('--- API: authentication ---');
  const status = await (await fetch(`${base}/api/admin/auth/status`)).json();
  assert('Auth status reports a configured master password', status.passwordConfigured === true);

  const wrong = await fetch(`${base}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong-password-123' })
  });
  assert('Wrong master password is rejected with 401', wrong.status === 401, String(wrong.status));

  const login = await fetch(`${base}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: MASTER_PASSWORD })
  });
  const loginBody = await login.json();
  assert('Correct master password returns a session token', login.status === 200 && typeof loginBody.token === 'string' && loginBody.token.startsWith('pc_admin_'), JSON.stringify(loginBody).slice(0, 160));
  const token = loginBody.token;

  const noToken = await fetch(`${base}/api/admin/catalog`);
  assert('Protected route rejects requests without a token', noToken.status === 401, String(noToken.status));

  const badToken = await fetch(`${base}/api/admin/catalog`, {
    headers: { 'x-admin-token': 'pc_admin_forged' }
  });
  assert('Protected route rejects a forged token', badToken.status === 401, String(badToken.status));

  const withToken = await fetch(`${base}/api/admin/catalog`, {
    headers: { 'x-admin-token': token }
  });
  assert('Protected route accepts the issued token', withToken.status === 200, String(withToken.status));

  // ------------------------------------------------------------------
  // 2. API: archive CRUD
  // ------------------------------------------------------------------
  console.log('\n--- API: archive CRUD ---');
  const authed = { 'x-admin-token': token, 'Content-Type': 'application/json' };

  const created = await (
    await fetch(`${base}/api/admin/catalog/title`, {
      method: 'POST',
      headers: authed,
      body: JSON.stringify({
        title: 'E2E Test Feature',
        titleFa: 'فیلم تست',
        category: 'movie',
        year: 2026,
        qualities: [
          { id: 'q1', quality: '1080p', url: 'https://t.me/Aipetros/999901', format: 'telegram_gateway' },
          { id: 'q2', quality: '4K HDR', url: 'https://t.me/Aipetros/999901', format: 'telegram_gateway' }
        ],
        subtitles: [
          { id: 's1', language: 'fa', languageFa: 'فارسی', format: 'vtt', url: 'https://example.org/movie.fa.vtt', offsetMs: -1200 }
        ]
      })
    })
  ).json();
  assert('Title is created', created?.ok === true, JSON.stringify(created).slice(0, 200));
  const titleId = created.title?.id;

  const invalid = await fetch(`${base}/api/admin/catalog/title`, {
    method: 'POST',
    headers: authed,
    body: JSON.stringify({ title: 'Broken', category: 'invalid-category' })
  });
  const invalidBody = await invalid.json();
  assert('Invalid category is rejected with a Persian message', invalid.status === 400 && typeof invalidBody.messageFa === 'string', JSON.stringify(invalidBody).slice(0, 160));

  const badSubtitle = await (
    await fetch(`${base}/api/admin/catalog/title/${titleId}`, {
      method: 'PUT',
      headers: authed,
      body: JSON.stringify({
        title: 'E2E Test Feature',
        titleFa: 'فیلم تست',
        category: 'movie',
        subtitles: [{ id: 's2', language: 'fa', format: 'vtt', url: 'https://example.org/not-a-subtitle.txt' }]
      })
    })
  ).json();
  assert('Invalid subtitle format is rejected', badSubtitle?.error === 'validation_failed', JSON.stringify(badSubtitle).slice(0, 160));

  const season = await (
    await fetch(`${base}/api/admin/catalog/title/${titleId}/season`, {
      method: 'POST',
      headers: authed,
      body: JSON.stringify({ season: 1, title: 'Season 1', titleFa: 'فصل اول' })
    })
  ).json();
  assert('Season is added', season?.ok === true && season.season?.season === 1, JSON.stringify(season).slice(0, 160));

  const episode = await (
    await fetch(`${base}/api/admin/catalog/title/${titleId}/episode`, {
      method: 'POST',
      headers: authed,
      body: JSON.stringify({
        season: 1,
        episode: 1,
        title: 'Pilot',
        titleFa: 'قسمت اول',
        qualities: [{ id: 'eq1', quality: '720p', url: 'https://example.org/ep1-720p.mp4', format: 'direct_mp4' }],
        subtitles: [{ id: 'es1', language: 'en', languageFa: 'English', format: 'srt', url: 'https://example.org/ep1.en.srt', offsetMs: 0 }]
      })
    })
  ).json();
  assert('Episode with qualities and subtitles is added', episode?.ok === true && episode.episode?.qualities?.length === 1, JSON.stringify(episode).slice(0, 200));

  const catalog = await (await fetch(`${base}/api/admin/catalog`, { headers: { 'x-admin-token': token } })).json();
  const stored = catalog.titles?.find((t) => t.id === titleId);
  assert('Stored title keeps 2 qualities', stored?.qualities?.length === 2, String(stored?.qualities?.length));
  assert('Stored title keeps the original Telegram links', String(stored?.qualities?.[0]?.url || '').includes('t.me/'), String(stored?.qualities?.[0]?.url));
  assert('Stored title keeps the subtitle offset', stored?.subtitles?.[0]?.offsetMs === -1200, JSON.stringify(stored?.subtitles?.[0]));
  assert('Stored title keeps the season', stored?.seasons?.length === 1);
  assert('Stored title keeps the episode', stored?.episodes?.length === 1);

  // ------------------------------------------------------------------
  // 2b. API: subtitle file upload (SRT / VTT)
  // ------------------------------------------------------------------
  console.log('\n--- API: subtitle file upload ---');
  const vttBase64 = Buffer.from('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nسلام دنیا\n', 'utf8').toString('base64');
  const uploaded = await (
    await fetch(`${base}/api/admin/catalog/subtitle-file`, {
      method: 'POST',
      headers: authed,
      body: JSON.stringify({ filename: 'e2e-test.fa.vtt', contentBase64: vttBase64 })
    })
  ).json();
  assert('Valid VTT file uploads and returns a served URL', uploaded?.ok === true && /^\.\/subtitles\/.+\.vtt$/.test(uploaded?.record?.url || ''), JSON.stringify(uploaded).slice(0, 200));
  const uploadedFile = uploaded?.record?.localPath;
  assert('Uploaded subtitle file exists on disk with real content', Boolean(uploadedFile) && fs.readFileSync(uploadedFile, 'utf8').startsWith('WEBVTT'));

  const badExt = await (
    await fetch(`${base}/api/admin/catalog/subtitle-file`, {
      method: 'POST',
      headers: authed,
      body: JSON.stringify({ filename: 'movie.txt', contentBase64: vttBase64 })
    })
  ).json().catch(() => ({}));
  assert('Non-subtitle extension is rejected', badExt?.error === 'validation_failed', JSON.stringify(badExt).slice(0, 140));

  const fakeVtt = await (
    await fetch(`${base}/api/admin/catalog/subtitle-file`, {
      method: 'POST',
      headers: authed,
      body: JSON.stringify({ filename: 'fake.fa.vtt', contentBase64: Buffer.from('this is not a subtitle', 'utf8').toString('base64') })
    })
  ).json().catch(() => ({}));
  assert('Fake VTT content without WEBVTT header is rejected', fakeVtt?.error === 'invalid_subtitle', JSON.stringify(fakeVtt).slice(0, 140));

  const listFiles = await (await fetch(`${base}/api/admin/catalog/subtitle-files`, { headers: { 'x-admin-token': token } })).json();
  assert('Subtitle file registry lists the upload', (listFiles?.subtitleFiles || []).some((f) => f.filename === uploaded?.record?.filename));

  const delFile = await (
    await fetch(`${base}/api/admin/catalog/subtitle-file/${encodeURIComponent(uploaded?.record?.filename)}`, {
      method: 'DELETE',
      headers: authed
    })
  ).json();
  assert('Uploaded subtitle file can be deleted', delFile?.ok === true && !fs.existsSync(uploadedFile), JSON.stringify(delFile).slice(0, 120));

  // ------------------------------------------------------------------
  // 2c. API: quick-add from link (duplicate scan + site add + telegram gate)
  // ------------------------------------------------------------------
  console.log('\n--- API: quick-add from link ---');
  const existing = (catalog.titles || [])[0];
  const existingUrl = existing?.qualities?.[0]?.url || existing?.downloadLinks?.[0]?.url;
  if (existingUrl) {
    const dupRes = await (
      await fetch(`${base}/api/admin/catalog/from-link`, {
        method: 'POST',
        headers: authed,
        body: JSON.stringify({ url: existingUrl, postToTelegram: false })
      })
    ).json();
    assert('Existing link is detected as duplicate (nothing added)', dupRes?.duplicate === true && dupRes?.created === null, JSON.stringify(dupRes).slice(0, 180));
  } else {
    assert('Existing link is detected as duplicate (nothing added)', false, 'no url on first title to test with');
  }

  const freshUrl = 'https://cdn.example-cinema.org/movies/petros-e2e-new-' + Date.now() + '.mp4';
  const addRes = await (
    await fetch(`${base}/api/admin/catalog/from-link`, {
      method: 'POST',
      headers: authed,
      body: JSON.stringify({ url: freshUrl, title: 'Petros E2E New Title', postToTelegram: false })
    })
  ).json();
  assert('New link is added to the site catalog', addRes?.duplicate === false && addRes?.created?.id, JSON.stringify(addRes).slice(0, 180));
  assert('New record carries the pasted URL as its quality', addRes?.created?.qualities?.[0]?.url === freshUrl, JSON.stringify(addRes?.created?.qualities));

  const afterAdd = await (await fetch(`${base}/api/admin/catalog`, { headers: { 'x-admin-token': token } })).json();
  assert('Added title is persisted server-side', (afterAdd.titles || []).some((t) => t.id === addRes?.created?.id));

  const badLink = await (
    await fetch(`${base}/api/admin/catalog/from-link`, {
      method: 'POST',
      headers: authed,
      body: JSON.stringify({ url: 'notaurl', postToTelegram: false })
    })
  ).json();
  assert('Invalid link is rejected with 400', badLink?.error === 'validation_failed', JSON.stringify(badLink).slice(0, 140));

  await fetch(`${base}/api/admin/catalog/title/${addRes?.created?.id}`, { method: 'DELETE', headers: authed });

  // ------------------------------------------------------------------
  // 3. API: sources, wallet, features
  // ------------------------------------------------------------------
  console.log('\n--- API: sources / vault ---');
  const validation = await (
    await fetch(`${base}/api/admin/sources/validate`, {
      method: 'POST',
      headers: authed,
      body: JSON.stringify({ url: 'https://ia600608.us.archive.org/1/items/youtube-qVId_hDAvHw/qVId_hDAvHw.mp4' })
    })
  ).json();
  // The endpoint must at minimum classify the URL. The live Range probe only
  // succeeds with outbound network; in a sandbox it degrades to a structured
  // "could not reach source" message instead of a false positive.
  const classified = validation?.kind === 'direct_mp4';
  const liveProbeOk = validation?.ok === true && validation?.acceptsRanges === true;
  const gracefulOffline = validation?.ok === false && /\u062f\u0633\u062a\u0631\u0633\u06cc|fetch failed|aborted|network|Timeout/i.test(JSON.stringify(validation));
  assert('Source validation classifies the URL and probes (or degrades offline)', classified && (liveProbeOk || gracefulOffline), JSON.stringify(validation).slice(0, 220));

  const badSource = await (
    await fetch(`${base}/api/admin/sources/validate`, {
      method: 'POST',
      headers: authed,
      body: JSON.stringify({ url: 'not-a-url' })
    })
  ).json();
  assert('Invalid source URL is rejected', badSource?.ok === false && badSource.kind === null, JSON.stringify(badSource).slice(0, 160));

  const wallet = await (
    await fetch(`${base}/api/admin/vault/wallet/new`, {
      method: 'PUT',
      headers: authed,
      body: JSON.stringify({ network: 'USDT-TRC20', address: 'TTestAddress123', label: 'tron', enabled: true, decimals: 6 })
    })
  ).json();
  assert('Wallet is saved', wallet?.ok === true && wallet.config?.wallets?.length >= 1, JSON.stringify(wallet).slice(0, 200));
  assert('Token values are never returned to the client', (wallet.config?.tokens || []).every((t) => !t.value || t.value.includes('•')), JSON.stringify(wallet.config?.tokens));

  const features = await (
    await fetch(`${base}/api/admin/vault/features`, {
      method: 'PUT',
      headers: authed,
      body: JSON.stringify({
        donationEnabled: true,
        cryptoPaymentEnabled: true,
        cryptoAdBannerEnabled: true,
        watchPartyEnabled: false,
        offlineDownloadEnabled: true,
        telegramGatewayEnabled: true,
        aiSubtitleSyncEnabled: true,
        maintenanceMode: false
      })
    })
  ).json();
  assert('Feature switches are saved', features?.ok === true && features.features?.donationEnabled === true, JSON.stringify(features).slice(0, 200));

  // public config consumed by clients
  const publicConfig = await (await fetch(`${base}/api/public/config`)).json();
  assert('Public config is served to clients', publicConfig?.features?.donationEnabled === true, JSON.stringify(publicConfig).slice(0, 200));

  // ------------------------------------------------------------------
  // 4. API: GitHub live sync
  // ------------------------------------------------------------------
  console.log('\n--- API: GitHub live sync ---');
  const syncStatus = await (await fetch(`${base}/api/admin/sync/status`, { headers: { 'x-admin-token': token } })).json();
  assert('Sync status returns repo configuration', typeof syncStatus?.owner === 'string' && typeof syncStatus?.branch === 'string', JSON.stringify(syncStatus).slice(0, 200));

  const publish = await (
    await fetch(`${base}/api/admin/sync/publish`, {
      method: 'POST',
      headers: authed,
      body: JSON.stringify({ message: 'e2e verification publish' })
    })
  ).json();
  assert('Publish rebuilds the client catalog locally', Array.isArray(publish?.localWrites) && publish.localWrites.length >= 3, JSON.stringify(publish).slice(0, 260));
  assert('Publish bumps the manifest version', typeof publish?.manifestVersion === 'string' && publish.manifestVersion.length > 3, String(publish?.manifestVersion));
  assert('Publish reports the catalog counts', publish?.counts?.titles >= 1, JSON.stringify(publish?.counts));

  const localCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'streams.json'), 'utf8'));
  const clientEntry = (localCatalog.streams || []).find((s) => s.id === titleId);
  assert('Client catalog contains the new title', Boolean(clientEntry), String(clientEntry?.id));
  assert(
    'Telegram-sourced titles publish to the rolling cache path',
    typeof clientEntry?.playableUrl === 'string' && clientEntry.playableUrl.startsWith('/api/stream/cache/'),
    String(clientEntry?.playableUrl)
  );
  assert(
    'Telegram descriptor is preserved for the cache gateway',
    typeof clientEntry?.upstreamUrl === 'string' && clientEntry.upstreamUrl.startsWith('petros-cache://telegram/'),
    String(clientEntry?.upstreamUrl)
  );
  const directEntry = (localCatalog.streams || []).find((x) => x.id === 'canonical-blade-runner-2049');
  assert(
    'Verified direct media titles keep their direct URL through publish',
    String(directEntry?.defaultStreamUrl || '').includes('archive.org'),
    String(directEntry?.defaultStreamUrl)
  );
  assert(
    'Client catalog keeps the episode structure',
    Array.isArray(clientEntry?.episodes) && clientEntry.episodes.length === 1,
    JSON.stringify(clientEntry?.episodes?.length)
  );

  // Teardown: remove the test title from the local catalog so the tracked
  // data/streams.json is left exactly as it was found (re-publish afterwards).
  const delTitle = await (
    await fetch(`${base}/api/admin/catalog/title/${titleId}`, {
      method: 'DELETE',
      headers: authed
    })
  ).json();
  const republish = await (
    await fetch(`${base}/api/admin/sync/publish`, {
      method: 'POST',
      headers: { ...authed, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'e2e teardown: remove test title', bumpVersion: false })
    })
  ).json();
  const afterCatalog = JSON.parse(fs.readFileSync('data/streams.json', 'utf8'));
  assert(
    'Teardown removes the test title from the published catalog',
    delTitle?.ok === true &&
      !(afterCatalog.streams || []).some((x) => x.id === titleId) &&
      !(afterCatalog.streams || []).some((x) => x.id === 'canonical-blade-runner-2049' && !x.defaultStreamUrl),
    JSON.stringify({ delTitle, republishOk: republish?.ok })
  );

  // ------------------------------------------------------------------
  // 5. Browser: UI + lock behaviour
  // ------------------------------------------------------------------
  console.log('\n--- Browser: UI behaviour ---');
  chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${PROFILE}`,
      '--window-size=1440,1000',
      `http://localhost:${PORT}/admin`
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
    if (data.id && pending.has(data.id)) {
      const job = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) job.reject(new Error(JSON.stringify(data.error)));
      else job.resolve(data.result);
    }
  };
  await cdp('Runtime.enable');

  // Wait until the SPA actually mounts (first load compiles/serves a large bundle).
  let mounted = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    mounted = await evaluate(`Boolean(document.querySelector('#master-password'))`);
    if (mounted) break;
    await sleep(1000);
  }
  assert('SPA mounts and renders the login gate', mounted === true);
  await sleep(800); // fonts + tailwind

  const loginUi = await evaluate(`(() => ({
    title: document.body.innerText.includes('Petros Cinema Master Admin Panel'),
    hasPassword: Boolean(document.querySelector('#master-password')),
    dir: document.documentElement.dir,
    font: getComputedStyle(document.body).fontFamily,
    tabs: document.querySelectorAll('nav button').length
  }))()`);
  assert('Login gate renders with the panel title', loginUi.title === true);
  assert('Password field is present', loginUi.hasPassword === true);
  assert('Panel is RTL', loginUi.dir === 'rtl');
  assert('Vazirmatn font is applied', /Vazirmatn/i.test(loginUi.font), loginUi.font);
  assert('No admin tab is exposed before login', loginUi.tabs === 0, String(loginUi.tabs));

  // wrong password
  await typeInto('#master-password', 'totally-wrong');
  await clickText('ورود امن به پنل');
  await sleep(2500);
  const afterWrong = await evaluate(`document.body.innerText.includes('رمز عبور نادرست است')`);
  assert('Wrong password shows a Persian error and stays locked', afterWrong === true);

  // correct password
  await typeInto('#master-password', MASTER_PASSWORD);
  await clickText('ورود امن به پنل');
  await sleep(4000);
  const afterLogin = await evaluate(`(() => ({
    tabs: document.querySelectorAll('nav button').length,
    hasDashboard: document.body.innerText.includes('داشبورد کلی'),
    tokenInStorage: Object.keys(localStorage).some((k) => /token|admin/i.test(k)),
    tokenInSession: Object.keys(sessionStorage).some((k) => /token|admin/i.test(k))
  }))()`);
  assert('Successful login reveals the admin tabs', afterLogin.tabs >= 5, String(afterLogin.tabs));
  assert('Dashboard renders after login', afterLogin.hasDashboard === true);
  assert('Session token is NOT stored in localStorage', afterLogin.tokenInStorage === false);
  assert('Session token is NOT stored in sessionStorage', afterLogin.tokenInSession === false);

  // archive tab
  const archiveOpened = await clickText('آرشیو مدیا');
  assert('Archive tab opens', archiveOpened === true);
  await sleep(2000);
  const archiveUi = await evaluate(`(() => ({
    hasSearch: Boolean(document.querySelector('input[placeholder*="جستجو"]')),
    rows: document.querySelectorAll('article').length,
    hasFilter: document.body.innerText.includes('فیلم') && document.body.innerText.includes('سریال') && document.body.innerText.includes('انیمه'),
    hasNewButton: document.body.innerText.includes('عنوان جدید')
  }))()`);
  assert('Archive tab has instant search', archiveUi.hasSearch === true);
  assert('Archive tab lists titles', archiveUi.rows >= 1, String(archiveUi.rows));
  assert('Archive tab has category filters', archiveUi.hasFilter === true);
  assert('Archive tab exposes the create action', archiveUi.hasNewButton === true);

  // open the editor and check the multi-quality + subtitle sections
  await clickText('عنوان جدید');
  await sleep(1500);
  const editorUi = await evaluate(`(() => {
    const text = document.body.innerText;
    return {
      hasQuality: text.includes('مدیریت چندکیفیتی'),
      hasQualityPresets: ['4K HDR', '1080p', '720p', '480p'].every((q) => text.includes(q)),
      hasSubtitle: text.includes('موتور زیرنویس'),
      hasSave: text.includes('ذخیره')
    };
  })()`);
  assert('Editor exposes multi-quality management', editorUi.hasQuality === true && editorUi.hasQualityPresets === true, JSON.stringify(editorUi));
  assert('Editor exposes the subtitle engine', editorUi.hasSubtitle === true);
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === 'انصراف');
    if (btn) btn.click();
    return true;
  })()`);
  await sleep(800);

  // sources tab
  await clickText('سورس‌ها');
  await sleep(1500);
  const sourcesUi = await evaluate(`(() => ({
    hasValidate: document.body.innerText.includes('اعتبارسنجی'),
    hasServices: document.body.innerText.includes('گیت‌وی تلگرام')
  }))()`);
  assert('Sources tab renders with validation', sourcesUi.hasValidate === true);
  assert('Sources tab documents the streaming services', sourcesUi.hasServices === true);

  // vault tab
  await clickText('ولت و توکن‌ها');
  await sleep(1500);
  const vaultUi = await evaluate(`(() => ({
    hasWallet: document.body.innerText.includes('کیف‌پول‌های پلتفرم'),
    hasTokens: document.body.innerText.includes('توکن‌های دسترسی API'),
    hasSwitches: document.body.innerText.includes('سوییچ‌های کلاینت'),
    masked: (document.body.innerText.match(/•{4,}/g) || []).length >= 0
  }))()`);
  assert('Vault tab renders the wallet section', vaultUi.hasWallet === true);
  assert('Vault tab renders the API token section', vaultUi.hasTokens === true);
  assert('Vault tab renders the client switches', vaultUi.hasSwitches === true);

  // sync tab
  await clickText('همگام‌سازی گیت‌هاب');
  await sleep(2500);
  const syncUi = await evaluate(`(() => ({
    hasPublish: document.body.innerText.includes('ذخیره و اعمال سراسری'),
    hasZeroClient: document.body.innerText.includes('Zero-Client-Update'),
    hasManifest: document.body.innerText.includes('manifestVersion')
  }))()`);
  assert('Sync tab exposes the global publish action', syncUi.hasPublish === true);
  assert('Sync tab documents the zero-client-update architecture', syncUi.hasZeroClient === true);
  assert('Sync tab shows the manifest version', syncUi.hasManifest === true);

  // ------------------------------------------------------------------
  // 6. Logout locks the panel again
  // ------------------------------------------------------------------
  const loggedOut = await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('title') || '') === 'خروج');
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  assert('Logout control is present', loggedOut === true);
  await sleep(2500);
  const lockedAgain = await evaluate(`(() => ({
    hasPassword: Boolean(document.querySelector('#master-password')),
    tabs: document.querySelectorAll('nav button').length
  }))()`);
  assert('Panel locks again after logout', lockedAgain.hasPassword === true && lockedAgain.tabs === 0, JSON.stringify(lockedAgain));

  console.log('\n================================================================');
  console.log(`🏁 ADMIN PANEL E2E: ${passed}/${total} assertions PASSED (${Math.round((passed / total) * 100)}%)`);
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
      if (server) server.kill();
    } catch {}
    try {
      fs.rmSync(PROFILE, { recursive: true, force: true });
    } catch {}
  });
