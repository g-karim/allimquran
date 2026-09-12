from __future__ import annotations

import argparse
import base64
import getpass
import json
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent
VOICE = "Yandex SpeechKit v3 · anton"
ENDPOINT = "https://tts.api.cloud.yandex.net:443/tts/v3/utteranceSynthesis"
FFMPEG = Path("/Applications/Compass.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg")

NARRATION = {
    "01": "Заучивание Кор+ана требует не только повторения, но и понятной системы. Поэтому платформа «+Аллим Кор+ан» заранее показывает ученику точные правила каждого метода: что читать, сколько раз повторять, когда соединять а+яты и когда переходить дальше.",
    "02": "Метод тридцати трёх повторений с постепенным соединением а+ятов. Сначала прочитайте первый а+ят ровно тридцать три раза. Затем прочитайте второй а+ят отдельно тридцать три раза. Счётчик увеличивается только после полного чтения выбранного а+ята.",
    "03": "Теперь соедините первый и второй а+яты и прочитайте связку тридцать три раза. Выучите третий а+ят отдельно тридцать три раза. После этого повторите связку: первый, второй и третий а+яты — ещё тридцать три раза. Когда дойдёте до конца, прочитайте всю страницу целиком тридцать три раза.",
    "04": "Турецкая кладка — адаптация +Аллим. Начните с самой нижней строки или нижнего а+ята страницы. Прочитайте его тридцать три раза. Затем возьмите строку через одну выше и также повторите тридцать три раза.",
    "05": "Вернитесь к строке, которую пропустили. Прочитайте её тридцать три раза и соедините все три строки в один блок. Затем повторите ту же схему выше. Так страница строится снизу вверх, пока вы не сможете прочитать её без разрыва.",
    "06": "После этого укрепляйте связь между страницами. Закрепите последнюю страницу суры. Затем возьмите страницу через одну. После неё выучите пропущенную страницу между ними и прочитайте все три страницы подряд. Так двигайтесь от конца суры к её началу.",
    "07": "Цифровой Л+яух. Перепишите страницу Кор+ана рукой на разлинованной бумаге и произносите текст вслух. После завершения сравните каждое слово и знак с эталонным м+усхафом. Загружайте в +Аллим только проверенную страницу.",
    "08": "Сохраните фотографию в личной библиотеке и читайте страницу вслух, отмечая повторения. Затем закройте изображение, прочитайте без подсказки и снова перепишите страницу по памяти. Так работают рука, зрение, голос и воспроизведение.",
    "09": "+Аллим учитывает точность чтения, ошибки в связках и качество возвращения через несколько дней. План объясняет, что повторить сегодня и почему. Вы выбираете методику, а система помогает выполнять её последовательно.",
    "10": "Сначала понятный метод. Затем ежедневный точный план. +Аллим помогает шаг за шагом сохранять Кор+ан в сердце.",
}

CAPTIONS = {
    "01": "Заучивание Корана требует не только повторения, но и понятной системы. Поэтому платформа «АЛЛИМ КОРАН» заранее показывает ученику точные правила каждого метода: что читать, сколько раз повторять, когда соединять аяты и когда переходить дальше.",
    "02": "Метод 33 повторений с постепенным соединением аятов. Сначала прочитайте первый аят ровно 33 раза. Затем прочитайте второй аят отдельно 33 раза. Счётчик увеличивается только после полного чтения выбранного аята.",
    "03": "Теперь соедините первый и второй аяты и прочитайте связку 33 раза. Выучите третий аят отдельно 33 раза. После этого повторите связку: первый, второй и третий аяты — ещё 33 раза. Когда дойдёте до конца, прочитайте всю страницу целиком 33 раза.",
    "04": "Турецкая кладка — адаптация ALLIM. Начните с самой нижней строки или нижнего аята страницы. Прочитайте его 33 раза. Затем возьмите строку через одну выше и также повторите 33 раза.",
    "05": "Вернитесь к строке, которую пропустили. Прочитайте её 33 раза и соедините все три строки в один блок. Затем повторите ту же схему выше. Так страница строится снизу вверх, пока вы не сможете прочитать её без разрыва.",
    "06": "После этого укрепляйте связь между страницами. Закрепите последнюю страницу суры. Затем возьмите страницу через одну. После неё выучите пропущенную страницу между ними и прочитайте все три страницы подряд. Так двигайтесь от конца суры к её началу.",
    "07": "Цифровой Ляух. Перепишите страницу Корана рукой на разлинованной бумаге и произносите текст вслух. После завершения сравните каждое слово и знак с эталонным мусхафом. Загружайте в ALLIM только проверенную страницу.",
    "08": "Сохраните фотографию в личной библиотеке и читайте страницу вслух, отмечая повторения. Затем закройте изображение, прочитайте без подсказки и снова перепишите страницу по памяти. Так работают рука, зрение, голос и воспроизведение.",
    "09": "ALLIM учитывает точность чтения, ошибки в связках и качество возвращения через несколько дней. План объясняет, что повторить сегодня и почему. Вы выбираете методику, а система помогает выполнять её последовательно.",
    "10": "Сначала понятный метод. Затем ежедневный точный план. ALLIM помогает шаг за шагом сохранять Коран в сердце.",
}


