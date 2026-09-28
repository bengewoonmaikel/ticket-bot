#!/usr/bin/env bash
# Two-pass encode of a share copy (same 2560x1440 60 fps spec) under 30 MiB.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="${TMPDIR:-/tmp}/ibdeals-x264pass"
out=renders/IBDeals-launch-film-2560x1440-60fps-share.mp4
ffmpeg -hide_banner -loglevel error -y -i renders/video.mp4 -c:v libx264 -preset slow -tune film -b:v 12300k \
  -pass 1 -passlogfile "$tmp" -an -f null /dev/null
ffmpeg -hide_banner -loglevel error -y -i renders/video.mp4 -i audio/soundtrack.wav -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset slow -tune film -b:v 12300k -maxrate 22M -bufsize 30M -pass 2 -passlogfile "$tmp" \
  -pix_fmt yuv420p -profile:v high -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest "$out"
ls -la "$out"
