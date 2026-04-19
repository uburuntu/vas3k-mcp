"""Composite the hero tag onto the OG source image.

Usage: og-overlay.py <input> <output>

Cover-crops the input to 1200x630, then draws the rounded-pill hero tag
'✖ Вастрик.Клуб MCP' top-left, mirroring the landing page's `.hero-tag`
style (yellow accent, dark text, full-pill radius). The X mark is drawn
as two vector strokes so we don't depend on a font that ships U+2716.
Writes lossless PNG; the downstream `cwebp` pass controls quality.
"""

import sys

from PIL import Image, ImageDraw, ImageFont

# Mirrors landing.ts `.hero-tag` colors:
#   --accent: rgba(255, 196, 85, 0.91)
#   color: #333
ACCENT_RGBA = (255, 196, 85, 232)
TEXT_RGB = (51, 51, 51)
TEXT = "\u0412\u0430\u0441\u0442\u0440\u0438\u043a.\u041a\u043b\u0443\u0431 MCP"

# OG card dimensions per the og:image:width/height meta tags.
TARGET_W, TARGET_H = 1200, 630

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
]


def load_font(size: int) -> ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def cover_crop(img: Image.Image, w: int, h: int) -> Image.Image:
    """Resize + center-crop to (w, h) preserving aspect."""
    src_w, src_h = img.size
    src_ratio = src_w / src_h
    target_ratio = w / h
    if src_ratio > target_ratio:
        new_h = h
        new_w = round(new_h * src_ratio)
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        left = (new_w - w) // 2
        return img.crop((left, 0, left + w, h))
    new_w = w
    new_h = round(new_w / src_ratio)
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    top = (new_h - h) // 2
    return img.crop((0, top, w, top + h))


def main() -> None:
    if len(sys.argv) != 3:
        print("usage: og-overlay.py <input> <output>", file=sys.stderr)
        sys.exit(1)

    img = cover_crop(Image.open(sys.argv[1]).convert("RGB"), TARGET_W, TARGET_H)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    font = load_font(34)
    text_bbox = draw.textbbox((0, 0), TEXT, font=font)
    text_w = text_bbox[2] - text_bbox[0]
    text_h = text_bbox[3] - text_bbox[1]

    # Hand-drawn-style heavy X to the left of the text. Size it to the
    # text x-height so it visually anchors with the letterforms.
    x_size = round(text_h * 0.95)
    x_gap = 14  # space between X and text

    pad_x, pad_y = 22, 12
    pill_w = pad_x * 2 + x_size + x_gap + text_w
    pill_h = pad_y * 2 + text_h

    margin = 36
    x, y = margin, margin

    # Pill background
    draw.rounded_rectangle(
        (x, y, x + pill_w, y + pill_h),
        radius=pill_h // 2,
        fill=ACCENT_RGBA,
    )

    # X mark — two crossing strokes
    x_left = x + pad_x
    x_top = y + pad_y + (text_h - x_size) // 2
    stroke = max(4, x_size // 6)
    draw.line(
        ((x_left, x_top), (x_left + x_size, x_top + x_size)),
        fill=TEXT_RGB,
        width=stroke,
    )
    draw.line(
        ((x_left, x_top + x_size), (x_left + x_size, x_top)),
        fill=TEXT_RGB,
        width=stroke,
    )

    # Text
    draw.text(
        (x_left + x_size + x_gap - text_bbox[0], y + pad_y - text_bbox[1]),
        TEXT,
        font=font,
        fill=TEXT_RGB,
    )

    composited = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    composited.save(sys.argv[2], "PNG", optimize=True)


if __name__ == "__main__":
    main()
