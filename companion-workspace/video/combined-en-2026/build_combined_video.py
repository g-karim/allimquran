from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
STOCK = ROOT / "assets" / "stock"
WORK = ROOT / "work"
OUTPUT = ROOT / "output"
PROJECT = ROOT.parent.parent
UI = ROOT.parent / "pov-en-2026" / "assets"
VOICE = ROOT.parent / "pov-en-2026" / "work" / "narration-en-approved.mp3"
FFMPEG = Path(
    "/Applications/Compass.app/Contents/Resources/app.asar.unpacked/"
    "node_modules/ffmpeg-static/ffmpeg"
)

WIDTH = 1080
HEIGHT = 1920
FPS = 30
FADE = 0.35

MASTER = OUTPUT / "ALLIM-Quran-Combined-POV-EN-1080x1920.mp4"
WEB = OUTPUT / "ALLIM-Quran-Combined-POV-EN-Web-720x1280.mp4"
POSTER = OUTPUT / "ALLIM-Quran-Combined-POV-EN-poster.jpg"
CONTACT = OUTPUT / "ALLIM-Quran-Combined-POV-EN-contact-sheet.jpg"
CAPTIONS = OUTPUT / "ALLIM-Quran-Combined-POV-EN.vtt"

IVORY = (247, 244, 235)
EMERALD = (7, 52, 44)
EMERALD_DARK = (3, 28, 24)
GOLD = (196, 155, 82)


def run(command: list[str]) -> None:
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode:
        raise RuntimeError(
            f"Command failed ({result.returncode}): {' '.join(command)}\n"
            f"{result.stdout}\n{result.stderr}"
        )


