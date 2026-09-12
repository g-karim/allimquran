from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from generate_voice import SEGMENTS


ROOT = Path(__file__).resolve().parent
FFMPEG = Path("/Applications/Compass.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg")
FADE = 0.58
TRANSITIONS = ["fade", "smoothleft", "smoothup", "fade", "smoothright", "fadeblack"]
OUTPUT_CODES = {"ru": "RU", "en": "EN", "ar": "AR"}


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def duration(path: Path) -> float:
    result = subprocess.run(
        [str(FFMPEG), "-hide_banner", "-i", str(path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    match = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", result.stderr)
    if not match:
        raise RuntimeError(f"Cannot read duration: {path}")
    hours, minutes, seconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def build_scene(language: str, index: int, audio_length: float) -> tuple[Path, float]:
    work = ROOT / "work" / language
    work.mkdir(parents=True, exist_ok=True)
    image = work / f"scene-{index:02d}.jpg"
    narration = ROOT / "narration" / language / f"{index:02d}.mp3"
    output = work / f"clip-{index:02d}.mp4"
    clip_length = audio_length + 0.42
    video_filter = (
        "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,"
        "crop=1920:1080,"
        "fps=30,"
        "format=yuv420p"
    )
    audio_filter = (
        "loudnorm=I=-16:LRA=7:TP=-1.5,"
        "afade=t=in:st=0:d=0.14,"
        f"apad=pad_dur={clip_length:.2f}"
    )
    run([
        str(FFMPEG), "-y",
        "-loop", "1", "-framerate", "30", "-f", "image2", "-c:v", "mjpeg", "-i", str(image),
        "-i", str(narration),
        "-vf", video_filter,
        "-af", audio_filter,
        "-t", f"{clip_length:.2f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart",
        str(output),
    ])
    return output, clip_length


def vtt_time(value: float) -> str:
    milliseconds = max(0, round(value * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"


def write_subtitles(language: str, audio_lengths: list[float], clip_lengths: list[float], target: Path) -> None:
    lines = ["WEBVTT", ""]
    start = 0.0
    for index, key in enumerate(sorted(SEGMENTS[language])):
        end = start + audio_lengths[index]
        visible_text = SEGMENTS[language][key].replace("́", "")
        lines.extend([f"{vtt_time(start)} --> {vtt_time(end)}", visible_text, ""])
        start += clip_lengths[index] - FADE
    target.write_text("\n".join(lines), encoding="utf-8")


def build_language(language: str) -> Path:
    output_dir = ROOT / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    clips: list[Path] = []
    clip_lengths: list[float] = []
    audio_lengths: list[float] = []
    for index in range(1, 8):
        audio_length = duration(ROOT / "narration" / language / f"{index:02d}.mp3")
        clip, clip_length = build_scene(language, index, audio_length)
        clips.append(clip)
        clip_lengths.append(clip_length)
        audio_lengths.append(audio_length)

    command = [str(FFMPEG), "-y"]
    for clip in clips:
        command += ["-i", str(clip)]

    filters: list[str] = []
    video_label = "0:v"
    audio_label = "0:a"
    elapsed = clip_lengths[0]
    for step in range(1, len(clips)):
        next_video = f"v{step}"
        next_audio = f"a{step}"
        offset = elapsed - FADE
        filters.append(
            f"[{video_label}][{step}:v]xfade=transition={TRANSITIONS[step - 1]}:duration={FADE}:offset={offset:.2f}[{next_video}]"
        )
        filters.append(f"[{audio_label}][{step}:a]acrossfade=d={FADE}:c1=tri:c2=tri[{next_audio}]")
        video_label = next_video
        audio_label = next_audio
        elapsed += clip_lengths[step] - FADE

    code = OUTPUT_CODES[language]
    output = output_dir / f"ALLIM-Quran-Companion-{code}.mp4"
    command += [
        "-filter_complex", ";".join(filters),
        "-map", f"[{video_label}]", "-map", f"[{audio_label}]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(output),
    ]
    run(command)

    poster = output_dir / f"ALLIM-Quran-Companion-{code}-poster.jpg"
    run([
        str(FFMPEG), "-y", "-hide_banner", "-ss", "1", "-i", str(output),
        "-frames:v", "1", "-update", "1", "-q:v", "2", str(poster),
    ])
    write_subtitles(
        language,
        audio_lengths,
        clip_lengths,
        output_dir / f"ALLIM-Quran-Companion-{code}.vtt",
    )
    return output


def main() -> None:
    languages = sys.argv[1:] or ["ru", "en", "ar"]
    for language in languages:
        if language not in OUTPUT_CODES:
            raise SystemExit(f"Unknown language: {language}")
        print(build_language(language))


if __name__ == "__main__":
    main()
