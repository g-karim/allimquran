from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
FFMPEG = Path("/Applications/Compass.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg")
FPS = 30
SCENES = 10
SCENE_DURATION = 7.0
FADE = 0.55


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def main() -> None:
    output = ROOT / "output"
    work = ROOT / "work" / "visual-proof"
    output.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)
    clips: list[Path] = []
    for index in range(1, SCENES + 1):
        source = ROOT / "work" / "ru" / f"scene-{index:02d}.png"
        target = work / f"clip-{index:02d}.mp4"
        run([
            str(FFMPEG), "-y", "-hide_banner", "-loop", "1", "-framerate", str(FPS), "-i", str(source),
            "-t", f"{SCENE_DURATION:.2f}", "-vf", "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p",
            "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(target),
        ])
        clips.append(target)

    command = [str(FFMPEG), "-y", "-hide_banner"]
    for clip in clips:
        command += ["-i", str(clip)]
    filters: list[str] = []
    label = "0:v"
    elapsed = SCENE_DURATION
    transitions = ["fade"]
    for step in range(1, len(clips)):
        next_label = f"v{step}"
        offset = elapsed - FADE
        transition = transitions[(step - 1) % len(transitions)]
        filters.append(f"[{label}][{step}:v]xfade=transition={transition}:duration={FADE:.2f}:offset={offset:.2f}[{next_label}]")
        label = next_label
        elapsed += SCENE_DURATION - FADE
    target = output / "ALLIM-Quran-New-Hifz-Methods-RU-VISUAL-PROOF-NO-AUDIO-1080p.mp4"
    command += [
        "-filter_complex", ";".join(filters), "-map", f"[{label}]", "-an", "-c:v", "libx264",
        "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(target),
    ]
    run(command)
    print(target)


if __name__ == "__main__":
    main()
