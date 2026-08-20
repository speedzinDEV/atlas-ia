from PIL import Image, ImageDraw, ImageFont

BG = (2, 11, 36)          # --atlas-bg
SURFACE = (10, 29, 70)    # --atlas-surface-2
PRIMARY = (8, 124, 255)   # --atlas-primary
BRIGHT = (25, 167, 255)   # --atlas-primary-bright
TEXT = (244, 248, 255)    # --atlas-text

def radial_bg(size, center_color, edge_color):
    img = Image.new("RGB", (size, size), edge_color)
    px = img.load()
    cx, cy = size / 2, size / 2
    maxd = (cx ** 2 + cy ** 2) ** 0.5
    for y in range(size):
        for x in range(size):
            d = (((x - cx) ** 2 + (y - cy) ** 2) ** 0.5) / maxd
            t = min(1.0, d)
            r = int(center_color[0] + (edge_color[0] - center_color[0]) * t)
            g = int(center_color[1] + (edge_color[1] - center_color[1]) * t)
            b = int(center_color[2] + (edge_color[2] - center_color[2]) * t)
            px[x, y] = (r, g, b)
    return img

def draw_A(draw, cx, cy, scale, color, stroke):
    # simple geometric "A" mark: two diagonals + crossbar
    w = scale
    top = (cx, cy - w * 0.62)
    left = (cx - w * 0.55, cy + w * 0.58)
    right = (cx + w * 0.55, cy + w * 0.58)
    draw.line([top, left], fill=color, width=stroke, joint="curve")
    draw.line([top, right], fill=color, width=stroke, joint="curve")
    bar_y = cy + w * 0.12
    bar_half = w * 0.28
    draw.line([(cx - bar_half, bar_y), (cx + bar_half, bar_y)], fill=color, width=int(stroke * 0.85))

# ---- App icon (foreground, transparent-safe square) ----
ICON_SIZE = 1024
icon = radial_bg(ICON_SIZE, BRIGHT, BG)
d = ImageDraw.Draw(icon)
# rounded card behind the A for depth
pad = int(ICON_SIZE * 0.12)
d.rounded_rectangle([pad, pad, ICON_SIZE - pad, ICON_SIZE - pad], radius=int(ICON_SIZE * 0.22), fill=SURFACE)
draw_A(d, ICON_SIZE / 2, ICON_SIZE / 2 + ICON_SIZE * 0.02, ICON_SIZE * 0.32, TEXT, int(ICON_SIZE * 0.075))
icon.save("icon.png")

# foreground-only version for adaptive icons (transparent bg, just the mark)
fg = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
dfg = ImageDraw.Draw(fg)
draw_A(dfg, ICON_SIZE / 2, ICON_SIZE / 2, ICON_SIZE * 0.30, TEXT, int(ICON_SIZE * 0.075))
fg.save("icon-foreground.png")

# background-only (solid, for adaptive icon)
bg_only = radial_bg(ICON_SIZE, BRIGHT, BG)
bg_only.save("icon-background.png")

# ---- Splash screen ----
SPLASH_SIZE = 2732
splash = Image.new("RGB", (SPLASH_SIZE, SPLASH_SIZE), BG)
ds = ImageDraw.Draw(splash)
cx, cy = SPLASH_SIZE / 2, SPLASH_SIZE / 2 - SPLASH_SIZE * 0.05
mark_scale = SPLASH_SIZE * 0.12
draw_A(ds, cx, cy, mark_scale, BRIGHT, int(SPLASH_SIZE * 0.018))

try:
    font_big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(SPLASH_SIZE * 0.055))
    font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", int(SPLASH_SIZE * 0.022))
except Exception:
    font_big = ImageFont.load_default()
    font_small = ImageFont.load_default()

title = "ATLAS"
tb = ds.textbbox((0, 0), title, font=font_big)
tw = tb[2] - tb[0]
ds.text((cx - tw / 2, cy + mark_scale * 0.9), title, fill=TEXT, font=font_big)

subtitle = "Seu assistente de IA"
sb = ds.textbbox((0, 0), subtitle, font=font_small)
sw = sb[2] - sb[0]
ds.text((cx - sw / 2, cy + mark_scale * 0.9 + (tb[3]-tb[1]) * 1.6), subtitle, fill=(143, 168, 202), font=font_small)

splash.save("splash.png")
splash.save("splash-dark.png")

print("done")
