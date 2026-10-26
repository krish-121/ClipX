# ClipX CV entry

Copy the following project entry:

**ClipX — Video Downloader & Clipper | Next.js, TypeScript, Go, yt-dlp, FFmpeg**

- Built a full-stack video clipping application with a Next.js frontend and Go HTTP backend, supporting four trim modes and downloadable MP4 output.
- Benchmarked 80 local video-processing jobs across 720p and 1080p fixtures, measuring approximately 934 ms median and 975 ms p95 clip-ready latency; validated all 80 outputs through full decoding and media-integrity checks.
- Generated 15-second 1080p clips from 60-second test videos in approximately 945 ms median, returning files 76% smaller than the source while preserving encoded H.264/AAC packet payloads.

## Measurement evidence

Measured on 26 October 2026 using the existing Go application source, without
functional changes or external-tool mocks. Real yt-dlp and FFmpeg ran against
locally served, generated video. These are backend measurements; the browser,
Next.js handlers, and live X/Twitter downloads were outside the measured path.

| Measurement | Result | Scope |
| --- | --- | --- |
| Measured jobs | 80 successful / 80 attempted; zero observed failures | 2 resolutions × 4 modes × 10 trials |
| Clip-ready latency, pooled | Median 934.3474 ms; p95 975.3475 ms | All 80 jobs; POST `/clip` through JSON response |
| 1080p range clip, ready | Median 944.8856 ms; p95 972.3988 ms | 10 trials requesting seconds 15–30 from a 60-second fixture |
| 1080p range clip, including returned-file download | Median 956.3102 ms; p95 983.6739 ms | Same 10 trials, including the Go `/download/` response body |
| 1080p source fixture size | 42,460,414 bytes | 60 seconds, 1920 × 1080, 30 fps, H.264 + AAC |
| 1080p range clip size | 10,053,112 bytes | 76.3236% smaller than that source fixture |
| Output validation | All 80 decoded successfully and passed every recorded check | Input/output hashes, dimensions, codecs, duration tolerance, and source packet payload membership |
| Encoded packets checked | 206,500 | Every output audio/video packet across the 80 measured jobs |

The host used an Intel Core i7-12700H. Docker Desktop / WSL2 ran the Linux
container with a 4-CPU quota and 2 GiB memory limit. Tools: Go 1.27.3,
Node.js 24.18.0, FFmpeg/ffprobe 5.1.9, and yt-dlp 2026.10.21.

Two warmup jobs were excluded. Jobs ran sequentially and were paced to avoid
the existing second-based output filename collisions. Latency excludes fixture
generation, pacing, probing, hashing, and full-decoding validation. The p95 uses
nearest rank; each individual 10-trial workload's p95 is its maximum.

The requested 15-second 1080p clips had a measured container duration of
15.100 seconds; stream-copy cuts are not claimed to be frame-accurate. Size
reduction is for the returned clip; the backend still downloads the entire source.

Use the phrases **local benchmark** and **generated test videos** when discussing
these figures. The observations do not establish production capacity, concurrent
job support, a general 100% reliability rate, or sub-second live X/Twitter downloads.

- [Raw results, all 80 trials, and both warmups](results.json)
- [Methodology, limitations, and reproduction](README.md)
- [Benchmark harness](run.cjs)
