#!/usr/bin/env bash
# Integrated loudness, LRA, true peak and a half-second momentary loudness curve.
f="${1:-audio/soundtrack.wav}"
ffmpeg -hide_banner -nostats -i "$f" -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary:/,$p' | grep -E "I:|LRA:|Peak:" | tr -s ' '
ffmpeg -hide_banner -nostats -i "$f" -af "ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=-" -f null - 2>/dev/null \
 | awk '/pts_time/{split($0,a,"pts_time:"); t=a[2]} /lavfi.r128.M=/{split($0,b,"="); m=b[2]; k=int(t*2)/2; if(!(k in s)){s[k]=1; printf "%4.1f:%6.1f ", k, m; if(++c%6==0) printf "\n"}} END{printf "\n"}'
