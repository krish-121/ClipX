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

