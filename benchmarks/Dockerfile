FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d

ARG YTDLP_VERSION=2026.10.21

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg python3 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fL --retry 3 \
    "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp" \
    -o /usr/local/bin/yt-dlp \
    && chmod 755 /usr/local/bin/yt-dlp

WORKDIR /run/clipx-benchmark
ENTRYPOINT ["node", "/bench/run.cjs"]
