# ClipX

Download a video from X/Twitter, or save a clip by specifying start and end times.
The project contains a Next.js frontend in `client/` and a Go backend in `server/`.

## Run locally

Requirements: Node.js with npm, Go 1.23.3 or newer, and `yt-dlp` and `ffmpeg`
available on your `PATH`.

Start the backend from `server/`:

```sh
go run .
```

In a second terminal, start the frontend from `client/`:

```sh
npm ci
npm run dev
```

Open [ClipX locally](http://localhost:3000).

## Configuration

| Variable | Process | Default | Purpose |
| --- | --- | --- | --- |
| `CLIPX_BACKEND_URL` | Next.js server | `http://localhost:9000` | Backend used by the clipping action. |
| `PORT` | Go server | `9000` | Backend listening port. |
| `BASE_URL` | Go server | `http://localhost:<PORT>` | Backend address used in returned download URLs. It must be reachable by the Next.js server. |

For a custom deployment, set these variables in the environment of the appropriate
process. The frontend can also load `client/.env.local`; copy `client/.env.example`
as a starting point. The Go server reads process environment variables directly.
`server/.env.example` documents them and is not automatically loaded.

Downloaded videos are stored in `server/download/` when the backend is started
from `server/`. Environment files, downloads, logs, build output, and local editor
settings are ignored by Git.

## Build

Run `npm run build` from `client/` and `go build -trimpath -buildvcs=false -o server .`
from `server/` (use `server.exe` on Windows). The Go flags prevent local source
paths and Git metadata from being embedded in the binary.

## Local benchmarks

The existing Go backend completed **80/80 clip/download jobs** across generated
720p and 1080p test videos, with **934 ms median and 975 ms p95 clip-ready latency**
in sequential local tests. Each output passed full decoding and integrity checks.

For a 15-second range requested from the 60-second 1080p fixture, median
clip-ready latency was **945 ms**, and the returned file was **76.3% smaller**
than the full source. These measurements use real yt-dlp and FFmpeg over local
HTTP; live X/Twitter downloads and the Next.js/browser path are outside the test.

See the [methodology and raw results](benchmarks/README.md) and
[copy-ready CV entry](benchmarks/CV.md).

