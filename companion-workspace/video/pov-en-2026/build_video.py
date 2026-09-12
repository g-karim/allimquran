from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
WORK = ROOT / "work"
OUTPUT = ROOT / "output"
FFMPEG = Path(
    "/Applications/Compass.app/Contents/Resources/app.asar.unpacked/"
    "node_modules/ffmpeg-static/ffmpeg"
)

WIDTH = 1080
HEIGHT = 1920
FPS = 30
FADE = 0.55
MASTER = OUTPUT / "ALLIM-Quran-POV-EN-1080x1920.mp4"
WEB = OUTPUT / "ALLIM-Quran-POV-EN-Web-720x1280.mp4"
POSTER = OUTPUT / "ALLIM-Quran-POV-EN-poster.jpg"
CONTACT = OUTPUT / "ALLIM-Quran-POV-EN-contact-sheet.jpg"
VOICE = WORK / "narration-en-approved.mp3"

IVORY = (247, 244, 235)
EMERALD = (8, 58, 48)
EMERALD_DARK = (4, 35, 30)
GOLD = (195, 153, 78)

PHONE_BOUNDS = {
    "pov-01-dawn.png": (335, 594, 575, 1107),
    "pov-02-study.png": (335, 498, 596, 1073),
    "pov-03-courtyard.png": (358, 555, 587, 1064),
    "pov-04-evening.png": (363, 570, 583, 1070),
}


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
        path = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Georgia.ttf"
    else:
        path = "/System/Library/Fonts/Avenir Next.ttc"
    return ImageFont.truetype(path, size=size)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def rounded_image(image: Image.Image, size: tuple[int, int], radius: int) -> Image.Image:
    image = image.resize(size, Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    image.putalpha(mask)
    return image


def multiline_center(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, *, selected_font: ImageFont.FreeTypeFont, fill: tuple[int, ...], spacing: int = 10) -> None:
    box = draw.multiline_textbbox((0, 0), text, font=selected_font, spacing=spacing, align="center")
    draw.multiline_text((xy[0] - (box[2] - box[0]) / 2, xy[1]), text, font=selected_font, fill=fill, spacing=spacing, align="center")


def add_pov_caption(image: Image.Image, number: str, title: str) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    box = (58, 105, 760, 282)
    draw.rounded_rectangle(box, radius=28, fill=(248, 245, 237, 235), outline=(255, 255, 255, 95), width=2)
    draw.text((94, 137), number, font=font(26, bold=True), fill=GOLD + (255,))
    draw.text((94, 184), title, font=font(45, serif=True), fill=EMERALD_DARK + (255,))
    image.alpha_composite(layer)


def make_phone_plate(plate_name: str, ui_name: str, output_name: str, number: str, title: str) -> Path:
    plate_source = Image.open(ASSETS / plate_name).convert("RGBA")
    source_w, source_h = plate_source.size
    plate = cover(plate_source, (WIDTH, HEIGHT)).convert("RGBA")

    left, top, right, bottom = PHONE_BOUNDS[plate_name]
    sx = WIDTH / source_w
    sy = HEIGHT / source_h
    left = round(left * sx)
    right = round(right * sx)
    top = round(top * sy)
    bottom = round(bottom * sy)
    screen_w = right - left + 1
    screen_h = bottom - top + 1

    ui_source = Image.open(ASSETS / ui_name).convert("RGBA")
    ui = rounded_image(ui_source, (screen_w, screen_h), radius=max(16, round(screen_w * 0.075)))
    plate.alpha_composite(ui, (left, top))

    # Preserve the familiar phone notch and a restrained glass reflection.
    draw = ImageDraw.Draw(plate)
    notch_w = round(screen_w * 0.36)
    notch_h = max(18, round(screen_h * 0.038))
    notch_x = left + (screen_w - notch_w) // 2
    draw.rounded_rectangle(
        (notch_x, top - 2, notch_x + notch_w, top + notch_h),
        radius=notch_h // 2,
        fill=(5, 8, 8, 255),
    )
    reflection = Image.new("RGBA", (screen_w, screen_h), (255, 255, 255, 0))
    reflection_draw = ImageDraw.Draw(reflection)
    reflection_draw.polygon(
        [(0, 0), (round(screen_w * 0.38), 0), (screen_w, screen_h), (round(screen_w * 0.76), screen_h)],
        fill=(255, 255, 255, 13),
    )
    plate.alpha_composite(reflection, (left, top))
    add_pov_caption(plate, number, title)

    target = WORK / output_name
    plate.convert("RGB").save(target, quality=96, subsampling=0)
    return target


def make_ui_stage(ui_name: str, output_name: str, number: str, label: str, title: str) -> Path:
    ui_source = Image.open(ASSETS / ui_name).convert("RGB")
    background = cover(ui_source, (WIDTH, HEIGHT)).filter(ImageFilter.GaussianBlur(44)).convert("RGBA")
    wash = Image.new("RGBA", (WIDTH, HEIGHT), EMERALD_DARK + (218,))
    background = Image.alpha_composite(background, wash)

    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.text((72, 82), f"{number}  /  {label.upper()}", font=font(24, bold=True), fill=GOLD + (255,))
    draw.text((72, 126), title, font=font(42, serif=True), fill=IVORY + (255,))

    stage_h = 1500
    stage_w = round(stage_h * ui_source.width / ui_source.height)
    stage_x = (WIDTH - stage_w) // 2
    stage_y = 245
    shadow = Image.new("RGBA", (stage_w + 72, stage_h + 72), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((36, 36, stage_w + 35, stage_h + 35), radius=42, fill=(0, 0, 0, 145))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    layer.alpha_composite(shadow, (stage_x - 36, stage_y - 22))
    layer.alpha_composite(rounded_image(ui_source, (stage_w, stage_h), 32), (stage_x, stage_y))
    draw.rounded_rectangle((stage_x - 2, stage_y - 2, stage_x + stage_w + 1, stage_y + stage_h + 1), radius=34, outline=(255, 255, 255, 72), width=2)

    background.alpha_composite(layer)
    target = WORK / output_name
    background.convert("RGB").save(target, quality=96, subsampling=0)
    return target


def make_end_card() -> Path:
    image = Image.new("RGBA", (WIDTH, HEIGHT), EMERALD_DARK + (255,))
    pixels = image.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            vertical = y / HEIGHT
            glow = max(0.0, 1.0 - (((x - WIDTH * 0.54) / 780) ** 2 + ((y - HEIGHT * 0.42) / 980) ** 2))
            pixels[x, y] = (
                round(4 + glow * 8),
                round(32 + glow * 34 - vertical * 5),
                round(28 + glow * 25 - vertical * 4),
                255,
            )
    draw = ImageDraw.Draw(image)
    for radius, alpha in ((360, 24), (520, 17), (700, 10)):
        draw.ellipse((WIDTH // 2 - radius, 520 - radius, WIDTH // 2 + radius, 520 + radius), outline=GOLD + (alpha,), width=2)

    logo_path = ROOT.parent.parent / "assets" / "branding" / "allim-logo-english-v4.png"
    logo_source = Image.open(logo_path).convert("RGBA")
    logo_w = 430
    logo_h = round(logo_source.height * logo_w / logo_source.width)
    logo_source = logo_source.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
    logo = Image.new("RGBA", logo_source.size, IVORY + (0,))
    logo.putalpha(logo_source.getchannel("A"))
    image.alpha_composite(logo, ((WIDTH - logo_w) // 2, 185))

    multiline_center(draw, (WIDTH // 2, 610), "One ayah today.\nA stronger heart tomorrow.", selected_font=font(76, serif=True), fill=IVORY + (255,), spacing=18)
    multiline_center(draw, (WIDTH // 2, 940), "READ  ·  UNDERSTAND  ·  REMEMBER  ·  LIVE IT", selected_font=font(23, bold=True), fill=GOLD + (255,), spacing=8)
    draw.rounded_rectangle((172, 1130, WIDTH - 172, 1248), radius=24, fill=IVORY + (255,))
    multiline_center(draw, (WIDTH // 2, 1166), "Begin at allimquran.com", selected_font=font(34, bold=True), fill=EMERALD_DARK + (255,))
    multiline_center(draw, (WIDTH // 2, 1435), "Learn the Book.\nLive by it.", selected_font=font(52, serif=True), fill=IVORY + (238,), spacing=10)
    target = WORK / "08-end-card.jpg"
    image.convert("RGB").save(target, quality=96, subsampling=0)
    return target


def build_voice() -> None:
    if not VOICE.exists():
        raise RuntimeError(
            "Approved narration is missing. Run generate_voice.py with "
            "en-GB-RyanNeural; never fall back to a local system voice."
        )


def build_scene(index: int, source: Path, duration: float, motion: str) -> Path:
    target = WORK / f"scene-{index:02d}.mp4"
    frames = round(duration * FPS)
    if motion == "push":
        zoom = "min(zoom+0.00032,1.045)"
        x = "iw/2-(iw/zoom/2)"
        y = "ih/2-(ih/zoom/2)"
    elif motion == "drift-left":
        zoom = "min(zoom+0.00020,1.030)"
        x = f"iw/2-(iw/zoom/2)-18*on/{frames}"
        y = "ih/2-(ih/zoom/2)"
    else:
        zoom = "min(zoom+0.00018,1.028)"
        x = f"iw/2-(iw/zoom/2)+14*on/{frames}"
        y = "ih/2-(ih/zoom/2)"
    video_filter = (
        "scale=1188:2112:force_original_aspect_ratio=increase:flags=lanczos,"
        "crop=1188:2112,"
        f"zoompan=z='{zoom}':x='{x}':y='{y}':d=1:s={WIDTH}x{HEIGHT}:fps={FPS},"
        "eq=contrast=1.02:saturation=0.96,format=yuv420p"
    )
    run([
        str(FFMPEG), "-y", "-hide_banner",
        "-loop", "1", "-framerate", str(FPS), "-i", str(source),
        "-vf", video_filter,
        "-t", f"{duration:.2f}",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", str(target),
    ])
    return target


def assemble(clips: list[Path], durations: list[float]) -> None:
    command = [str(FFMPEG), "-y", "-hide_banner"]
    for clip in clips:
        command += ["-i", str(clip)]
    audio_index = len(clips)
    command += ["-i", str(VOICE)]

    transitions = ["fade", "smoothleft", "fade", "smoothright", "fade", "smoothleft", "fadeblack"]
    filters: list[str] = []
    label = "0:v"
    elapsed = durations[0]
    for index in range(1, len(clips)):
        next_label = f"v{index}"
        offset = elapsed - FADE
        filters.append(
            f"[{label}][{index}:v]xfade=transition={transitions[index - 1]}:"
            f"duration={FADE:.2f}:offset={offset:.2f}[{next_label}]"
        )
        label = next_label
        elapsed += durations[index] - FADE

    final_duration = elapsed
    filters.append(
        f"[{audio_index}:a]aresample=48000,adelay=450:all=1,highpass=f=72,lowpass=f=12500,"
        "acompressor=threshold=-19dB:ratio=2.2:attack=14:release=180:makeup=1.8dB,"
        f"apad=pad_dur=2,atrim=duration={final_duration:.2f},"
        f"afade=t=out:st={max(0, final_duration - 1.1):.2f}:d=1.0[voice];"
        f"anoisesrc=color=pink:amplitude=0.0022:r=48000:d={final_duration:.2f},"
        "highpass=f=90,lowpass=f=3400[room];"
        "[voice][room]amix=inputs=2:duration=longest:weights='1 0.42':normalize=0[a]"
    )

    command += [
        "-filter_complex", ";".join(filters),
        "-map", f"[{label}]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", "-t", f"{final_duration:.2f}", str(MASTER),
    ]
    run(command)


def build_review_assets() -> None:
    run([
        str(FFMPEG), "-y", "-hide_banner", "-i", str(MASTER),
        "-vf", "scale=720:1280:flags=lanczos",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22",
        "-maxrate", "1800k", "-bufsize", "3600k", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(WEB),
    ])
    Image.open(WORK / "01-dawn-today.jpg").convert("RGB").save(POSTER, quality=94, subsampling=0)
    review_sources = [
        WORK / "01-dawn-today.jpg",
        WORK / "02-stage-read.jpg",
        WORK / "03-study-read.jpg",
        WORK / "04-stage-hifz.jpg",
        WORK / "05-courtyard-hifz.jpg",
        WORK / "06-stage-tafsir.jpg",
        WORK / "07-evening-tafsir.jpg",
        WORK / "08-end-card.jpg",
    ]
    contact = Image.new("RGB", (1080, 960), EMERALD_DARK)
    for index, source in enumerate(review_sources):
        thumb = Image.open(source).convert("RGB").resize((270, 480), Image.Resampling.LANCZOS)
        contact.paste(thumb, ((index % 4) * 270, (index // 4) * 480))
    contact.save(CONTACT, quality=94, subsampling=0)


def write_captions() -> None:
    (OUTPUT / "ALLIM-Quran-POV-EN.vtt").write_text(
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
    build_voice()
    voice_duration = media_duration(VOICE)

    sources = [
        make_phone_plate("pov-01-dawn.png", "ui-today-en.png", "01-dawn-today.jpg", "01", "Begin with one ayah"),
        make_ui_stage("ui-read-en.png", "02-stage-read.jpg", "02", "Recite", "Review the ayah, word by word."),
        make_phone_plate("pov-02-study.png", "ui-read-en.png", "03-study-read.jpg", "03", "Recite at your own pace"),
        make_ui_stage("ui-hifz-en.png", "04-stage-hifz.jpg", "04", "Remember", "Build a clear 100 + 100 + 100 path."),
        make_phone_plate("pov-03-courtyard.png", "ui-hifz-en.png", "05-courtyard-hifz.jpg", "05", "Return throughout the day"),
        make_ui_stage("ui-tafsir-en.png", "06-stage-tafsir.jpg", "06", "Understand", "Follow translation and traceable sources."),
        make_phone_plate("pov-04-evening.png", "ui-tafsir-en.png", "07-evening-tafsir.jpg", "07", "Carry it into your life"),
        make_end_card(),
    ]
    durations = [7.2, 5.2, 6.5, 5.2, 6.5, 5.2, 6.5, 7.8]
    total = sum(durations) - FADE * (len(durations) - 1)
    if voice_duration + 1.1 > total:
        durations[-1] += voice_duration + 1.1 - total
        total = sum(durations) - FADE * (len(durations) - 1)
    if total >= 60:
        raise RuntimeError(f"Film would exceed one minute: {total:.2f}s")

    clips = [
        build_scene(index, source, duration, motion)
        for index, (source, duration, motion) in enumerate(
            zip(sources, durations, ["push", "drift-left", "push", "drift-right", "push", "drift-left", "push", "push"]),
            start=1,
        )
    ]
    assemble(clips, durations)
    build_review_assets()
    write_captions()
    duration = media_duration(MASTER)
    if duration >= 60:
        raise RuntimeError(f"Unexpected duration: {duration:.2f}s")
    print(MASTER)
    print(WEB)
    print(POSTER)
    print(CONTACT)
    print(f"voice_duration={voice_duration:.2f}s")
    print(f"video_duration={duration:.2f}s")


if __name__ == "__main__":
    main()