def split_for_api(text: str, limit: int = 235) -> list[str]:
    if len(text) <= limit:
        return [text]
    sentences = re.split(r"(?<=[.!?])\s+", text)
    parts: list[str] = []
    current = ""
    for sentence in sentences:
        candidate = f"{current} {sentence}".strip()
        if len(candidate) <= limit:
            current = candidate
            continue
        if current:
            parts.append(current)
        current = sentence
    if current:
        parts.append(current)
    if any(len(part) > limit for part in parts):
        raise ValueError("Narration contains a sentence longer than the SpeechKit v3 limit")
    return parts


def request_audio(api_key: str, text: str) -> bytes:
    payload = json.dumps({
        "text": text,
        "hints": [
            {"voice": "anton"},
            {"role": "neutral"},
            {"speed": 0.94},
        ],
    }, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={
            "Authorization": f"Api-Key {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    raw = ""
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                raw = response.read().decode("utf-8")
            break
        except urllib.error.HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"SpeechKit returned HTTP {error.code}: {details}") from error
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt == 3:
                raise RuntimeError("SpeechKit connection failed after three attempts") from error
            time.sleep(2 ** attempt)

    chunks: list[bytes] = []
    for line in raw.splitlines():
        if not line.strip():
            continue
        message = json.loads(line)
        encoded = message.get("result", {}).get("audioChunk", {}).get("data")
        if encoded:
            chunks.append(base64.b64decode(encoded))
    if not chunks:
        raise RuntimeError("SpeechKit response did not contain audio data")
    return b"".join(chunks)


def join_wav(parts: list[Path], target: Path) -> None:
    if len(parts) == 1:
        parts[0].replace(target)
        return
    command = [str(FFMPEG), "-y", "-hide_banner"]
    for part in parts:
        command.extend(["-i", str(part)])
    labels = "".join(f"[{index}:a]" for index in range(len(parts)))
    command.extend([
        "-filter_complex", f"{labels}concat=n={len(parts)}:v=0:a=1[out]",
        "-map", "[out]", "-c:a", "pcm_s16le", str(target),
    ])
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def synthesize_all(api_key: str, target: Path, selected: list[str] | None = None) -> None:
    with tempfile.TemporaryDirectory(prefix="allim-anton-") as temporary:
        temp_root = Path(temporary)
        keys = selected or list(NARRATION)
        for key in keys:
            text = NARRATION[key]
            pieces: list[Path] = []
            for part_index, part in enumerate(split_for_api(text), start=1):
                piece = temp_root / f"{key}-{part_index:02d}.wav"
                piece.write_bytes(request_audio(api_key, part))
                pieces.append(piece)
            join_wav(pieces, target / f"{key}.wav")
            subprocess.run(
                [str(FFMPEG), "-v", "error", "-i", str(target / f"{key}.wav"), "-f", "null", "-"],
                check=True,
            )
            print(f"generated={key}.wav voice=anton role=neutral speed=0.94")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--synthesize", action="store_true", help="Read a temporary API key from stdin and generate Anton WAV files")
    parser.add_argument("--scene", action="append", choices=sorted(NARRATION), help="Regenerate only the selected scene; may be repeated")
    args = parser.parse_args()
    target = ROOT / "narration" / "ru-male-anton"
    target.mkdir(parents=True, exist_ok=True)
    if args.synthesize:
        api_key = getpass.getpass("Temporary SpeechKit API key: ").strip() if sys.stdin.isatty() else sys.stdin.read().strip()
        if not api_key:
            raise SystemExit("A temporary SpeechKit API key must be supplied through stdin")
        synthesize_all(api_key, target, args.scene)
    missing = [target / f"{key}.wav" for key in NARRATION if not (target / f"{key}.wav").exists()]
    if missing:
        names = ", ".join(path.name for path in missing)
        raise SystemExit(
            "Male narration is required. Generate approved Yandex SpeechKit v3 "
            f"Anton files first: {names}. Female or generic placeholder voices are forbidden."
        )
    print(f"voice={VOICE} male_only=true")
    print(target)


if __name__ == "__main__":
    main()
