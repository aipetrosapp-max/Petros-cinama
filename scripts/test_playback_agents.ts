import { cinemaStreamAgent } from '../src/agents/cinemaStreamAgent';
import { playbackScrubberAgent } from '../src/agents/playbackScrubberAgent';
import { selfHealingAgent } from '../src/agents/selfHealingAgent';
import { PROTOTYPE_MEDIA_CATALOG } from '../src/prototype/prototypeData';
import { isPlayableDirectMediaUrl } from '../src/services/aiCinemaStreamEngine';
import https from 'https';

async function verifyHttpStream(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = https.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            Range: 'bytes=0-1024'
          },
          timeout: 6000
        },
        (res) => {
          const ok = res.statusCode === 200 || res.statusCode === 206;
          resolve(ok);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

async function runHealthCheck() {
  console.log('================================================================');
  console.log('🎯 AI PETROS // ADK PLAYBACK & HEALING AGENTS VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, extra?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${title}`);
    } else {
      console.error(`❌ [FAIL] ${title} ${extra ? `-> ${extra}` : ''}`);
    }
  }

  // TEST 1: Telegram Scraped Item Auto-Routing
  console.log('--- TEST 1: Telegram Scraped Stream Auto-Routing ---');
  const tgMovie = {
    id: 'tg-aipetros-990',
    titleEn: 'Fuze',
    titleFa: 'فیوز',
    categoryEn: 'ACTION',
    streamUrl: 'https://t.me/Aipetros/990'
  } as any;

  const resTg = await cinemaStreamAgent.run({ item: tgMovie });
  assert(
    'CinemaStreamAgent correctly rejected t.me web URL',
    !resTg.data.streamUrl.includes('t.me')
  );
  assert(
    'CinemaStreamAgent resolved unblocked direct MP4 stream',
    resTg.data.streamUrl.startsWith('http') && resTg.data.streamUrl.endsWith('.mp4'),
    resTg.data.streamUrl
  );
  assert(
    'Resolved stream is NOT a flower or cartoon test clip',
    !resTg.data.streamUrl.includes('flower') && !resTg.data.streamUrl.includes('View_From_A_Blue_Moon'),
    resTg.data.streamUrl
  );

  // TEST 2: Dead Abrtech.top Item Auto-Routing
  console.log('\n--- TEST 2: Dead Abrtech.top Domain Routing ---');
  const deadAbrMovie = {
    id: 'stream-abr-01',
    titleEn: 'Sword & Silence',
    titleFa: 'شمشیر و سکوت',
    categoryEn: 'EPIC',
    streamUrl: 'https://bnrhd3fvb374s4bkwzxm54xf.abrtech.top/pnot/Series/Sword.mkv'
  } as any;

  const resDead = await cinemaStreamAgent.run({ item: deadAbrMovie });
  assert(
    'CinemaStreamAgent rejected dead abrtech.top host',
    !resDead.data.streamUrl.includes('abrtech.top')
  );
  assert(
    'CinemaStreamAgent matched Epic stream node',
    isPlayableDirectMediaUrl(resDead.data.streamUrl)
  );

  // TEST 3: Catalog Items Stream Validation
  console.log('\n--- TEST 3: Catalog Seed Items Playability ---');
  for (const item of PROTOTYPE_MEDIA_CATALOG) {
    const res = await cinemaStreamAgent.run({ item });
    assert(
      `Catalog item "${item.titleEn}" resolves to valid stream`,
      isPlayableDirectMediaUrl(res.data.streamUrl),
      res.data.streamUrl
    );
    assert(
      `Catalog item "${item.titleEn}" stream does not contain flower clip`,
      !res.data.streamUrl.includes('View_From_A_Blue_Moon') && !res.data.streamUrl.includes('flower')
    );
  }

  // TEST 4: Scrubber Agent Seeking Calibration
  console.log('\n--- TEST 4: Scrubber Agent Forward & Backward Drag ---');
  const mockVideo = { currentTime: 0, duration: 120 } as any;

  const cal = playbackScrubberAgent.calibrate({ videoElement: mockVideo, metadataDurationSec: 8640 });
  assert('ScrubberAgent calibrated effective duration to physical video (120s)', cal.effectiveDurationSec === 120);

  const seekMid = playbackScrubberAgent.seek({ videoElement: mockVideo, targetRatio: 0.5, effectiveDurationSec: 120 });
  assert('Seeking to 50% on 120s video targets 60s (NOT clamped to 42s)', Math.abs(seekMid - 60) < 0.5, `Got: ${seekMid}s`);

  const seekForward = playbackScrubberAgent.seek({ videoElement: mockVideo, targetRatio: 0.8, effectiveDurationSec: 120 });
  assert('Seeking to 80% on 120s video targets 96s', Math.abs(seekForward - 96) < 0.5, `Got: ${seekForward}s`);

  const seekBack = playbackScrubberAgent.seek({ videoElement: mockVideo, targetRatio: 0.2, effectiveDurationSec: 120 });
  assert('Seeking backwards to 20% targets 24s', Math.abs(seekBack - 24) < 0.5, `Got: ${seekBack}s`);

  // TEST 5: Self-Healing Agent Fast Failover
  console.log('\n--- TEST 5: Self-Healing Agent Failover Speed ---');
  const failover = selfHealingAgent.handleFailover({
    failedUrl: 'https://broken-cdn.test/bad.mp4',
    videoElement: mockVideo,
    currentSec: 45
  });
  assert('SelfHealingAgent failover resolved under 5ms', failover.recoveryTimeMs <= 5, `${failover.recoveryTimeMs}ms`);
  assert('SelfHealingAgent preserved currentSec (45s)', failover.resumedPositionSec === 45);
  assert('SelfHealingAgent provided verified unblocked backup URL', isPlayableDirectMediaUrl(failover.backupUrl));

  // TEST 6: Real HTTP Network Verification of Resolved URLs
  console.log('\n--- TEST 6: Real HTTP 206 Partial Content Check on Resolved Streams ---');
  const testUrl = resTg.data.streamUrl;
  console.log(`Connecting to: ${testUrl}...`);
  const isHttpOk = await verifyHttpStream(testUrl);
  assert(`Resolved stream returned HTTP 200/206 Partial Content (${testUrl})`, isHttpOk);

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} assertions PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runHealthCheck().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
