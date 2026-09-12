from __future__ import annotations

import asyncio
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "work" / "narration-en-approved.mp3"
VOICE = "en-GB-RyanNeural"
RATE = "-6%"
PITCH = "-3Hz"

TEXT = (
    "Most days begin before the noise. "
    "I open ALLIM QURAN, and choose one ayah. "
    "I recite slowly, word by word, and review what needs attention. "
    "Then I return to the same verse through a clear path of repetition: "
    "one hundred, then another, then one final hundred. "
    "When I need context, I can move from the Arabic text, to translation, "
    "and source-linked tafsir. "
    "The goal is not to rush through pages. "
    "It is to understand, remember, and carry the Qur'an into the choices I make. "
    "One ayah today. A stronger heart tomorrow. "
    "ALLIM QURAN. Learn the Book. Live by it."
)


async def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    communicator = edge_tts.Communicate(
        TEXT,
        VOICE,
        rate=RATE,
        pitch=PITCH,
    )
    await communicator.save(str(OUTPUT))
    print(f"voice={VOICE} rate={RATE} pitch={PITCH}")
    print(OUTPUT)


if __name__ == "__main__":
    asyncio.run(main())
