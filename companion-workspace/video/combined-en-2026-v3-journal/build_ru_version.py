from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
OUTPUT = ROOT / "output"
SOURCE = OUTPUT / "ALLIM-Quran-Ayah-Journal-FATIHA-HUSARY-PHOTO-INTRO-EN-1080x1920.mp4"
MASTER = OUTPUT / "ALLIM-Quran-Ayah-Journal-FATIHA-HUSARY-PHOTO-INTRO-EN-RU-PREMIUM-ANTON-1080x1920.mp4"
WEB = OUTPUT / "ALLIM-Quran-Ayah-Journal-FATIHA-HUSARY-PHOTO-INTRO-EN-RU-PREMIUM-ANTON-Web-720x1280.mp4"
CAPTIONS = OUTPUT / "ALLIM-Quran-Ayah-Journal-FATIHA-HUSARY-PHOTO-INTRO-EN-RU-PREMIUM-ANTON.vtt"
FFMPEG = Path(
    "/Applications/Compass.app/Contents/Resources/app.asar.unpacked/"
    "node_modules/ffmpeg-static/ffmpeg"
)

FINAL_DURATION = 59.80
TRANSLATION_STARTS = [0.42, 14.81, 26.22, 37.88, 55.33]
TRANSLATION_ENDS = [8.17, 21.36, 32.89, 48.48, FINAL_DURATION]
TRANSLATION_ATEMPO = [1.0, 1.0, 1.0, 1.0, 1.0]

NARRATION_CAPTIONS = [
    "Каждый день я выбираю один аят в АЛЛИМ КОРАН. Читаю, слушаю и возвращаюсь.",
    "Дневник «Аят дня» превращает размышление в вывод и действие.",
    "ИИ-помощник помогает осмыслить прочитанное, но не заменяет тафсир и учителя.",
    "АЛЛИМ объединяет людей по всему миру вокруг одной Книги. Один аят. Одно действие. Так рождается привычка.",
    "АЛЛИМ КОРАН. Для всего мира.",
]


def run(command: list[str]) -> None:
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(command)}\n{result.stderr}")


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


def timestamp(value: float) -> str:
    milliseconds = round(value * 1000)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"


def write_captions() -> None:
    narration_files = [WORK / f"narration-ru-yandex-anton-part-{index:02d}.wav" for index in range(1, 6)]
    blocks = ["WEBVTT", ""]
    for source, caption, start, tempo in zip(
        narration_files, NARRATION_CAPTIONS, TRANSLATION_STARTS, TRANSLATION_ATEMPO
    ):
        duration = media_duration(source) / tempo
        blocks += [f"{timestamp(start)} --> {timestamp(min(start + duration, FINAL_DURATION))}", caption, ""]
    CAPTIONS.write_text("\n".join(blocks), encoding="utf-8")


def main() -> None:
    narration_files = [WORK / f"narration-ru-yandex-anton-part-{index:02d}.wav" for index in range(1, 6)]
    for source in (SOURCE, *narration_files):
        if not source.exists():
            raise RuntimeError(f"Missing source: {source}")
    for source, start, end, tempo in zip(
        narration_files, TRANSLATION_STARTS, TRANSLATION_ENDS, TRANSLATION_ATEMPO
    ):
        if start + media_duration(source) / tempo > end:
            raise RuntimeError(f"Russian translation overlaps Qur'an or exceeds one minute: {source.name}")

    command = [str(FFMPEG), "-y", "-hide_banner", "-i", str(SOURCE)]
    for source in narration_files:
        command += ["-i", str(source)]

    filters = [
        f"[0:v]tpad=stop_mode=clone:stop_duration=1.2,trim=duration={FINAL_DURATION:.2f},setpts=PTS-STARTPTS[v]",
        f"[0:a]aresample=48000,apad=pad_dur=2,atrim=duration={FINAL_DURATION:.2f}[base]",
    ]
    russian_labels: list[str] = []
    for index, (start, tempo) in enumerate(zip(TRANSLATION_STARTS, TRANSLATION_ATEMPO), start=1):
        label = f"ru{index}"
        russian_labels.append(f"[{label}]")
        filters.append(
            f"[{index}:a]aresample=48000,atempo={tempo:.2f},loudnorm=I=-17:TP=-1.5:LRA=7,"
            f"highpass=f=75,lowpass=f=12500,adelay={round(start * 1000)}:all=1,"
            f"apad=whole_dur={FINAL_DURATION:.2f}[{label}]"
        )
    filters += [
        f"{''.join(russian_labels)}amix=inputs={len(russian_labels)}:duration=longest:normalize=0[rusmix]",
        "[rusmix]asplit=2[rusmain][side]",
        "[base][side]sidechaincompress=threshold=0.012:ratio=7:attack=14:release=240:makeup=1[ducked]",
        "[ducked][rusmain]amix=inputs=2:duration=longest:weights='1 1':normalize=0,alimiter=limit=0.90:level=0[a]",
    ]
    run(
        command + [
            "-filter_complex", ";".join(filters), "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(MASTER),
        ]
    )
    run(
        [
            str(FFMPEG), "-y", "-hide_banner", "-i", str(MASTER),
            "-vf", "scale=720:1280:flags=lanczos", "-c:v", "libx264", "-preset", "medium",
            "-crf", "22", "-maxrate", "1800k", "-bufsize", "3600k", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(WEB),
        ]
    )
    write_captions()
    print(MASTER)
    print(WEB)
    print(CAPTIONS)
    print("audio=English Ryan preserved under Russian Yandex SpeechKit Anton; Al-Husary preserved unchanged")
    print(f"video_duration={media_duration(MASTER):.2f}s")


if __name__ == "__main__":
    main()
