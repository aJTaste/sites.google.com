#!/bin/bash
# deploy-icons.sh
# GitHub Codespacesのリポジトリルートで実行

set -e

ASSETS="public/sites.google.com/assets"

pip install cairosvg Pillow --break-system-packages -q

mkdir -p "$ASSETS"

ICON_PATH='M480-40q-50 0-85-35t-35-85q0-14 2.5-26.5T371-211L211-372q-12 5-25 8.5t-27 3.5q-50 0-84.5-35T40-480q0-50 34.5-85t84.5-35q39 0 70 22.5t43 57.5h95q9-26 28-44.5t45-27.5v-95q-35-12-57.5-43T360-800q0-50 35-85t85-35q50 0 85 35t35 85q0 14-3 27t-9 25l160 160q12-6 25-9t27-3q50 0 85 35t35 85q0 50-35 85t-85 35q-39 0-70-22.5T687-440h-95q-9 26-27.5 45T520-367v94q35 12 57.5 43t22.5 70q0 50-35 85t-85 35Zm-40-233v-94q-13-5-24-12t-20.5-16.5Q386-405 379-416t-12-24h-95q0 1-.5 2.5l-1 3q-.5 1.5-1 2.5l-1.5 3 29 29q24 24 51 51.5t51 51.5l29 29q2-1 3.5-1.5t3-1.5 3-1.5q1.5-.5 2.5-.5Zm152-247h95q0-2 .5-3.5t1.5-3 1.5-3q.5-1.5 1.5-2.5l-29-29-51-51-51-51-29-29q-1 1-2.5 1.5t-3 1.5-3 1.5q-1.5.5-3.5.5v95q12 4 23.5 11.5T564-564q9 9 16.5 20.5T592-520Zm208 80q17 0 28.5-11.5T840-480q0-17-11.5-28.5T800-520q-17 0-28.5 11.5T760-480q0 17 11.5 28.5T800-440Zm-320 0q17 0 28.5-11.5T520-480q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480q0 17 11.5 28.5T480-440Zm0 320q17 0 28.5-11.5T520-160q0-17-11.5-28.5T480-200q-17 0-28.5 11.5T440-160q0 17 11.5 28.5T480-120ZM160-440q17 0 28.5-11.5T200-480q0-17-11.5-28.5T160-520q-17 0-28.5 11.5T120-480q0 17 11.5 28.5T160-440Zm320-320q17 0 28.5-11.5T520-800q0-17-11.5-28.5T480-840q-17 0-28.5 11.5T440-800q0 17 11.5 28.5T480-760Z'

# --- SVG生成 ---
cat > "$ASSETS/icon-any.svg" << SVGEOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <svg x="0" y="0" width="512" height="512" viewBox="0 -960 960 960">
    <path fill="#FF6B35" d="${ICON_PATH}"/>
  </svg>
</svg>
SVGEOF

cat > "$ASSETS/icon-maskable.svg" << SVGEOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#FF6B35"/>
  <svg x="51" y="51" width="410" height="410" viewBox="0 -960 960 960">
    <path fill="#ffffff" d="${ICON_PATH}"/>
  </svg>
</svg>
SVGEOF

cat > "$ASSETS/icon-monochrome.svg" << SVGEOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <svg x="0" y="0" width="512" height="512" viewBox="0 -960 960 960">
    <path fill="#000000" d="${ICON_PATH}"/>
  </svg>
</svg>
SVGEOF

cat > "$ASSETS/favicon.svg" << SVGEOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="32" height="32">
  <path fill="#FF6B35" d="${ICON_PATH}"/>
</svg>
SVGEOF

echo "SVG生成完了"

# --- PNG・ICO生成 ---
python3 << 'PYEOF'
import cairosvg, os, io
from PIL import Image

a = "public/sites.google.com/assets"

def gen(src, dest, size):
    cairosvg.svg2png(url=src, write_to=dest, output_width=size, output_height=size)
    print(f"  ✓ {os.path.basename(dest)}")

# any
for s in [48,72,96,120,144,152,167,180,192,384,512]:
    gen(f"{a}/icon-any.svg", f"{a}/icon-{s}.png", s)

# apple-touch-icon (180px)
import shutil
shutil.copy(f"{a}/icon-180.png", f"{a}/apple-touch-icon.png")
print("  ✓ apple-touch-icon.png")

# maskable
for s in [192, 512]:
    gen(f"{a}/icon-maskable.svg", f"{a}/icon-maskable-{s}.png", s)

# monochrome
for s in [192, 512]:
    gen(f"{a}/icon-monochrome.svg", f"{a}/icon-monochrome-{s}.png", s)

# favicon.ico
imgs = []
for s in [16, 32, 48]:
    buf = io.BytesIO()
    cairosvg.svg2png(url=f"{a}/icon-any.svg", write_to=buf, output_width=s, output_height=s)
    buf.seek(0)
    imgs.append(Image.open(buf).convert("RGBA"))
imgs[0].save(f"{a}/favicon.ico", format="ICO", sizes=[(16,16),(32,32),(48,48)], append_images=imgs[1:])
print("  ✓ favicon.ico")

print("PNG/ICO生成完了")
PYEOF

echo "全ファイル生成完了！"
echo ""
echo "次に manifest.json を更新してください（deploy-icons.sh と同じディレクトリの manifest.json を参照）"