def media_duration(path: Path) -> float:
    result = subprocess.run(
        [str(FFMPEG), "-hide_banner", "-i", str(path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    for line in result.stderr.splitlines():
        if "Duration:" not in line:
            continue
        stamp = line.split("Duration:", 1)[1].split(",", 1)[0].strip()
        hours, minutes, seconds = stamp.split(":")
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    raise RuntimeError(f"Unable to read duration for {path}")


def font(size: int, *, serif: bool = False, bold: bool = False) -> ImageFont.FreeTypeFont:
    if serif:
        path = (
            "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
            if bold
            else "/System/Library/Fonts/Supplemental/Georgia.ttf"
        )
    else:
        path = "/System/Library/Fonts/Avenir Next.ttc"
    return ImageFont.truetype(path, size=size)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def rounded_image(image: Image.Image, size: tuple[int, int], radius: int) -> Image.Image:
    rendered = image.resize(size, Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255
    )
    rendered.putalpha(mask)
    return rendered


def centered_text(
    draw: ImageDraw.ImageDraw,
    y: int,
    text: str,
    selected_font: ImageFont.FreeTypeFont,
    fill: tuple[int, ...],
) -> None:
    box = draw.textbbox((0, 0), text, font=selected_font)
    x = (WIDTH - (box[2] - box[0])) / 2
    draw.text((x, y), text, font=selected_font, fill=fill)


def make_ui_plate(ui_name: str, target_name: str, kicker: str, caption: str) -> Path:
    ui = Image.open(UI / ui_name).convert("RGB")
    background = cover(ui, (WIDTH, HEIGHT)).filter(ImageFilter.GaussianBlur(54)).convert("RGBA")
    background = Image.alpha_composite(
        background,
        Image.new("RGBA", (WIDTH, HEIGHT), EMERALD_DARK + (224,)),
    )

    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    centered_text(draw, 34, kicker.upper(), font(22, bold=True), GOLD + (255,))

    screen_h = 1688
    screen_w = round(screen_h * ui.width / ui.height)
    screen_x = (WIDTH - screen_w) // 2
    screen_y = 104

    shadow = Image.new("RGBA", (screen_w + 90, screen_h + 90), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (45, 45, screen_w + 44, screen_h + 44), radius=46, fill=(0, 0, 0, 170)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    layer.alpha_composite(shadow, (screen_x - 45, screen_y - 26))
    layer.alpha_composite(rounded_image(ui, (screen_w, screen_h), 38), (screen_x, screen_y))
    draw.rounded_rectangle(
        (screen_x - 2, screen_y - 2, screen_x + screen_w + 1, screen_y + screen_h + 1),
        radius=40,
        outline=(255, 255, 255, 78),
        width=2,
    )
    centered_text(draw, 1830, caption, font(25, bold=True), IVORY + (244,))
    background.alpha_composite(layer)

    target = WORK / target_name
    background.convert("RGB").save(target, quality=96, subsampling=0)
    return target


def make_end_card() -> Path:
    image = Image.new("RGBA", (WIDTH, HEIGHT), EMERALD_DARK + (255,))
    draw = ImageDraw.Draw(image)
    for radius, alpha in ((340, 28), (520, 18), (700, 10)):
        draw.ellipse(
            (WIDTH // 2 - radius, 590 - radius, WIDTH // 2 + radius, 590 + radius),
            outline=GOLD + (alpha,),
            width=2,
        )

    # Use the exact production wordmark shown in the current site header.
    logo_path = PROJECT / "homepage" / "allim-header-logo.png"
    logo_source = Image.open(logo_path).convert("RGBA")
    logo_w = 760
    logo_h = round(logo_source.height * logo_w / logo_source.width)
    logo_source = logo_source.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
    image.alpha_composite(logo_source, ((WIDTH - logo_w) // 2, 245))

    centered_text(draw, 705, "One ayah today.", font(73, serif=True), IVORY + (255,))
    centered_text(draw, 805, "A stronger heart tomorrow.", font(53, serif=True), IVORY + (250,))
    centered_text(
        draw,
        1000,
        "READ  ·  UNDERSTAND  ·  REMEMBER  ·  LIVE IT",
        font(22, bold=True),
        GOLD + (255,),
    )
    draw.rounded_rectangle((174, 1165, WIDTH - 174, 1287), radius=26, fill=IVORY + (255,))
    centered_text(draw, 1204, "Begin at allimquran.com", font(34, bold=True), EMERALD_DARK + (255,))
    centered_text(draw, 1485, "Learn the Book. Live by it.", font(39, serif=True), IVORY + (235,))

    target = WORK / "10-end-card.jpg"
    image.convert("RGB").save(target, quality=96, subsampling=0)
    return target


def build_live_scene(
    index: int,
    source: Path,
    start: float,
    duration: float,
    *,
    horizontal: bool = False,
) -> Path:
    target = WORK / f"scene-{index:02d}.mp4"
    crop = (
        "scale=-2:1920:flags=lanczos,crop=1080:1920"
        if horizontal
        else "scale=1080:1920:flags=lanczos"
    )
    video_filter = (
        f"{crop},"
        "eq=contrast=1.035:saturation=0.91:gamma=0.98,"
        "vignette=PI/10,format=yuv420p"
    )
    run(
        [
            str(FFMPEG),
            "-y",
            "-hide_banner",
            "-ss",
            f"{start:.2f}",
            "-i",
            str(source),
            "-t",
            f"{duration:.2f}",
            "-vf",
            video_filter,
            "-an",
            "-r",
            str(FPS),
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            str(target),
        ]
    )
    return target


def build_app_scene(index: int, source: Path, duration: float, direction: str) -> Path:
    target = WORK / f"scene-{index:02d}.mp4"
    frames = round(duration * FPS)
    x_shift = -12 if direction == "left" else 12
    video_filter = (
        "scale=1166:2074:force_original_aspect_ratio=increase:flags=lanczos,"
        "crop=1166:2074,"
        f"zoompan=z='min(zoom+0.00016,1.022)':"
        f"x='iw/2-(iw/zoom/2)+({x_shift})*on/{frames}':"
        "y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,"
        "format=yuv420p"
    )
    run(
        [
            str(FFMPEG),
            "-y",
            "-hide_banner",
            "-loop",
            "1",
            "-framerate",
            str(FPS),
            "-i",
            str(source),
            "-vf",
            video_filter,
            "-t",
            f"{duration:.2f}",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            str(target),
        ]
    )
    return target


def assemble(clips: list[Path], durations: list[float]) -> float:
    command = [str(FFMPEG), "-y", "-hide_banner"]
    for clip in clips:
        command += ["-i", str(clip)]
    audio_index = len(clips)
    command += ["-i", str(VOICE)]

    filters: list[str] = []
    label = "0:v"
    elapsed = durations[0]
    for index in range(1, len(clips)):
        next_label = f"v{index}"
        offset = elapsed - FADE
        filters.append(
            f"[{label}][{index}:v]xfade=transition=fade:"
            f"duration={FADE:.2f}:offset={offset:.2f}[{next_label}]"
        )
        label = next_label
        elapsed += durations[index] - FADE

    final_duration = elapsed
    filters.append(
        f"[{audio_index}:a]aresample=48000,adelay=450:all=1,"
        "highpass=f=72,lowpass=f=12500,"
        "acompressor=threshold=-19dB:ratio=2.2:attack=14:release=180:makeup=1.8dB,"
        f"apad=pad_dur=2,atrim=duration={final_duration:.2f},"
        f"afade=t=out:st={max(0, final_duration - 0.9):.2f}:d=0.8[voice];"
        f"anoisesrc=color=pink:amplitude=0.0016:r=48000:d={final_duration:.2f},"
        "highpass=f=100,lowpass=f=3000[room];"
        "[voice][room]amix=inputs=2:duration=longest:weights='1 0.32':normalize=0[a]"
    )

    command += [
        "-filter_complex",
        ";".join(filters),
        "-map",
        f"[{label}]",
        "-map",
        "[a]",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        "-t",
        f"{final_duration:.2f}",
        str(MASTER),
    ]
    run(command)
    return final_duration


def build_review_assets() -> None:
    run(
        [
            str(FFMPEG),
            "-y",
            "-hide_banner",
            "-i",
            str(MASTER),
            "-vf",
            "scale=720:1280:flags=lanczos",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "22",
            "-maxrate",
            "1800k",
            "-bufsize",
            "3600k",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            str(WEB),
        ]
    )
    run(
        [
            str(FFMPEG),
            "-y",
            "-hide_banner",
            "-ss",
            "1.80",
            "-i",
            str(MASTER),
            "-frames:v",
            "1",
            "-q:v",
            "2",
            "-update",
            "1",
            str(POSTER),
        ]
    )
    run(
        [
            str(FFMPEG),
            "-y",
            "-hide_banner",
            "-i",
            str(MASTER),
            "-vf",
            "fps=1/6,scale=270:480,tile=4x2",
            "-frames:v",
            "1",
            "-update",
            "1",
            str(CONTACT),
        ]
    )


def write_captions() -> None:
    CAPTIONS.write_text(
        """WEBVTT

00:00:00.450 --> 00:00:06.200
Most days begin before the noise. I open ALLIM QURAN and choose one ayah.

00:00:06.200 --> 00:00:11.900
I recite slowly, word by word, and review what needs attention.

00:00:11.900 --> 00:00:22.100
Then I return to the same verse through a clear path of repetition: one hundred, then another, then one final hundred.

00:00:22.100 --> 00:00:29.700
When I need context, I can move from the Arabic text to translation and source-linked tafsir.

00:00:29.700 --> 00:00:40.600
The goal is not to rush through pages. It is to understand, remember, and carry the Qur'an into the choices I make.

00:00:40.600 --> 00:00:43.800
One ayah today. A stronger heart tomorrow.

00:00:43.800 --> 00:00:45.900
ALLIM QURAN. Learn the Book. Live by it.
""",
        encoding="utf-8",
    )


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if not VOICE.exists():
        raise RuntimeError("Approved en-GB-RyanNeural narration is missing")

    required_stock = [
        STOCK / "pexels-7401908-quran-page-turn.mp4",
        STOCK / "pexels-36072619-quran-hands.mp4",
        STOCK / "pexels-7249519-quran-touch.mp4",
    ]
    for source in required_stock:
        if not source.exists():
            raise RuntimeError(f"Missing stock footage: {source}")

    plates = {
        "today": make_ui_plate(
            "ui-today-en.png", "02-ui-today.jpg", "ALLIM QURAN · TODAY", "Choose one ayah"
        ),
        "read": make_ui_plate(
            "ui-read-en.png", "03-ui-read.jpg", "ALLIM QURAN · READ", "Recite word by word"
        ),
        "hifz": make_ui_plate(
            "ui-hifz-en.png", "05-ui-hifz.jpg", "ALLIM QURAN · HIFZ", "A clear 100 + 100 + 100 path"
        ),
        "tafsir": make_ui_plate(
            "ui-tafsir-en.png", "07-ui-tafsir.jpg", "ALLIM QURAN · TAFSIR", "Translation and traceable sources"
        ),
    }
    end_card = make_end_card()

    durations = [4.8, 4.2, 4.2, 4.8, 5.2, 5.5, 4.7, 5.0, 4.7, 7.5]
    clips = [
        build_live_scene(1, required_stock[0], 0.65, durations[0], horizontal=True),
        build_app_scene(2, plates["today"], durations[1], "left"),
        build_app_scene(3, plates["read"], durations[2], "right"),
        build_live_scene(4, required_stock[1], 0.7, durations[3], horizontal=True),
        build_app_scene(5, plates["hifz"], durations[4], "left"),
        build_live_scene(6, required_stock[2], 0.6, durations[5], horizontal=True),
        build_app_scene(7, plates["tafsir"], durations[6], "right"),
        build_live_scene(8, required_stock[0], 4.05, durations[7], horizontal=True),
        build_live_scene(9, required_stock[1], 2.85, durations[8], horizontal=True),
        build_app_scene(10, end_card, durations[9], "left"),
    ]

    intended_duration = assemble(clips, durations)
    build_review_assets()
    write_captions()

    actual_duration = media_duration(MASTER)
    voice_duration = media_duration(VOICE)
    if actual_duration >= 60:
        raise RuntimeError(f"Film exceeds one minute: {actual_duration:.2f}s")
    if actual_duration + 0.1 < voice_duration:
        raise RuntimeError("Film ends before the approved narration")

    print(MASTER)
    print(WEB)
    print(POSTER)
    print(CONTACT)
    print(CAPTIONS)
    print(f"voice_duration={voice_duration:.2f}s")
    print(f"intended_video_duration={intended_duration:.2f}s")
    print(f"video_duration={actual_duration:.2f}s")


if __name__ == "__main__":
    main()
