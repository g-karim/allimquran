from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
OUTPUT = ROOT / "output"
PROJECT = ROOT.parent.parent
PREVIOUS = ROOT.parent / "combined-en-2026"
USER_DOWNLOADS = Path("/Users/rafael/Downloads")
INTRO_PHOTO = Path("/Users/rafael/Desktop/shalat-211629366.webp")
VOICE = WORK / "narration-en-ryan-fatiha-husary-intercut.mp3"
FFMPEG = Path(
    "/Applications/Compass.app/Contents/Resources/app.asar.unpacked/"
    "node_modules/ffmpeg-static/ffmpeg"
)

WIDTH = 1080
HEIGHT = 1920
FPS = 30
FADE = 0.30

MASTER = OUTPUT / "ALLIM-Quran-Ayah-Journal-FATIHA-HUSARY-PHOTO-INTRO-EN-1080x1920.mp4"
WEB = OUTPUT / "ALLIM-Quran-Ayah-Journal-FATIHA-HUSARY-PHOTO-INTRO-EN-Web-720x1280.mp4"
POSTER = OUTPUT / "ALLIM-Quran-Ayah-Journal-FATIHA-HUSARY-PHOTO-INTRO-EN-poster.jpg"
CONTACT = OUTPUT / "ALLIM-Quran-Ayah-Journal-FATIHA-HUSARY-PHOTO-INTRO-EN-contact-sheet.jpg"
CAPTIONS = OUTPUT / "ALLIM-Quran-Ayah-Journal-FATIHA-HUSARY-PHOTO-INTRO-EN.vtt"

PAPER = (247, 244, 235)
WHITE = (255, 253, 248)
INK = (17, 49, 41)
MUTED = (101, 119, 112)
EMERALD = (27, 86, 72)
EMERALD_DARK = (3, 31, 26)
MINT = (224, 240, 233)
GOLD = (188, 145, 65)
GOLD_SOFT = (244, 234, 207)


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


def wrap_text(draw: ImageDraw.ImageDraw, text: str, selected_font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        width = draw.textbbox((0, 0), candidate, font=selected_font)[2]
        if current and width > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    selected_font: ImageFont.FreeTypeFont,
    fill: tuple[int, ...],
    max_width: int,
    spacing: int = 10,
) -> int:
    lines = wrap_text(draw, text, selected_font, max_width)
    y = xy[1]
    line_height = draw.textbbox((0, 0), "Ag", font=selected_font)[3]
    for line in lines:
        draw.text((xy[0], y), line, font=selected_font, fill=fill)
        y += line_height + spacing
    return y


