"""Rebuild ALLIM's original card artwork. Pillow is needed only by this design tool."""

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FAMILIES = {
	"children": ((6, 28, 25), (108, 207, 185), (205, 244, 226), "ДЕТИ И ПЕРВЫЕ ШАГИ"),
	"tajwid": ((3, 18, 15), (34, 133, 101), (172, 222, 198), "ЧТЕНИЕ И ТАДЖВИД"),
	"hifz": ((3, 17, 15), (30, 94, 75), (218, 183, 109), "ХИФЗ И ПОВТОРЕНИЕ"),
	"tafsir": ((23, 7, 12), (147, 56, 73), (239, 180, 169), "ПОНИМАНИЕ И ТАФСИР"),
}


def cover(title, family, font_path):
	width, height = 1400, 700
	low, high, accent, label = FAMILIES[family]
	im = Image.new("RGB", (width, height))
	px = im.load()
	for y in range(height):
		for x in range(width):
			mix = max(0, min(1, 0.62 * x / width + 0.7 * (1 - y / height) - 0.25))
			px[x, y] = tuple(round(a + (b - a) * mix) for a, b in zip(low, high, strict=False))
	draw = ImageDraw.Draw(im, "RGBA")
	for cx, cy, radius in [(1250, 130, 210), (60, 650, 160)]:
		for r in [radius, radius * 0.72, radius * 0.45]:
			points = [
				(cx + math.cos(i * math.pi / 4) * r, cy + math.sin(i * math.pi / 4) * r) for i in range(8)
			]
			draw.line(points + [points[0]], fill=(*accent, 42), width=2)
			if family != "children":
				draw.line([points[i % 8] for i in range(0, 17, 3)], fill=(*accent, 27), width=2)
	if family == "children":
		for x, y, r in [(1150, 100, 15), (1280, 330, 11), (160, 490, 13), (1060, 560, 8)]:
			draw.line([(x - r, y), (x + r, y)], fill=(*accent, 150), width=3)
			draw.line([(x, y - r), (x, y + r)], fill=(*accent, 150), width=3)
		# A small open-book outline; no change to the ALLIM identity or logo.
		draw.line(
			[(1100, 580), (1100, 520), (1140, 530), (1180, 520), (1180, 580), (1140, 590), (1100, 580)],
			fill=(*accent, 140),
			width=4,
		)
		draw.line([(1140, 530), (1140, 590)], fill=(*accent, 140), width=4)
	draw.rounded_rectangle((65, 68, 660, 123), radius=27, fill=(0, 0, 0, 35), outline=(*accent, 70), width=1)
	font_small = ImageFont.truetype(font_path, 24)
	draw.text((90, 81), label, font=font_small, fill=(*accent, 255))
	font = ImageFont.truetype(font_path, 58)
	lines, current = [], ""
	for word in title.split():
		candidate = (current + " " + word).strip()
		if draw.textlength(candidate, font=font) > 1090 and current:
			lines.append(current)
			current = word
		else:
			current = candidate
	lines.append(current)
	y = 350 - len(lines) * 39
	for line in lines:
		draw.text((width / 2, y), line, font=font, fill=(255, 255, 250, 255), anchor="mt", stroke_width=0)
		y += 78
	draw.line((650, 570, 750, 570), fill=(*accent, 180), width=3)
	return im


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--font", required=True)
	args = parser.parse_args()
	manifest = json.loads((ROOT / "allimquran/public/data/academy-covers.json").read_text())
	out = ROOT / "allimquran/public/media/academy-covers"
	out.mkdir(parents=True, exist_ok=True)
	for item in manifest["covers"]:
		cover(item["title"], item["family"], args.font).save(out / item["file"], quality=90, optimize=True)
	print(f"Built {len(manifest['covers'])} original gradient covers")


if __name__ == "__main__":
	main()
