from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from generate_voice import CAPTIONS, NARRATION


ROOT = Path(__file__).resolve().parent
FFMPEG = Path("/Applications/Compass.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg")
FPS = 30
FADE = 0.7
LEAD_IN = {1: 1.1}


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


def build_clip(index: int, audio_length: float) -> tuple[Path, float]:
    work = ROOT / "work" / "ru"
    image = work / f"scene-{index:02d}.png"
    audio = ROOT / "narration" / "ru-male-anton" / f"{index:02d}.wav"
    target = work / f"clip-{index:02d}.mp4"
    lead_in = LEAD_IN.get(index, 0.0)
    clip_length = audio_length + lead_in + 0.9
    video_filter = "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p"
    audio_filter = "loudnorm=I=-16:LRA=6:TP=-1.5,afade=t=in:st=0:d=0.18"
    if lead_in:
        audio_filter += f",adelay={round(lead_in * 1000)}"
    audio_filter += f",apad=pad_dur={clip_length:.2f}"
    run([
        str(FFMPEG), "-y", "-hide_banner", "-loop", "1", "-framerate", str(FPS), "-i", str(image),
        "-i", str(audio), "-vf", video_filter,
        "-af", audio_filter,
        "-t", f"{clip_length:.2f}", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(target),
    ])
    return target, clip_length


def assemble(clips: list[Path], clip_lengths: list[float], master: Path) -> None:
    command = [str(FFMPEG), "-y", "-hide_banner"]
    for clip in clips:
        command += ["-i", str(clip)]
    transitions = ["fade"]
    filters: list[str] = []
    video_label = "0:v"
    audio_label = "0:a"
    elapsed = clip_lengths[0]
    for step in range(1, len(clips)):
        next_video = f"v{step}"
        next_audio = f"a{step}"
        offset = elapsed - FADE
        transition = transitions[(step - 1) % len(transitions)]
        filters.append(f"[{video_label}][{step}:v]xfade=transition={transition}:duration={FADE:.2f}:offset={offset:.2f}[{next_video}]")
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


def write_subtitles(target: Path, audio_lengths: list[float], clip_lengths: list[float]) -> None:
    lines = ["WEBVTT", ""]
    start = 0.0
    for offset, key in enumerate(sorted(NARRATION)):
        caption_start = start + LEAD_IN.get(offset + 1, 0.0)
        end = caption_start + audio_lengths[offset]
        lines.extend([f"{vtt_time(caption_start)} --> {vtt_time(end)}", CAPTIONS[key], ""])
        start += clip_lengths[offset] - FADE
    target.write_text("\n".join(lines), encoding="utf-8")


def review_assets(master: Path, web: Path, poster: Path, contact: Path) -> None:
    run([
        str(FFMPEG), "-y", "-hide_banner", "-i", str(master), "-vf", "scale=1280:720:flags=lanczos",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-maxrate", "1900k", "-bufsize", "3800k",
        "-c:a", "aac", "-b:a", "144k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(web),
    ])
    run([str(FFMPEG), "-y", "-hide_banner", "-ss", "8", "-i", str(master), "-frames:v", "1", "-update", "1", "-q:v", "2", str(poster)])
    run([
        str(FFMPEG), "-y", "-hide_banner", "-framerate", "1", "-start_number", "1",
        "-i", str(ROOT / "work" / "ru" / "scene-%02d.png"),
        "-vf", "scale=480:270:flags=lanczos,tile=4x3:padding=8:margin=8:color=F7F5EF",
        "-frames:v", "1", "-update", "1", "-q:v", "2", str(contact),
    ])


def main() -> None:
    output = ROOT / "output"
    work = ROOT / "work" / "ru"
    output.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)
    audio_lengths: list[float] = []
    clip_lengths: list[float] = []
    clips: list[Path] = []
    for index in range(1, len(NARRATION) + 1):
        audio_length = duration(ROOT / "narration" / "ru-male-anton" / f"{index:02d}.wav")
        clip, clip_length = build_clip(index, audio_length)
        audio_lengths.append(audio_length)
        clip_lengths.append(clip_length)
        clips.append(clip)
    master = output / "ALLIM-Quran-New-Hifz-Methods-RU-1080p.mp4"
    web = output / "ALLIM-Quran-New-Hifz-Methods-RU-Web-720p.mp4"
    poster = output / "ALLIM-Quran-New-Hifz-Methods-RU-poster.jpg"
    contact = output / "ALLIM-Quran-New-Hifz-Methods-RU-contact-sheet.jpg"
    subtitles = output / "ALLIM-Quran-New-Hifz-Methods-RU.vtt"
    assemble(clips, clip_lengths, master)
    write_subtitles(subtitles, audio_lengths, clip_lengths)
    review_assets(master, web, poster, contact)
    print(master)
    print(web)
    print(subtitles)
    print(f"duration={duration(master):.2f}s")


if __name__ == "__main__":
    main()
