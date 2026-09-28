#!/usr/bin/env bash
# Mux the HyperFrames render with the synthesized soundtrack.
# usage: tools/mux.sh <video.mp4> <soundtrack.wav> <out.mp4>
set -euo pipefail
v="${1:-renders/video.mp4}"
a="${2:-audio/soundtrack.wav}"
o="${3:-renders/ibdeals-launch.mp4}"
ffmpeg -hide_banner -loglevel error -y -i "$v" -i "$a" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 \
  -movflags +faststart -shortest "$o"
ffprobe -v error -show_entries stream=codec_type,codec_name,profile,width,height,r_frame_rate,pix_fmt,sample_rate,channels,bit_rate \
  -show_entries format=duration,size,bit_rate -of compact "$o"
