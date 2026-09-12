from __future__ import annotations

import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
WORK = ROOT / "work"
OUTPUT = ROOT / "output"
FFMPEG = Path(
    "/Applications/Compass.app/Contents/Resources/app.asar.unpacked/"
    "node_modules/ffmpeg-static/ffmpeg"
)

FPS = 25
SCENE_DURATION = 4.7
FADE_DURATION = 0.8
MASTER = OUTPUT / "ALLIM-Quran-Hero-Film-Universal-1080p.mp4"
WEB = OUTPUT / "ALLIM-Quran-Hero-Film-Universal-Web-720p.mp4"
POSTER = OUTPUT / "ALLIM-Quran-Hero-Film-Universal-poster.jpg"
CONTACT = OUTPUT / "ALLIM-Quran-Hero-Film-Universal-contact-sheet.jpg"
AUDIO = ASSETS / "audio" / "maher-al-muaiqly-112.mp3"
PHONE_SCREEN = ASSETS / "phone-reading-verified-ar.png"


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def media_duration(path: Path) -> float:
    result = subprocess.run(
        [str(FFMPEG), "-hide_banner", "-i", str(path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    match = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", result.stderr)
    if not match:
        raise RuntimeError(f"Unable to read duration: {path}")
    hours, minutes, seconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def require_inputs() -> None:
    required = [
        ASSETS / "01-dawn-reader.png",
        ASSETS / "02-phone-blank.png",
        PHONE_SCREEN,
        ASSETS / "03-ui-reading-stage.png",
        ASSETS / "04-evening-learner-v2.png",
        ASSETS / "05-ui-memory-stage.png",
        ASSETS / "06-learning-together.png",
        ASSETS / "07-ui-home-stage.png",
        ASSETS / "08-final-card.png",
        AUDIO,
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing rendered assets:\n" + "\n".join(missing))


def build_phone_composite() -> Path:
    mask = WORK / "phone-screen-mask.png"
    composite = WORK / "02-phone-allim.png"
    mask_filter = (
        "format=gray,geq=lum='if("
        "gte(435*(Y-60)-45*(X-180),0)*"
        "gte(-205*(Y-105)-745*(X-615),0)*"
        "gte(-392*(Y-850)+60*(X-410),0)*"
        "gte(162*(Y-790)+730*(X-18),0),255,0)'"
    )
    run([
        str(FFMPEG), "-y", "-hide_banner",
        "-f", "lavfi", "-i", "color=black:s=640x900:r=25",
        "-vf", mask_filter,
        "-frames:v", "1", "-update", "1", str(mask),
    ])
    composite_filter = (
        "[1:v]scale=640:900:flags=lanczos,format=rgba,"
        "perspective=x0=180:y0=60:x1=615:y1=105:"
        "x2=18:y2=790:x3=410:y3=850:sense=destination[warped];"
        "[2:v]format=gray[mask];"
        "[warped][mask]alphamerge[ui];"
        "[0:v][ui]overlay=560:0:format=auto,format=rgb24"
    )
    run([
        str(FFMPEG), "-y", "-hide_banner",
        "-i", str(ASSETS / "02-phone-blank.png"),
        "-i", str(PHONE_SCREEN),
        "-i", str(mask),
        "-filter_complex", composite_filter,
        "-frames:v", "1", "-update", "1", str(composite),
    ])
    return composite


def build_scene(index: int, source: Path, *, motion: str) -> Path:
    target = WORK / f"scene-{index:02d}.mp4"
    frames = int(round(SCENE_DURATION * FPS))
    if motion == "push":
        zoom = "min(zoom+0.00025,1.034)"
        x = "iw/2-(iw/zoom/2)"
        y = "ih/2-(ih/zoom/2)"
    elif motion == "drift-left":
        zoom = "min(zoom+0.00018,1.026)"
        x = "iw/2-(iw/zoom/2)-18*on/%d" % frames
        y = "ih/2-(ih/zoom/2)"
    else:
        zoom = "min(zoom+0.00012,1.018)"
        x = "iw/2-(iw/zoom/2)"
        y = "ih/2-(ih/zoom/2)+9*on/%d" % frames

    video_filter = (
        "scale=2112:1188:force_original_aspect_ratio=increase:flags=lanczos,"
        "crop=2112:1188,"
        f"zoompan=z='{zoom}':x='{x}':y='{y}':d=1:s=1920x1080:fps={FPS},"
        "eq=contrast=1.025:saturation=0.96,format=yuv420p"
    )
    run([
        str(FFMPEG), "-y", "-hide_banner",
        "-loop", "1", "-framerate", str(FPS), "-i", str(source),
        "-vf", video_filter,
        "-t", f"{SCENE_DURATION:.2f}",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", str(target),
    ])
    return target


def assemble(clips: list[Path]) -> None:
    command = [str(FFMPEG), "-y", "-hide_banner"]
    for clip in clips:
        command += ["-i", str(clip)]
    audio_index = len(clips)
    command += ["-stream_loop", "2", "-i", str(AUDIO)]

    transitions = ["fade", "smoothleft", "fade", "smoothright", "fade", "smoothleft", "fadeblack"]
    filters: list[str] = []
    label = "0:v"
    elapsed = SCENE_DURATION
    for step in range(1, len(clips)):
        next_label = f"v{step}"
        offset = elapsed - FADE_DURATION
        filters.append(
            f"[{label}][{step}:v]xfade=transition={transitions[step - 1]}:"
            f"duration={FADE_DURATION:.2f}:offset={offset:.2f}[{next_label}]"
        )
        label = next_label
        elapsed += SCENE_DURATION - FADE_DURATION

    filters.append(
        f"[{audio_index}:a]adelay=700:all=1,apad=pad_dur=2,"
        "atrim=duration=32.04,afade=t=in:st=0:d=0.55,"
        "afade=t=out:st=30.70:d=1.25,volume=0.92[a]"
    )

    command += [
        "-filter_complex", ";".join(filters),
        "-map", f"[{label}]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart", str(MASTER),
    ]
    run(command)


def build_web_and_review_assets() -> None:
    run([
        str(FFMPEG), "-y", "-hide_banner", "-i", str(MASTER),
        "-vf", "scale=1280:720:flags=lanczos",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22",
        "-maxrate", "1800k", "-bufsize", "3600k",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", str(WEB),
    ])
    run([
        str(FFMPEG), "-y", "-hide_banner", "-ss", "5.4", "-i", str(MASTER),
        "-frames:v", "1", "-update", "1", "-q:v", "2", str(POSTER),
    ])
    run([
        str(FFMPEG), "-y", "-hide_banner", "-i", str(MASTER),
        "-vf", "fps=1/4,scale=480:-1,tile=4x2",
        "-frames:v", "1", "-update", "1", "-q:v", "2", str(CONTACT),
    ])


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    require_inputs()
    phone = build_phone_composite()
    sources = [
        (ASSETS / "01-dawn-reader.png", "push"),
        (phone, "push"),
        (ASSETS / "03-ui-reading-stage.png", "drift-left"),
        (ASSETS / "04-evening-learner-v2.png", "push"),
        (ASSETS / "05-ui-memory-stage.png", "drift-right"),
        (ASSETS / "06-learning-together.png", "push"),
        (ASSETS / "07-ui-home-stage.png", "drift-left"),
        (ASSETS / "08-final-card.png", "push"),
    ]
    clips = [
        build_scene(index, source, motion=motion)
        for index, (source, motion) in enumerate(sources, start=1)
    ]
    assemble(clips)
    build_web_and_review_assets()
    duration = media_duration(MASTER)
    if not 31.8 <= duration <= 32.2:
        raise RuntimeError(f"Unexpected film duration: {duration:.2f}s")
    print(MASTER)
    print(WEB)
    print(POSTER)
    print(CONTACT)
    print(f"duration={duration:.2f}s")


if __name__ == "__main__":
    main()
