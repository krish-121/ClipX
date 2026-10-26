// Run inside the benchmark container; no application code is patched or mocked.
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const runtime = '/run/clipx-benchmark';
const repeats = Number(process.env.CLIPX_REPEATS || 10);
assert.ok(Number.isInteger(repeats) && repeats >= 1 && repeats <= 100);
const output = '/bench/results.json';
const baseURL = 'http://127.0.0.1:9000';
const fixtureURL = 'http://127.0.0.1:9071';
const profiles = [
  { name: '720p', width: 1280, height: 720 },
  { name: '1080p', width: 1920, height: 1080 },
];
const modes = [
  { name: 'full', start: '', end: '', expectedSeconds: 60 },
  { name: 'start-only', start: '00:00:15', end: '', expectedSeconds: 45 },
  { name: 'end-only', start: '', end: '00:00:15', expectedSeconds: 15 },
  { name: 'range', start: '00:00:15', end: '00:00:30', expectedSeconds: 15 },
];
const round = n => Number(n.toFixed(4));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const readOptional = p => { try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; } };
const command = (exe, args) => cp.execFileSync(exe, args, { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024, timeout: 180000 });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const probe = file => JSON.parse(command('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
const packets = file => JSON.parse(command('ffprobe', ['-v', 'error', '-show_packets', '-show_data_hash', 'sha256', '-show_entries', 'packet=stream_index,data_hash', '-of', 'json', file])).packets;

function stats(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    n: sorted.length,
    min: round(sorted[0]),
    median: round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2),
    p95: round(sorted[Math.ceil(sorted.length * 0.95) - 1]),
    max: round(sorted.at(-1)),
  };
}

const results = {
  schemaVersion: 1,
  measuredAt: new Date().toISOString(),
  sourceCommit: process.env.CLIPX_SOURCE_COMMIT || null,
  sourceSHA256: sha(fs.readFileSync('/source/main.go')),
  binarySHA256: sha(fs.readFileSync('/opt/clipx/server')),
  environment: {
    hostOS: 'Windows with Docker Desktop / WSL2 Linux containers',
    cpuModel: os.cpus()[0].model,
    hostLogicalCPUs: os.cpus().length,
    containerCPUQuota: readOptional('/sys/fs/cgroup/cpu.max'),
    containerMemoryBytes: readOptional('/sys/fs/cgroup/memory.max'),
    architecture: process.arch,
    node: process.version,
    go: process.env.CLIPX_GO_VERSION || null,
    ffmpeg: command('ffmpeg', ['-version']).split('\n')[0],
    ffprobe: command('ffprobe', ['-version']).split('\n')[0],
    ytDlp: command('yt-dlp', ['--version']).trim(),
    ytDlpSHA256: sha(fs.readFileSync('/usr/local/bin/yt-dlp')),
  },
  methodology: {
    scope: 'Unmodified Go HTTP backend -> real yt-dlp download over container loopback -> real FFmpeg stream copy -> HTTP download; generated media, not live X/Twitter',
    concurrency: 1,
    repeatsPerProfileAndMode: repeats,
    measuredJobs: profiles.length * modes.length * repeats,
    excludedWarmupJobs: profiles.length,
    pacing: 'A new request starts in a different Unix second from the previous request to avoid the application filename collision; pacing is excluded from latency, and throughput is not claimed.',
    latency: 'clipReadyMs: POST /clip through complete JSON response; clipAndDownloadMs also includes fetching the returned MP4. Probing, hashing, full decoding, fixture generation, warmup, and pacing are outside both timers.',
    percentile: 'p95 uses nearest rank; median averages the middle two samples for an even count.',
    durationToleranceSeconds: 0.15,
    network: 'Docker --network none; local HTTP only. No internet media, cookies, personal videos, or download-tool mocks.',
  },
  fixtures: [],
  warmups: [],
  trials: [],
  status: 'running',
};
const fixtureData = new Map();
let server;
let assetServer;
let logTail = '';
let lastRequestSecond = -1;

