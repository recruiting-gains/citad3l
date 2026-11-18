#!/usr/bin/env bash
# Encode web versions of the loops into public/media (H.264 MP4 + VP9 WebM + poster JPG/AVIF).
set -e
cd "$(dirname "$0")"
OUT=../public/media
enc() { # name src width crf_x264 crf_vp9
  local n=$1 src=$2 w=$3 cx=$4 cv=$5
  ffmpeg -v error -y -i "$src" -vf "scale=$w:-2:flags=lanczos,format=yuv420p" -an -c:v libx264 -profile:v high -preset veryslow -crf $cx -g 48 -movflags +faststart "$OUT/$n.mp4"
  ffmpeg -v error -y -i "$src" -vf "scale=$w:-2:flags=lanczos,format=yuv420p" -an -c:v libvpx-vp9 -b:v 0 -crf $cv -row-mt 1 -deadline good -cpu-used 2 -g 48 "$OUT/$n.webm"
  ffmpeg -v error -y -i "$src" -vf "select=eq(n\,0),scale=$( [ $w -gt 1280 ] && echo 1280 || echo $w ):-2:flags=lanczos" -frames:v 1 -q:v 3 "$OUT/$n-poster.jpg"
  python3 -c "from PIL import Image; Image.open('$OUT/$n-poster.jpg').save('$OUT/$n-poster.avif', quality=55)"
}
enc rook-hero loop/rook_1080_pingpong.mp4 1920 30 40
# hero WebM: CRF VP9 came out larger than the MP4 (glass grain), so use 2-pass ABR ~1.4 Mb/s instead
for pass in 1 2; do ffmpeg -v error -y -i loop/rook_1080_pingpong.mp4 -vf "scale=1920:-2,format=yuv420p" -an -c:v libvpx-vp9 -b:v 1400k -maxrate 1800k -bufsize 3000k -row-mt 1 -deadline good -cpu-used 2 -g 48 -pass $pass $( [ $pass = 1 ] && echo "-f null /dev/null" || echo "$OUT/rook-hero.webm" ); done; rm -f ffmpeg2pass*
enc rook      loop/rook_v2.mp4       1280 28 38
enc ai        loop/ai_v2.mp4          960 28 38
enc robotics  loop/robotics_v2.mp4    960 28 38
enc cyber     loop/cyber_v2.mp4       960 28 38
enc everyday  loop/everyday_v1.mp4    960 28 38
# hero chip stills (square, 160px)
python3 - <<'PY'
from PIL import Image
def sq(src, out, cx=0.5, cy=0.5, frac=1.0):
    im = Image.open(src).convert("RGB"); w, h = im.size; s = int(min(w, h) * frac)
    x = int(cx * w - s / 2); y = int(cy * h - s / 2); x = max(0, min(w - s, x)); y = max(0, min(h - s, y))
    im.crop((x, y, x + s, y + s)).resize((160, 160), Image.LANCZOS).save(out, quality=82)
O = "../public/media/"
sq("stills/rook_glyph.jpg", O + "chip-rook.jpg", 0.5, 0.40, 0.9)
sq("stills/ai_first.jpg", O + "chip-ai.jpg", 0.40, 0.5, 0.8)
sq("stills/robotics_first.jpg", O + "chip-robotics.jpg", 0.47, 0.42, 0.7)
sq("stills/cyber_first.jpg", O + "chip-cyber.jpg", 0.66, 0.5, 0.7)
PY