def rounded_paste(base: Image.Image, source: Image.Image, box: tuple[int, int, int, int], radius: int) -> None:
    x0, y0, x1, y1 = box
    size = (x1 - x0, y1 - y0)
    rendered = source.resize(size, Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    rendered.putalpha(Image.composite(rendered.getchannel("A"), Image.new("L", size, 0), mask))
    base.alpha_composite(rendered, (x0, y0))


def canvas() -> Image.Image:
    image = Image.new("RGBA", (WIDTH, HEIGHT), EMERALD_DARK + (255,))
    draw = ImageDraw.Draw(image)
    for radius, alpha in ((320, 24), (520, 16), (760, 9)):
        draw.ellipse(
            (WIDTH // 2 - radius, 430 - radius, WIDTH // 2 + radius, 430 + radius),
            outline=GOLD + (alpha,),
            width=2,
        )
    return image


def draw_brand_header(image: Image.Image, eyebrow: str) -> ImageDraw.ImageDraw:
    icon = Image.open(PROJECT / "homepage" / "allim-brand-icon.png").convert("RGBA")
    icon = icon.resize((74, 74), Image.Resampling.LANCZOS)
    image.alpha_composite(icon, (82, 72))
    draw = ImageDraw.Draw(image)
    draw.text((178, 80), "ALLIM QURAN", font=font(27, bold=True), fill=INK + (255,))
    draw.text((178, 116), eyebrow.upper(), font=font(17, bold=True), fill=EMERALD + (255,))
    return draw


def make_journal_screen() -> Path:
    image = canvas()
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((44, 38, 1036, 1878), radius=50, fill=WHITE + (255,))
    draw = draw_brand_header(image, "Ayah of the Day · Private Journal")

    draw.text((82, 202), "One ayah. One honest reflection.", font=font(54, serif=True), fill=INK + (255,))
    draw_wrapped(
        draw,
        (82, 280),
        "Pause long enough for meaning to become personal.",
        font(26),
        MUTED + (255,),
        860,
        8,
    )

    draw.rounded_rectangle((82, 382, 998, 635), radius=30, fill=EMERALD + (255,))
    draw.text((118, 420), "TODAY'S AYAH", font=font(18, bold=True), fill=GOLD_SOFT + (255,))
    draw.text((118, 470), "Al-Fatihah · 1:7", font=font(47, serif=True), fill=WHITE + (255,))
    draw_wrapped(
        draw,
        (118, 540),
        "Read · Recite · Understand · Return",
        font(22, bold=True),
        (221, 238, 231, 255),
        820,
        8,
    )

    draw.text((82, 700), "REFLECTION PROMPT", font=font(18, bold=True), fill=EMERALD + (255,))
    draw_wrapped(
        draw,
        (82, 745),
        "What does this ayah change in the way I act today?",
        font(42, serif=True),
        INK + (255,),
        860,
        10,
    )

    draw.rounded_rectangle((82, 930, 998, 1265), radius=28, fill=PAPER + (255,), outline=(220, 222, 214, 255), width=2)
    draw.text((116, 966), "MY PRIVATE NOTE", font=font(17, bold=True), fill=MUTED + (255,))
    draw_wrapped(
        draw,
        (116, 1024),
        "Before one important decision today, I will pause and return to what is right.",
        font(32, serif=True),
        INK + (255,),
        820,
        12,
    )
    draw.rounded_rectangle((116, 1185, 385, 1231), radius=14, fill=MINT + (255,))
    draw.text((142, 1195), "Private by design", font=font(16, bold=True), fill=EMERALD + (255,))

    draw.rounded_rectangle((82, 1335, 998, 1485), radius=26, fill=GOLD_SOFT + (255,))
    draw.text((118, 1372), "ONE ACTION TODAY", font=font(17, bold=True), fill=(126, 94, 35, 255))
    draw.text((118, 1412), "Carry one insight into one real choice.", font=font(28, bold=True), fill=INK + (255,))

    draw.rounded_rectangle((82, 1545, 998, 1668), radius=24, fill=EMERALD + (255,))
    draw.text((270, 1582), "Save reflection and choose action", font=font(25, bold=True), fill=WHITE + (255,))
    draw.text((82, 1750), "Reflection stays personal. Return to it this evening.", font=font(20), fill=MUTED + (255,))

    target = WORK / "08-journal-screen.jpg"
    image.convert("RGB").save(target, quality=96, subsampling=0)
    return target


def make_ai_screen() -> Path:
    image = canvas()
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((44, 38, 1036, 1878), radius=50, fill=WHITE + (255,))
    draw = draw_brand_header(image, "AI Companion · Reflection Support")

    draw.text((82, 212), "From reflection to a clear next step.", font=font(50, serif=True), fill=INK + (255,))
    draw_wrapped(
        draw,
        (82, 286),
        "A calm thinking aid that helps you organise what you understood.",
        font(25),
        MUTED + (255,),
        860,
        8,
    )

    draw.rounded_rectangle((82, 405, 998, 535), radius=24, fill=MINT + (255,))
    draw.text((118, 438), "IMPORTANT BOUNDARY", font=font(17, bold=True), fill=EMERALD + (255,))
    draw.text((118, 477), "A thinking aid — not tafsir and not a teacher.", font=font(25, bold=True), fill=INK + (255,))

    cards = [
        ("YOUR TAKEAWAY", "Guidance becomes clearer when I return to it before I choose."),
        ("ONE ACTION TODAY", "Pause before one important decision and choose the better path."),
        ("A CAREFUL QUESTION", "Where might this ayah challenge my usual response?"),
    ]
    y = 600
    for number, (label, body) in enumerate(cards, start=1):
        draw.rounded_rectangle((82, y, 998, y + 255), radius=28, fill=PAPER + (255,), outline=(221, 224, 216, 255), width=2)
        draw.rounded_rectangle((112, y + 35, 166, y + 89), radius=15, fill=EMERALD + (255,))
        draw.text((130, y + 47), str(number), font=font(18, bold=True), fill=WHITE + (255,))
        draw.text((192, y + 42), label, font=font(17, bold=True), fill=EMERALD + (255,))
        draw_wrapped(draw, (112, y + 115), body, font(29, serif=True), INK + (255,), 820, 10)
        y += 285

    draw.rounded_rectangle((82, 1500, 998, 1624), radius=24, fill=EMERALD + (255,))
    draw.text((331, 1538), "Add to today's journal", font=font(25, bold=True), fill=WHITE + (255,))
    draw.text((82, 1710), "You decide what to keep, edit or discard.", font=font(20), fill=MUTED + (255,))

    target = WORK / "09-ai-screen.jpg"
    image.convert("RGB").save(target, quality=96, subsampling=0)
    return target


def make_habit_screen() -> Path:
    image = canvas()
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((44, 38, 1036, 1878), radius=50, fill=WHITE + (255,))
    draw = draw_brand_header(image, "Build the habit · Return each day")

    draw.text((82, 212), "A small daily rhythm that can last.", font=font(53, serif=True), fill=INK + (255,))
    draw_wrapped(
        draw,
        (82, 290),
        "The journal reconnects understanding, action and review.",
        font(25),
        MUTED + (255,),
        860,
        8,
    )

    days = ["M", "T", "W", "T", "F", "S", "S"]
    for index, day in enumerate(days):
        x = 86 + index * 128
        active = index < 5
        fill = EMERALD + (255,) if active else PAPER + (255,)
        outline = EMERALD + (255,) if active else (212, 218, 211, 255)
        draw.ellipse((x, 430, x + 84, 514), fill=fill, outline=outline, width=2)
        draw.text((x + 29, 452), day, font=font(20, bold=True), fill=(WHITE if active else MUTED) + (255,))

    steps = [
        ("MORNING", "Meet one ayah", "Read, recite and understand."),
        ("DAY", "Choose one action", "Carry the meaning into a real choice."),
        ("EVENING", "Return and reflect", "Notice what changed and what needs another day."),
    ]
    y = 600
    for number, (label, title, body) in enumerate(steps, start=1):
        draw.rounded_rectangle((82, y, 998, y + 285), radius=30, fill=PAPER + (255,), outline=(221, 224, 216, 255), width=2)
        draw.rounded_rectangle((112, y + 38, 184, y + 110), radius=20, fill=GOLD_SOFT + (255,))
        draw.text((137, y + 57), str(number), font=font(25, bold=True), fill=(126, 94, 35, 255))
        draw.text((215, y + 41), label, font=font(17, bold=True), fill=EMERALD + (255,))
        draw.text((215, y + 80), title, font=font(32, serif=True), fill=INK + (255,))
        draw_wrapped(draw, (112, y + 155), body, font(23), MUTED + (255,), 820, 8)
        y += 320

    draw.rounded_rectangle((82, 1590, 998, 1715), radius=24, fill=EMERALD + (255,))
    draw.text((331, 1628), "Return this evening", font=font(26, bold=True), fill=WHITE + (255,))
    draw.text((82, 1778), "One ayah · One reflection · One action", font=font(21, bold=True), fill=EMERALD + (255,))

    target = WORK / "11-habit-screen.jpg"
    image.convert("RGB").save(target, quality=96, subsampling=0)
    return target


def make_end_card() -> Path:
    image = canvas()
    draw = ImageDraw.Draw(image)
    logo = Image.open(PROJECT / "homepage" / "allim-header-logo.png").convert("RGBA")
    logo_w = 760
    logo_h = round(logo.height * logo_w / logo.width)
    logo = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
    image.alpha_composite(logo, ((WIDTH - logo_w) // 2, 230))

    draw.text((173, 710), "One ayah.", font=font(78, serif=True), fill=PAPER + (255,))
    draw.text((173, 825), "One honest reflection.", font=font(58, serif=True), fill=PAPER + (255,))
    draw.text((173, 925), "One small action.", font=font(58, serif=True), fill=PAPER + (255,))
    draw.text((173, 1075), "REPEATED UNTIL IT BECOMES A HABIT", font=font(20, bold=True), fill=GOLD + (255,))
    draw.rounded_rectangle((174, 1225, 906, 1348), radius=26, fill=PAPER + (255,))
    draw.text((330, 1262), "Begin at allimquran.com", font=font(32, bold=True), fill=EMERALD_DARK + (255,))
    draw.text((292, 1545), "Learn the Book. Live by it.", font=font(38, serif=True), fill=PAPER + (240,))

    target = WORK / "13-end-card.jpg"
    image.convert("RGB").save(target, quality=96, subsampling=0)
    return target


def build_user_scene(
    index: int,
    source: Path,
    start: float,
    duration: float,
    exposure: float,
    *,
    crop_top: int = 0,
    stabilization: int = 16,
) -> Path:
    target = WORK / f"scene-{index:02d}.mp4"
    crop_height = HEIGHT - crop_top
    crop_width = int(crop_height * WIDTH / HEIGHT) // 2 * 2
    crop_x = ((WIDTH - crop_width) // 2) // 2 * 2
    video_filter = (
        "zscale=t=linear:npl=100,format=gbrpf32le,"
        "tonemap=mobius:param=0.22,"
        "zscale=p=bt709:t=bt709:m=bt709:r=tv,format=yuv420p,"
        f"deshake=rx={stabilization}:ry={stabilization}:blocksize=8:contrast=125:search=exhaustive:edge=mirror,"
        "hqdn3d=1.1:0.9:3.4:2.7,"
        f"eq=brightness={exposure:.3f}:contrast=1.09:gamma=0.93:saturation=0.90,"
        f"crop={crop_width}:{crop_height}:{crop_x}:{crop_top},"
        "scale=1080:1920:flags=lanczos,"
        "unsharp=5:5:0.38:5:5:0,vignette=PI/13,format=yuv420p"
    )
    run(
        [
            str(FFMPEG), "-y", "-hide_banner", "-ss", f"{start:.2f}", "-i", str(source),
            "-map", "0:v:0", "-t", f"{duration:.2f}", "-vf", video_filter,
            "-an", "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "17",
            "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709",
            "-colorspace", "bt709", str(target),
        ]
    )
    return target


def build_photo_intro(index: int, source: Path, duration: float) -> Path:
    target = WORK / f"scene-{index:02d}.mp4"
    video_filter = (
        "[0:v]split=2[bgsrc][fgsrc];"
        "[bgsrc]scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,"
        "crop=1080:1920,gblur=sigma=38,eq=brightness=-0.12:saturation=0.72[bg];"
        "[fgsrc]scale=1080:-2:flags=lanczos,eq=contrast=1.025:saturation=0.94,"
        "unsharp=5:5:0.30:5:5:0[fg];"
        "[bg][fg]overlay=(W-w)/2:(H-h)/2:format=auto,format=yuv420p[out]"
    )
    run(
        [
            str(FFMPEG), "-y", "-hide_banner", "-loop", "1", "-framerate", str(FPS),
            "-i", str(source), "-filter_complex", video_filter, "-map", "[out]",
            "-t", f"{duration:.2f}", "-an", "-r", str(FPS), "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", str(target),
        ]
    )
    return target


def build_sdr_scene(index: int, source: Path, start: float, duration: float) -> Path:
    target = WORK / f"scene-{index:02d}.mp4"
    video_filter = (
        "scale=-2:1920:flags=lanczos,crop=1080:1920,"
        "hqdn3d=0.8:0.6:2.4:1.8,eq=contrast=1.025:saturation=0.90,"
        "unsharp=5:5:0.25:5:5:0,vignette=PI/12,format=yuv420p"
    )
    run(
        [
            str(FFMPEG), "-y", "-hide_banner", "-ss", f"{start:.2f}", "-i", str(source),
            "-t", f"{duration:.2f}", "-vf", video_filter, "-an", "-r", str(FPS),
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(target),
        ]
    )
    return target


def build_app_scene(index: int, source: Path, duration: float, direction: int) -> Path:
    target = WORK / f"scene-{index:02d}.mp4"
    frames = round(duration * FPS)
    video_filter = (
        "scale=1166:2074:force_original_aspect_ratio=increase:flags=lanczos,crop=1166:2074,"
        f"zoompan=z='min(zoom+0.00015,1.021)':x='iw/2-(iw/zoom/2)+({direction})*on/{frames}':"
        "y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,format=yuv420p"
    )
    run(
        [
            str(FFMPEG), "-y", "-hide_banner", "-loop", "1", "-framerate", str(FPS), "-i", str(source),
            "-vf", video_filter, "-t", f"{duration:.2f}", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(target),
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
            f"[{label}][{index}:v]xfade=transition=fade:duration={FADE:.2f}:offset={offset:.2f}[{next_label}]"
        )
        label = next_label
        elapsed += durations[index] - FADE

    final_duration = elapsed
    filters.append(
        f"[{audio_index}:a]aresample=48000,adelay=420:all=1,highpass=f=72,lowpass=f=12500,"
        "acompressor=threshold=-19dB:ratio=2.2:attack=14:release=180:makeup=1.8dB,"
        f"apad=pad_dur=2,atrim=duration={final_duration:.2f},"
        f"afade=t=out:st={max(0, final_duration - 0.9):.2f}:d=0.8[voice];"
        f"anoisesrc=color=pink:amplitude=0.0014:r=48000:d={final_duration:.2f},"
        "highpass=f=105,lowpass=f=3000[room];"
        "[voice][room]amix=inputs=2:duration=longest:weights='1 0.30':normalize=0[a]"
    )
    command += [
        "-filter_complex", ";".join(filters), "-map", f"[{label}]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", f"{final_duration:.2f}", str(MASTER),
    ]
    run(command)
    return final_duration


def build_review_assets() -> None:
    run(
        [
            str(FFMPEG), "-y", "-hide_banner", "-i", str(MASTER), "-vf", "scale=720:1280:flags=lanczos",
            "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-maxrate", "1800k", "-bufsize", "3600k",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(WEB),
        ]
    )
    run(
        [str(FFMPEG), "-y", "-hide_banner", "-ss", "1.5", "-i", str(MASTER), "-frames:v", "1", "-q:v", "2", "-update", "1", str(POSTER)]
    )
    run(
        [
            str(FFMPEG), "-y", "-hide_banner", "-i", str(MASTER),
            "-vf", "fps=1/7,scale=270:480,tile=4x2", "-frames:v", "1", "-update", "1", str(CONTACT),
        ]
    )


def write_captions() -> None:
    CAPTIONS.write_text(
        """WEBVTT

00:00:00.420 --> 00:00:08.170
Each day, I begin with one ayah in ALLIM QURAN. I read, listen, and return.

00:00:08.350 --> 00:00:14.630
[Qur'an recitation · Al-Fatihah 1:2]

00:00:14.810 --> 00:00:21.360
The Ayah of the Day Journal turns reflection into one clear takeaway and one action for today.

00:00:21.540 --> 00:00:26.040
[Qur'an recitation · Al-Fatihah 1:3]

00:00:26.220 --> 00:00:32.890
The AI companion supports reflection. It never replaces tafsir or a teacher.

00:00:33.070 --> 00:00:37.700
[Qur'an recitation · Al-Fatihah 1:4]

00:00:37.880 --> 00:00:48.300
Each evening, I review. One ayah. One reflection. One action. A daily habit.

00:00:48.480 --> 00:00:55.330
[Qur'an recitation · Al-Fatihah 1:5]

00:00:55.510 --> 00:00:57.570
ALLIM QURAN.
""",
        encoding="utf-8",
    )


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)

    user_sources = [USER_DOWNLOADS / f"IMG_{number}.MOV" for number in (7464, 7465, 7466, 7467)]
    for source in user_sources:
        if not source.exists():
            raise RuntimeError(f"Missing user footage: {source}")
    if not INTRO_PHOTO.exists():
        raise RuntimeError(f"Missing approved opening photo: {INTRO_PHOTO}")

    old_work = PREVIOUS / "work"
    today = old_work / "02-ui-today.jpg"
    quran_clip = PREVIOUS / "assets" / "stock" / "pexels-36072619-quran-hands.mp4"
    fatiha_screens = [WORK / f"fatiha-{ayah}-live.png" for ayah in range(2, 6)]
    for source in (today, quran_clip, *fatiha_screens):
        if not source.exists():
            raise RuntimeError(f"Missing existing project asset: {source}")

    journal = make_journal_screen()
    ai_screen = make_ai_screen()
    habit = make_habit_screen()
    end_card = make_end_card()

    durations = [4.3, 4.3, 6.7, 2.8, 4.5, 5.1, 2.8, 4.5, 5.1, 3.5, 4.4, 3.3, 7.2, 2.5, 2.0]
    clips = [
        build_photo_intro(1, INTRO_PHOTO, durations[0]),
        build_app_scene(2, today, durations[1], -10),
        build_app_scene(3, fatiha_screens[0], durations[2], -10),
        build_user_scene(4, user_sources[1], 0.25, durations[3], -0.095, crop_top=580, stabilization=32),
        build_app_scene(5, journal, durations[4], 10),
        build_app_scene(6, fatiha_screens[1], durations[5], 10),
        build_user_scene(7, user_sources[2], 30.0, durations[6], -0.080, crop_top=260, stabilization=32),
        build_app_scene(8, ai_screen, durations[7], -10),
        build_app_scene(9, fatiha_screens[2], durations[8], -10),
        build_user_scene(10, user_sources[3], 0.8, durations[9], -0.085, crop_top=260, stabilization=32),
        build_app_scene(11, habit, durations[10], 10),
        build_user_scene(12, user_sources[0], 10.2, durations[11], -0.075, stabilization=16),
        build_app_scene(13, fatiha_screens[3], durations[12], 10),
        build_sdr_scene(14, quran_clip, 1.0, durations[13]),
        build_app_scene(15, end_card, durations[14], -10),
    ]

    if "--visuals-only" in sys.argv:
        print("visuals_ready")
        return
    if not VOICE.exists():
        raise RuntimeError("Approved Ryan narration with separate Qur'an recitation is missing; run generate_voice.py")

    voice_duration = media_duration(VOICE)
    final_duration = sum(durations) - FADE * (len(durations) - 1)
    if voice_duration + 0.8 > final_duration:
        durations[-1] += voice_duration + 0.8 - final_duration
        clips[-1] = build_app_scene(15, end_card, durations[-1], -10)

    intended = assemble(clips, durations)
    build_review_assets()
    write_captions()
    actual = media_duration(MASTER)
    if actual >= 60:
        raise RuntimeError(f"Film exceeds one minute: {actual:.2f}s")

    print(MASTER)
    print(WEB)
    print(POSTER)
    print(CONTACT)
    print(CAPTIONS)
    print(f"voice_duration={voice_duration:.2f}s")
    print(f"video_duration={actual:.2f}s")
    print(f"intended_video_duration={intended:.2f}s")


if __name__ == "__main__":
    main()
