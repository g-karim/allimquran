from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from generate_voice import CAPTIONS, NARRATION


ROOT = Path(__file__).resolve().parent
FFMPEG = Path("/Applications/Compass.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg")
FPS = 30
FADE = 0.72


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def duration(path: Path) -> float:
    result = subprocess.run([str(FFMPEG), "-hide_banner", "-i", str(path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    match = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", result.stderr)
    if not match:
        raise RuntimeError(f"Cannot read duration: {path}")
    hours, minutes, seconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def vtt_time(value: float) -> str:
    milliseconds = max(0, round(value * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"


def build_clip(language: str, index: int, audio_length: float) -> tuple[Path, float]:
    work = ROOT / "work" / language
    work.mkdir(parents=True, exist_ok=True)
    image = work / f"scene-{index:02d}.png"
    audio = ROOT / "narration" / language / f"{index:02d}.mp3"
    target = work / f"clip-{index:02d}.mp4"
    clip_length = audio_length + 0.85
    run([
        str(FFMPEG), "-y", "-hide_banner",
        "-loop", "1", "-framerate", str(FPS), "-f", "image2", "-c:v", "mjpeg", "-i", str(image),
        "-i", str(audio),
        "-vf", "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p",
        "-af", f"loudnorm=I=-16:LRA=6:TP=-1.5,afade=t=in:st=0:d=0.12,apad=pad_dur={clip_length:.2f}",
        "-t", f"{clip_length:.2f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(target),
    ])
    return target, clip_length


def write_subtitles(language: str, target: Path, audio_lengths: list[float], clip_lengths: list[float]) -> None:
    lines = ["WEBVTT", ""]
    start = 0.0
    for offset, key in enumerate(sorted(NARRATION[language])):
        end = start + audio_lengths[offset]
        lines.extend([f"{vtt_time(start)} --> {vtt_time(end)}", CAPTIONS[language][key], ""])
        start += clip_lengths[offset] - FADE
    target.write_text("\n".join(lines), encoding="utf-8")


def assemble(clips: list[Path], clip_lengths: list[float], master: Path) -> None:
    command = [str(FFMPEG), "-y", "-hide_banner"]
    for clip in clips:
        command += ["-i", str(clip)]
    transitions = ["fade", "smoothleft", "fade", "smoothright", "fadeblack"]
    filters: list[str] = []
    video_label = "0:v"
    audio_label = "0:a"
    elapsed = clip_lengths[0]
    for step in range(1, len(clips)):
        next_video = f"v{step}"
        next_audio = f"a{step}"
        offset = elapsed - FADE
        filters.append(f"[{video_label}][{step}:v]xfade=transition={transitions[step - 1]}:duration={FADE:.2f}:offset={offset:.2f}[{next_video}]")
        filters.append(f"[{audio_label}][{step}:a]acrossfade=d={FADE:.2f}:c1=tri:c2=tri[{next_audio}]")
        video_label = next_video
        audio_label = next_audio
        elapsed += clip_lengths[step] - FADE
    command += [
        "-filter_complex", ";".join(filters), "-map", f"[{video_label}]", "-map", f"[{audio_label}]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(master),
    ]
    run(command)


def review_assets(master: Path, web: Path, poster: Path, contact: Path) -> None:
    run([
        str(FFMPEG), "-y", "-hide_banner", "-i", str(master), "-vf", "scale=1280:720:flags=lanczos",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-maxrate", "1900k", "-bufsize", "3800k",
        "-c:a", "aac", "-b:a", "144k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(web),
    ])
    run([str(FFMPEG), "-y", "-hide_banner", "-ss", "10", "-i", str(master), "-frames:v", "1", "-update", "1", "-q:v", "2", str(poster)])
    run([str(FFMPEG), "-y", "-hide_banner", "-i", str(master), "-vf", "fps=1/8,scale=480:-1,tile=3x2", "-frames:v", "1", "-update", "1", "-q:v", "2", str(contact)])


def main() -> None:
    language = (sys.argv[1] if len(sys.argv) > 1 else "ru").lower()
    if language not in NARRATION:
        raise SystemExit(f"Unsupported language: {language}")
    output = ROOT / "output"
    output.mkdir(parents=True, exist_ok=True)
    stem = f"ALLIM-Quran-in-heart-300-{language.upper()}"
    master = output / f"{stem}-1080p.mp4"
    web = output / f"{stem}-Web-720p.mp4"
    poster = output / f"{stem}-poster.jpg"
    contact = output / f"{stem}-contact-sheet.jpg"
    subtitles = output / f"{stem}.vtt"
    audio_lengths: list[float] = []
    clip_lengths: list[float] = []
    clips: list[Path] = []
    for index in range(1, 7):
        audio_length = duration(ROOT / "narration" / language / f"{index:02d}.mp3")
        clip, clip_length = build_clip(language, index, audio_length)
        audio_lengths.append(audio_length)
        clip_lengths.append(clip_length)
        clips.append(clip)
    assemble(clips, clip_lengths, master)
    write_subtitles(language, subtitles, audio_lengths, clip_lengths)
    review_assets(master, web, poster, contact)
    print(master)
    print(web)
    print(poster)
    print(contact)
    print(f"duration={duration(master):.2f}s")


if __name__ == "__main__":
    main()
