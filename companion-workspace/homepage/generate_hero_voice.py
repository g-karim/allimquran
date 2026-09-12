from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parent
WORK = ROOT / ".hero-voice-work"
VOICE = "ar-SA-HamedNeural"
FFMPEG = Path("/Applications/Compass.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg")
OUTPUT = ROOT / "allim-hero-neutral-demo-v1.mp3"

SEGMENTS = {
    "before-error.mp3": "ذَٰلِكَ الْكِتَابُ لَا رِيبَ",
    # A phonetic TTS cue for the connected reading هُدًى لِّلْمُتَّقِينَ:
    # the tanwin assimilates into lam and must not be pronounced as a separate n.
    "after-correction.mp3": "رَيْبَ فِيهِ هُدَلْ لِلْمُتَّقِينَ",
}


async def main() -> None:
    WORK.mkdir(exist_ok=True)
    for filename, text in SEGMENTS.items():
        communicate = edge_tts.Communicate(text, VOICE, rate="-12%", pitch="-6Hz")
        await communicate.save(str(WORK / filename))

    silence = WORK / "correction-pause.wav"
    subprocess.run(
        [
            str(FFMPEG), "-y", "-f", "lavfi", "-i",
            "anullsrc=r=48000:cl=mono", "-t", "1.08", str(silence),
        ],
        check=True,
    )
    subprocess.run(
        [
            str(FFMPEG), "-y",
            "-i", str(WORK / "before-error.mp3"),
            "-i", str(silence),
            "-i", str(WORK / "after-correction.mp3"),
            "-filter_complex",
            "[0:a]aresample=48000[a0];[1:a]aresample=48000[a1];"
            "[2:a]aresample=48000[a2];[a0][a1][a2]concat=n=3:v=0:a=1,"
            "loudnorm=I=-18:LRA=7:TP=-1.5,afade=t=in:st=0:d=0.12[a]",
            "-map", "[a]", "-ar", "48000", "-ac", "1", "-b:a", "128k",
            str(OUTPUT),
        ],
        check=True,
    )


if __name__ == "__main__":
    asyncio.run(main())
