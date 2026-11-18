#!/usr/bin/env bash
# loopify.sh in.mp4 out.mp4 fade_seconds [pre_filter]
# Seamless loop: the last F seconds crossfade into the first F seconds; output length = D - F.
set -e
IN=$1; OUT=$2; F=$3; PRE=${4:-null}
TMP=$(mktemp -d)
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
T=$(python3 -c "print(round($D-$F-0.05,3))")
enc="-an -c:v libx264 -crf 12 -preset fast -pix_fmt yuv420p -r 24"
ffmpeg -v error -y -i "$IN" -vf "$PRE" $enc "$TMP/all.mp4"
ffmpeg -v error -y -ss 0 -t $F -i "$TMP/all.mp4" $enc "$TMP/head.mp4"
ffmpeg -v error -y -ss $T -t $F -i "$TMP/all.mp4" $enc "$TMP/tail.mp4"
ffmpeg -v error -y -ss $F -to $T -i "$TMP/all.mp4" $enc "$TMP/body.mp4"
ffmpeg -v error -y -i "$TMP/tail.mp4" -i "$TMP/head.mp4" -filter_complex "[0:v]settb=1/24,fps=24[a];[1:v]settb=1/24,fps=24[b];[a][b]xfade=transition=fade:duration=$(python3 -c "print($F-0.05)"):offset=0" $enc "$TMP/seam.mp4"
printf "file '%s'\nfile '%s'\n" "$TMP/body.mp4" "$TMP/seam.mp4" > "$TMP/list.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$TMP/list.txt" $enc "$OUT"
rm -rf "$TMP"
