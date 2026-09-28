"""
generate_favicons.py
────────────────────
Copies NIRA brand images into public/ and generates all favicon/icon sizes.

Usage:
    python scripts/generate_favicons.py
"""

import os
import struct
import zlib
from PIL import Image

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
PUBLIC_DIR  = os.path.join(PROJECT_DIR, "public")
BRAIN_DIR   = os.path.join(
    os.path.expanduser("~"),
    r".gemini\antigravity-ide\brain\4b3988e1-ea5f-45b6-9ab3-2d956b0de571",
)

# Generated image file names (update if they differ)
MARK_SRC = os.path.join(BRAIN_DIR, "nira_mark_clean_1790609727923.jpg")
LOGO_SRC = os.path.join(BRAIN_DIR, "nira_logo_full_1790609766894.jpg")

BG = (247, 248, 245, 255)   # #F7F8F5 warm ivory


def ensure_rgba(img: Image.Image) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    return img


def on_ivory(img: Image.Image, size: int, pad_pct: float = 0.08) -> Image.Image:
    """Resize *img* to fit inside a padded ivory square of *size* px."""
    canvas  = Image.new("RGBA", (size, size), BG)
    padpx   = int(size * pad_pct)
    inner   = size - 2 * padpx
    src     = ensure_rgba(img).copy()
    src.thumbnail((inner, inner), Image.LANCZOS)
    w, h    = src.size
    off     = ((size - w) // 2, (size - h) // 2)
    canvas.paste(src, off, src)
    return canvas


def save_png(img: Image.Image, path: str) -> None:
    img.convert("RGBA").save(path, "PNG", optimize=True)
    print(f"  ✔ {os.path.basename(path):30s}  {img.size[0]}×{img.size[1]}")


def save_ico(sizes_px: list, src: Image.Image, path: str) -> None:
    """Build a proper multi-resolution .ico file from PIL images."""
    frames = [on_ivory(src, s, pad_pct=0.05).convert("RGBA") for s in sizes_px]
    # PIL's own ICO writer handles multi-size just fine
    frames[0].save(
        path,
        format="ICO",
        sizes=[(s, s) for s in sizes_px],
        append_images=frames[1:],
    )
    print(f"  ✔ {'favicon.ico':30s}  {'+'.join(str(s) for s in sizes_px)} px")


def main() -> None:
    os.makedirs(PUBLIC_DIR, exist_ok=True)

    # ── Validate sources ─────────────────────────────────────────────────────
    for label, path in [("mark", MARK_SRC), ("logo", LOGO_SRC)]:
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Source {label} not found:\n  {path}\n"
                "Update the path constants at the top of this script."
            )

    mark = Image.open(MARK_SRC)
    logo = Image.open(LOGO_SRC)
    print(f"Loaded mark : {mark.size}  mode={mark.mode}")
    print(f"Loaded logo : {logo.size}  mode={logo.mode}")
    print()

    # ── nira-mark.png  (512 canonical square) ────────────────────────────────
    mark_512 = on_ivory(mark, 512, pad_pct=0.07)
    save_png(mark_512, os.path.join(PUBLIC_DIR, "nira-mark.png"))

    # ── nira-logo.png  (full logo, 512 square) ───────────────────────────────
    logo_512 = on_ivory(logo, 512, pad_pct=0.06)
    save_png(logo_512, os.path.join(PUBLIC_DIR, "nira-logo.png"))

    # ── favicon-32x32.png ────────────────────────────────────────────────────
    save_png(on_ivory(mark, 32, 0.05),  os.path.join(PUBLIC_DIR, "favicon-32x32.png"))

    # ── favicon-16x16.png ────────────────────────────────────────────────────
    save_png(on_ivory(mark, 16, 0.04),  os.path.join(PUBLIC_DIR, "favicon-16x16.png"))

    # ── apple-touch-icon.png  (180×180) ──────────────────────────────────────
    save_png(on_ivory(mark, 180, 0.08), os.path.join(PUBLIC_DIR, "apple-touch-icon.png"))

    # ── icon-192.png  (PWA / Android) ────────────────────────────────────────
    save_png(on_ivory(mark, 192, 0.07), os.path.join(PUBLIC_DIR, "icon-192.png"))

    # ── icon-512.png  (PWA / Android) ────────────────────────────────────────
    save_png(on_ivory(mark, 512, 0.07), os.path.join(PUBLIC_DIR, "icon-512.png"))

    # ── favicon.ico  (16 + 32 + 48 bundled) ──────────────────────────────────
    save_ico([16, 32, 48], mark, os.path.join(PUBLIC_DIR, "favicon.ico"))

    print()
    print("✅  All assets written to:", PUBLIC_DIR)


if __name__ == "__main__":
    main()
