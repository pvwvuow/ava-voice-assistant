# -*- coding: utf-8 -*-
"""Generate AVA voice assistant app icon (PNG + ICO + favicon)."""
from PIL import Image, ImageDraw, ImageFilter

S = 512
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

# --- rounded-square dark base ---
d = ImageDraw.Draw(img)
d.rounded_rectangle([8, 8, S - 8, S - 8], radius=110, fill=(11, 16, 18, 255))

# subtle vertical green tint gradient
grad = Image.new("L", (1, S))
for y in range(S):
    grad.putpixel((0, y), max(0, int(26 * (1 - y / S))))
img.paste(Image.new("RGBA", (S, S), (22, 58, 48, 255)), (0, 0), grad.resize((S, S)))

cx, cy = S / 2, S / 2

# --- ambient glow ring ---
glow = Image.new("L", (S, S), 0)
gd = ImageDraw.Draw(glow)
for r in range(200, 0, -3):
    a = int(110 * (1 - r / 200) ** 1.6)
    gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=a)
img.paste(Image.new("RGBA", (S, S), (16, 185, 129, 255)), (0, 0), glow)

# --- bright core orb ---
core = Image.new("L", (S, S), 0)
cd = ImageDraw.Draw(core)
for r in range(118, 0, -2):
    t = r / 118
    cd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(235 * (1 - t) ** 0.55))
img.paste(Image.new("RGBA", (S, S), (52, 211, 153, 255)), (0, 0), core)

# --- audio wave bars (white) ---
bd = ImageDraw.Draw(img)
heights = [92, 156, 224, 156, 92]
bw, gap = 34, 24
total = 5 * bw + 4 * gap
x0 = (S - total) / 2
for i, hgt in enumerate(heights):
    x = x0 + i * (bw + gap)
    y0 = (S - hgt) / 2
    bd.rounded_rectangle([x, y0, x + bw, y0 + hgt], radius=bw / 2, fill=(255, 255, 255, 242))

# --- top specular highlight (liquid glass) ---
hl = Image.new("L", (S, S), 0)
hd = ImageDraw.Draw(hl)
hd.ellipse([S * 0.08, -S * 0.42, S * 0.92, S * 0.26], fill=64)
hl = hl.filter(ImageFilter.GaussianBlur(30))
img.paste(Image.new("RGBA", (S, S), (255, 255, 255, 255)), (0, 0), hl)

# --- border stroke ---
bd.rounded_rectangle([8, 8, S - 8, S - 8], radius=110, outline=(255, 255, 255, 30), width=3)

# --- save outputs ---
base = "/home/z/my-project/download/ava-voice-assistant"
img.save(f"{base}/assets/icon.png")
img.save(f"{base}/assets/icon.ico", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
img.resize((64, 64), Image.LANCZOS).save(f"{base}/renderer/favicon.png")
print("icons generated:", base)