function save() {
  const summaries = [];
  for (const profile of profiles) for (const mode of modes) {
    const all = results.trials.filter(t => t.profile === profile.name && t.mode === mode.name);
    const good = all.filter(t => t.ok);
    summaries.push({
      profile: profile.name, mode: mode.name,
      attempted: all.length, successful: good.length,
      clipReadyMs: stats(good.map(t => t.clipReadyMs)),
      clipAndDownloadMs: stats(good.map(t => t.clipAndDownloadMs)),
      outputBytes: stats(good.map(t => t.outputBytes)),
      fileSizeReductionPercent: stats(good.map(t => t.fileSizeReductionPercent)),
      observedDurationSeconds: stats(good.map(t => t.observedDurationSeconds)),
    });
  }
  results.summary = {
    attempted: results.trials.length,
    successful: results.trials.filter(t => t.ok).length,
    failed: results.trials.filter(t => !t.ok).length,
    clipReadyMs: stats(results.trials.filter(t => t.ok).map(t => t.clipReadyMs)),
    workloads: summaries,
  };
  fs.writeFileSync(output, JSON.stringify(results, null, 2) + '\n');
}

async function runOne(profile, mode, repetition, warmup = false) {
  const data = fixtureData.get(profile.name);
  while (Math.floor(Date.now() / 1000) === lastRequestSecond) await wait(25);
  lastRequestSecond = Math.floor(Date.now() / 1000);
  const trial = { profile: profile.name, mode: mode.name, repetition, ok: false };
  let inputFile;
  let outputFile;
  try {
    const started = performance.now();
    const response = await fetch(`${baseURL}/clip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tweetUrl: `${fixtureURL}/${profile.name}.mp4`, start: mode.start, end: mode.end }),
      signal: AbortSignal.timeout(45000),
    });
    trial.httpStatus = response.status;
    if (!response.ok) throw new Error(`Clip HTTP ${response.status}: ${(await response.text()).trim()}`);
    const body = await response.json();
    trial.clipReadyMs = round(performance.now() - started);
    const download = new URL(body.downloadUrl);
    assert.equal(download.origin, baseURL);
    assert.match(download.pathname, /^\/download\/clipped_\d+\.mp4$/);
    const id = path.basename(download.pathname).match(/^clipped_(\d+)\.mp4$/)[1];
    inputFile = path.join(runtime, 'download', `${id}.mp4`);
    outputFile = path.join(runtime, 'download', `clipped_${id}.mp4`);
    const videoResponse = await fetch(body.downloadUrl, { signal: AbortSignal.timeout(30000) });
    assert.equal(videoResponse.status, 200);
    const video = Buffer.from(await videoResponse.arrayBuffer());
    trial.clipAndDownloadMs = round(performance.now() - started);
    trial.outputBytes = video.length;
    trial.outputSHA256 = sha(video);
    assert.equal(sha(fs.readFileSync(inputFile)), data.sha256, 'yt-dlp must download the full fixture unchanged');
    assert.equal(trial.outputSHA256, sha(fs.readFileSync(outputFile)), 'HTTP download must match the generated file');
    const metadata = probe(outputFile);
    const v = metadata.streams.find(s => s.codec_type === 'video');
    const a = metadata.streams.find(s => s.codec_type === 'audio');
    assert.equal(v.codec_name, 'h264');
    assert.equal(a.codec_name, 'aac');
    assert.equal(v.width, profile.width);
    assert.equal(v.height, profile.height);
    trial.observedDurationSeconds = Number(metadata.format.duration);
    assert.ok(Math.abs(trial.observedDurationSeconds - mode.expectedSeconds) <= 0.15, `Unexpected duration ${trial.observedDurationSeconds}`);
    const outputPackets = packets(outputFile);
    assert.ok(outputPackets.length > 0);
    for (const packet of outputPackets) {
      assert.ok(data.packetHashes.has(`${packet.stream_index}:${packet.data_hash}`), 'Encoded packet payload changed');
    }
    command('ffmpeg', ['-hide_banner', '-v', 'error', '-xerror', '-threads', '2', '-i', outputFile, '-f', 'null', '-']);
    trial.fileSizeReductionPercent = round(100 * (1 - video.length / data.bytes));
    trial.validation = {
      downloadedInputSHA256Matches: true,
      servedOutputSHA256Matches: true,
      dimensionsAndCodecsMatch: true,
      durationWithinTolerance: true,
      fullDecodePassed: true,
      encodedPacketPayloadsPreserved: true,
      packetsChecked: outputPackets.length,
    };
    trial.ok = true;
  } catch (error) {
    trial.error = error.message;
    trial.serverLogTail = logTail.slice(-2400);
  } finally {
    for (const file of [inputFile, outputFile]) if (file && fs.existsSync(file)) fs.unlinkSync(file);
  }
  (warmup ? results.warmups : results.trials).push(trial);
  if (!trial.ok) console.error(`FAILED: ${profile.name} ${mode.name}: ${trial.error}`);
  return trial;
}

async function main() {
  const started = performance.now();
  fs.mkdirSync(runtime, { recursive: true });
  process.chdir(runtime);
  for (const profile of profiles) {
    console.log(`Generating 60-second ${profile.name} H.264/AAC fixture...`);
    const file = path.join(runtime, `${profile.name}.mp4`);
    const args = ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', `testsrc2=size=${profile.width}x${profile.height}:rate=30`,
      '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=48000',
      '-t', '60', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-threads', '4', '-pix_fmt', 'yuv420p', '-g', '30', '-keyint_min', '30', '-sc_threshold', '0',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-map_metadata', '-1', file];
    command('ffmpeg', args);
    const bytes = fs.readFileSync(file);
    const metadata = probe(file);
    const sourcePackets = packets(file);
    const data = { file, bytes: bytes.length, sha256: sha(bytes), packetHashes: new Set(sourcePackets.map(p => `${p.stream_index}:${p.data_hash}`)) };
    fixtureData.set(profile.name, data);
    results.fixtures.push({ ...profile, durationSeconds: Number(metadata.format.duration), fps: 30,
      bytes: data.bytes, sha256: data.sha256, videoCodec: 'h264', audioCodec: 'aac', keyframeIntervalFrames: 30,
      packetCount: sourcePackets.length, generationCommand: ['ffmpeg', ...args.slice(0, -1), `${profile.name}.mp4`] });
  }
  assetServer = http.createServer((req, res) => {
    const profile = profiles.find(p => req.url === `/${p.name}.mp4`);
    if (!profile || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end(); return; }
    const data = fixtureData.get(profile.name);
    let first = 0;
    let last = data.bytes - 1;
    let status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (!match) { res.writeHead(416); res.end(); return; }
      first = Number(match[1]);
      if (match[2]) last = Math.min(last, Number(match[2]));
      status = 206;
    }
    const headers = { 'Content-Type': 'video/mp4', 'Content-Length': last - first + 1, 'Accept-Ranges': 'bytes' };
    if (status === 206) headers['Content-Range'] = `bytes ${first}-${last}/${data.bytes}`;
    res.writeHead(status, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(data.file, { start: first, end: last });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
  await new Promise(resolve => assetServer.listen(9071, '127.0.0.1', resolve));
  server = cp.spawn('/opt/clipx/server', [], { cwd: runtime, env: { ...process.env, PORT: '9000', BASE_URL: baseURL }, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [server.stdout, server.stderr]) stream.on('data', bytes => { logTail = (logTail + bytes.toString()).slice(-6000); });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(baseURL)).ok) { ready = true; break; } } catch {}
    await wait(50);
  }
  assert.ok(ready, 'Backend did not start');
  for (const profile of profiles) {
    const warmup = await runOne(profile, modes[0], 0, true);
    if (!warmup.ok) throw new Error(`Warmup failed: ${warmup.error}`);
  }
  const workloads = profiles.flatMap(profile => modes.map(mode => ({ profile, mode })));
  for (let repetition = 1; repetition <= repeats; repetition++) {
    for (let offset = 0; offset < workloads.length; offset++) {
      const { profile, mode } = workloads[(offset + repetition - 1) % workloads.length];
      await runOne(profile, mode, repetition);
    }
    save();
    console.log(`Round ${repetition}/${repeats}: ${results.summary.successful}/${results.summary.attempted} outputs passed all checks`);
  }
  results.totalElapsedSeconds = round((performance.now() - started) / 1000);
  results.status = results.trials.every(t => t.ok) ? 'passed' : 'completed-with-failures';
}

main().catch(error => {
  results.status = 'failed';
  results.fatalError = error.message;
  process.exitCode = 1;
}).finally(async () => {
  save();
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
  }
  if (assetServer) await new Promise(resolve => assetServer.close(resolve));
  if (results.summary.failed || results.status !== 'passed') process.exitCode = 1;
  console.log(JSON.stringify({ status: results.status, ...results.summary }, null, 2));
});
