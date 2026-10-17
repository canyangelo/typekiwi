"""TypeKiwi logo: "translate", told with kiwis (in the spirit of the Google Translate logo's two overlapping cards).
Back, top left: a whole kiwi (brown skin) with a Latin "A". Front, bottom right and overlapping it: a kiwi slice
whose big cream core carries the second script (default "文", or "Я"). Kiwi palette below; transparent background;
the two shapes together fill the canvas so the toolbar icon looks as big as possible.

Run: py -3.12 tools/make_icons.py [文|Я]  -> icons/icon-{16,32,48,128}.png, icons/logo.png
At 16 px the letters are dropped (they'd be mush); the two kiwis alone keep the silhouette.
"""
import math
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

# Kiwi palette
SKIN = (184, 154, 97, 255)       # #B89A61
SKIN_DARK = (150, 122, 72, 255)  # skin shading / outline
LIGHT = (169, 199, 126, 255)     # #A9C77E inner flesh
GREEN = (97, 171, 90, 255)       # #61AB5A outer flesh
CREAM = (242, 236, 174, 255)     # #F2ECAE core
SEED = (86, 52, 41, 255)         # #563429 seeds and letters
S = 1024
OUT = Path(__file__).resolve().parent.parent / "icons"
LATIN_FONT = "C:/Windows/Fonts/seguibl.ttf"   # Segoe UI Black
CJK_FONT = "C:/Windows/Fonts/msyhbd.ttc"      # Microsoft YaHei Bold

BACK = (0.40, 0.40, 0.40)       # whole kiwi: centre x, y, radius (fractions of the canvas)
FRONT = (0.60, 0.60, 0.40)     # slice; both touch the edges so the toolbar icon fills its square


def circle(cx, cy, r, blur=0.0) -> Image.Image:
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).ellipse((S * (cx - r), S * (cy - r), S * (cx + r), S * (cy + r)), fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur)) if blur else m


def paint(img, mask, color):
    img.paste(Image.new("RGBA", (S, S), color), (0, 0), mask)


def radial(cx, cy, r) -> Image.Image:
    """255 at the centre, fading to 0 at radius r."""
    g = ImageChops.invert(Image.radial_gradient("L").resize((int(S * r * 2),) * 2, Image.BICUBIC))
    m = Image.new("L", (S, S), 0)
    m.paste(g, (int(S * (cx - r)), int(S * (cy - r))))
    return m


def glyph(img, ch, cx, cy, height, font_path, color):
    """Draw `ch` centred at (cx, cy) so its ink is `height` tall."""
    font = ImageFont.truetype(font_path, 100)
    l, t, r, b = font.getbbox(ch)
    font = ImageFont.truetype(font_path, int(100 * height / (b - t)))
    d = ImageDraw.Draw(img)
    l, t, r, b = d.textbbox((0, 0), ch, font=font)
    d.text((cx - (l + r) / 2, cy - (t + b) / 2), ch, font=font, fill=color)


def seed_polygon(x, y, angle, length, width):
    pts = []
    for k in range(24):
        t = 2 * math.pi * k / 24
        u, v = length * math.cos(t), width * math.sin(t) * (0.75 + 0.25 * math.cos(t))
        pts.append((x + u * math.cos(angle) - v * math.sin(angle), y + u * math.sin(angle) + v * math.cos(angle)))
    return pts


def draw(size_hint: int, second: str) -> Image.Image:
    tiny = size_hint <= 16
    small = size_hint <= 32
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # Back: whole kiwi, brown skin lit from the top left, with a fine fuzz of darker specks.
    bx, by, br = BACK
    paint(img, circle(bx, by, br), SKIN_DARK)
    paint(img, circle(bx - 0.012, by - 0.012, br - 0.018), SKIN)
    paint(img, ImageChops.multiply(circle(bx, by, br - 0.02), radial(bx - 0.09, by - 0.09, br * 0.9)), (205, 180, 128, 255))
    if not small:
        d = ImageDraw.Draw(img)
        for k in range(160):
            a, rr = k * 2.399, br * 0.93 * math.sqrt((k + 0.5) / 160)
            x, y = S * (bx + rr * math.cos(a)), S * (by + rr * math.sin(a))
            d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(160, 132, 82, 255))
    if not tiny:
        glyph(img, "A", S * (bx - 0.165), S * (by - 0.16), S * 0.235, LATIN_FONT, SEED)   # in the visible top-left part

    # Front: kiwi slice; a soft shadow where it overlaps the whole kiwi.
    fx, fy, fr = FRONT
    shadow = ImageChops.multiply(circle(fx - 0.006, fy - 0.006, fr + 0.012, blur=S * 0.01), circle(bx, by, br - 0.004))
    paint(img, shadow, (110, 84, 46, 255))   # darker skin tone, not grey
    paint(img, circle(fx, fy, fr), SKIN_DARK)
    paint(img, circle(fx, fy, fr - 0.012), SKIN)
    skin = 0.06 if tiny else 0.045 if small else 0.035
    flesh = circle(fx, fy, fr - skin)
    paint(img, flesh, GREEN)
    paint(img, ImageChops.multiply(flesh, radial(fx, fy, fr - skin)), LIGHT)
    if not small:
        fib = Image.new("L", (S, S), 0)
        fd = ImageDraw.Draw(fib)
        for k in range(64):
            a = 2 * math.pi * k / 64
            fd.line([(S * (fx + 0.17 * math.cos(a)), S * (fy + 0.17 * math.sin(a))),
                     (S * (fx + (fr - skin - 0.01) * math.cos(a)), S * (fy + (fr - skin - 0.01) * math.sin(a)))],
                    fill=60, width=int(S * 0.005))
        paint(img, ImageChops.multiply(fib, flesh), (232, 240, 200, 255))
    core = 0.17 if tiny else 0.175 if small else 0.17
    paint(img, circle(fx, fy, core, blur=S * 0.004), CREAM)

    # Seeds in a ring between the core and the skin.
    d = ImageDraw.Draw(img)
    ring_r = core + (fr - skin - core) * 0.5
    n = 8 if tiny else 11 if small else 16
    for k in range(n):
        a = 2 * math.pi * k / n + 0.2
        x, y = S * (fx + ring_r * math.cos(a)), S * (fy + ring_r * math.sin(a))
        L = 0.05 if tiny else 0.04 if small else 0.028
        d.polygon(seed_polygon(x, y, a, S * L, S * L * 0.48), fill=SEED)
    if not tiny:
        font = CJK_FONT if second == "文" else LATIN_FONT
        glyph(img, second, S * fx, S * fy, S * (0.21 if second == "文" else 0.20), font, SEED)
    return img


def main():
    second = sys.argv[1] if len(sys.argv) > 1 else "文"
    OUT.mkdir(exist_ok=True)
    for size in (16, 32, 48, 128):
        draw(size, second).resize((size, size), Image.LANCZOS).save(OUT / f"icon-{size}.png")
    draw(256, second).resize((256, 256), Image.LANCZOS).save(OUT / "logo.png")
    print("ok", ascii(second), sorted(p.name for p in OUT.iterdir()))  # ascii(): Windows consoles may not print 文


if __name__ == "__main__":
    main()
