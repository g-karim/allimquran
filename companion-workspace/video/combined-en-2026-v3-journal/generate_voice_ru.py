from __future__ import annotations

import asyncio
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
VOICE = "en-US-AndrewMultilingualNeural"
RATE = "+0%"
PITCH = "-2Hz"

# Stress marks and phonetic "И-И" are for speech synthesis only.
NARRATION_PARTS = [
    "Каждый день я выбираю один аят в А́ллим Коран. Читаю, слушаю и возвращаюсь.",
    "Дневник «Аят дня» превращает размышление в вывод и действие.",
    "И-И помощник помогает осмыслить прочитанное, но не заменяет тафси́р и учителя.",
    "А́ллим объединяет людей по всему миру вокруг одной Книги. Один аят. Одно действие. Так рождается привычка.",
    "А́ллим Коран. Для всего мира.",
]


async def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    narration_files = [WORK / f"narration-ru-andrew-part-{index:02d}.mp3" for index in range(1, 6)]

    for text, target in zip(NARRATION_PARTS, narration_files):
        await edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH).save(str(target))

    print(f"voice={VOICE} rate={RATE} pitch={PITCH}")
    print("translation_mode=Natural Russian voice-over parts only; English and Al-Husary remain in source film")
    for target in narration_files:
        print(target)


if __name__ == "__main__":
    asyncio.run(main())
