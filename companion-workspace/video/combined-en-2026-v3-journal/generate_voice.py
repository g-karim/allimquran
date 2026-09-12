from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
OUTPUT = WORK / "narration-en-ryan-fatiha-husary-intercut.mp3"
FATIHA_DIR = ROOT / "assets" / "audio" / "fatiha-husary"
FFMPEG = Path(
    "/Applications/Compass.app/Contents/Resources/app.asar.unpacked/"
    "node_modules/ffmpeg-static/ffmpeg"
)
VOICE = "en-GB-RyanNeural"
RATE = "-6%"
PITCH = "-3Hz"

NARRATION_PARTS = [
    "Each day, I begin with one ayah in ALLIM QURAN. I read, listen, and return.",
    "The Ayah of the Day Journal turns reflection into one clear takeaway and one action for today.",
    "The AI companion supports reflection. It never replaces tafsir or a teacher.",
    "Each evening, I review. One ayah. One reflection. One action. A daily habit.",
    "ALLIM QURAN.",
]


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


async def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    narration_files = [WORK / f"narration-en-ryan-part-{index:02d}.mp3" for index in range(1, 6)]
    recitation_files = [FATIHA_DIR / f"00100{ayah}.mp3" for ayah in range(2, 6)]
    for recitation in recitation_files:
        if not recitation.exists():
            raise RuntimeError(f"Approved Al-Fatihah recitation is missing: {recitation}")

    for text, target in zip(NARRATION_PARTS, narration_files):
        await edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH).save(str(target))

    ordered = []
    for index, narration in enumerate(narration_files):
        ordered.append(("narration", narration))
        if index < len(recitation_files):
            ordered.append(("recitation", recitation_files[index]))

    command = [str(FFMPEG), "-y", "-hide_banner"]
    for _, source in ordered:
        command += ["-i", str(source)]

    filters = []
    labels = []
    for index, (kind, source) in enumerate(ordered):
        label = f"s{index}"
        labels.append(f"[{label}]")
        if kind == "recitation":
            duration = media_duration(source)
            filters.append(
                f"[{index}:a]aresample=48000,loudnorm=I=-20:TP=-2:LRA=7,"
                f"afade=t=in:st=0:d=0.06,afade=t=out:st={max(0, duration - 0.14):.2f}:d=0.12,"
                f"apad=pad_dur=0.18[{label}]"
            )
        else:
            suffix = "" if index == len(ordered) - 1 else ",apad=pad_dur=0.18"
            filters.append(
                f"[{index}:a]aresample=48000,loudnorm=I=-19:TP=-2:LRA=7{suffix}[{label}]"
            )
    filters.append(f"{''.join(labels)}concat=n={len(ordered)}:v=0:a=1[out]")

    command += [
        "-filter_complex", ";".join(filters), "-map", "[out]",
        "-c:a", "libmp3lame", "-b:a", "192k", str(OUTPUT),
    ]
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode:
        raise RuntimeError(f"Audio assembly failed:\n{result.stderr}")

    print(f"voice={VOICE} rate={RATE} pitch={PITCH}")
    print("quran_recitation=Mahmoud Khalil Al-Husary full_ayat=1:2,1:3,1:4,1:5")
    print(OUTPUT)


if __name__ == "__main__":
    asyncio.run(main())
