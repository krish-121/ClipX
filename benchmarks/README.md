# ClipX local media benchmark

This benchmark measures the existing Go backend with real `yt-dlp` and FFmpeg.
It uses generated test video served over HTTP on container loopback. The application
source is unchanged, and neither external tool is mocked.

The measurements cover `POST /clip` and the returned Go `/download/` URL. They do
not include the Next.js server action, download proxy, browser UI, or live
X/Twitter extraction and internet transfer.

## Evidence

- [Raw measurements and validation results](results.json)
- [Copy-ready CV entry and measured figures](CV.md)
- [Node.js benchmark harness](run.cjs)
- [PowerShell build/run script](run.ps1)
- [Container dependencies](Dockerfile)

Measured on 26 October 2026. The raw JSON records the application commit, source
and binary SHA-256 hashes, tool versions, fixture generation arguments and hashes,
every measured trial, both excluded warmups, and per-workload summaries.

## Workload

Two 60-second, 30 fps fixtures use FFmpeg's `testsrc2` video and a sine-wave audio
track: 1280 × 720 and 1920 × 1080. Both use H.264 video, AAC audio, and a one-second
keyframe interval. FFmpeg generates them using `libx264`, the `veryfast` preset,
CRF 23, four encoder threads, and 128 kbit/s AAC. Exact commands are in the JSON.

Each resolution is tested in four modes:

| Mode | Start | End | Requested output duration |
| --- | --- | --- | --- |
| Full video | omitted | omitted | 60 s |
| Start only | 15 s | omitted | 45 s |
| End only | omitted | 15 s | 15 s |
| Range | 15 s | 30 s | 15 s |

Ten rounds each exercise all eight resolution/mode combinations, rotating the
starting combination each round: **80 measured jobs**, with **10 observations per
workload**. One full-video job per resolution warms the tools and is excluded
from reported latency. A running benchmark saves completed rounds in the JSON;
check that its final `status` is `passed` before quoting it.

## Timing and verification

- `clipReadyMs` starts immediately before the HTTP clipping request and ends after
  its JSON response has been read. It includes the actual yt-dlp download of the
  entire source fixture, external-process startup, and FFmpeg stream copying.
- `clipAndDownloadMs` additionally includes fetching the returned MP4 from the Go
  server and reading its full response body.
- Fixture generation, warmup, pacing, hashing, probing, and full output decoding
  are outside these timers. All jobs run sequentially; no validation runs in
  parallel with a timed job.
- p95 uses the nearest-rank method. With ten samples in an individual workload,
  p95 is its maximum; the pooled 80-sample p95 uses the 76th sorted observation.
- Every output is checked against its HTTP download hash, fully decoded by
  FFmpeg, and probed for codecs, dimensions, and duration. Every encoded audio and
  video packet payload hash must appear in the original fixture. The downloaded
  source file must also match the fixture's SHA-256.

The application names files with `time.Now().Unix()`. The harness waits until a
different Unix second before starting another job, preventing overlapping names.
This pacing is excluded from latency. These results establish no concurrent
capacity or sustained jobs-per-second figure.

FFmpeg stream copying can produce a small duration offset. The harness allows
0.15 seconds: in this run, requests for 15 seconds produced 15.134-second 720p
files and 15.100-second 1080p files. Do not describe these results as frame-accurate
cuts. [FFmpeg's documentation](https://ffmpeg.org/ffmpeg.html#Streamcopy) explains
that stream copying avoids decoding and encoding; the packet hash checks verify
that encoded payloads were retained in this experiment.

File-size reductions compare the returned clip with the full source fixture.
The backend still downloads the full source before clipping. These reductions
are not an optimization of source download bandwidth, and the two generated
fixtures do not represent every kind of video content.

## Environment

Intel Core i7-12700H host, 20 logical CPUs. The Linux container ran under Docker
Desktop / WSL2 on Windows with a **4-CPU quota and 2 GiB memory limit**. It used
Node.js 24.18.0, a Go 1.27.3 Linux/amd64 binary, FFmpeg/ffprobe
5.1.9-0+deb12u1, and [yt-dlp 2026.10.21](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.10.21).

The benchmark image used for this run was
`sha256:7048fee993265fde39337ebf6446d8b165dae787959804a337212d8a3ac9dbb1`.

Generated media and the backend's working files reside on a temporary in-memory
filesystem inside the container. The container runs with `--network none`; only
its internal loopback network is used. These are short, local measurements with
warm caches and no injected latency, retries, or external service failures.

The JSON intentionally excludes hostnames, account names, local home-directory
paths, and network identifiers. Hardware model and resource limits describe the
measurement environment without identifying a particular laptop.

## Reproduce

Install Go and Docker Desktop, start Docker's Linux engine, and make `go` and
`docker` available on `PATH`. From the repository root in PowerShell:

```powershell
./benchmarks/run.ps1
```

If Go is installed but the current terminal's `PATH` has not refreshed:

```powershell
./benchmarks/run.ps1 -GoCommand (Join-Path $env:ProgramFiles 'Go/bin/go.exe')
```

The script builds the unchanged backend with `-trimpath -buildvcs=false`, builds
the benchmark image, and runs the workload. Dependency installation needs
internet access; the measured container does not. It replaces `results.json`,
so retain a copy before rerunning if you want to keep this run. Different machines,
container limits, dependency packages, and background activity can change timing.
The base image and yt-dlp release are pinned, while Debian package updates can
change on a future rebuild; compare recorded tool versions when comparing runs.

The container removes itself when finished. Generated media is not committed.
The ignored `.cache/clipx-benchmark/` directory contains local compiler artifacts
and can be removed after the run.
