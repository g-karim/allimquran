from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np


FFMPEG = Path(
    "/Applications/Compass.app/Contents/Resources/app.asar.unpacked/"
    "node_modules/ffmpeg-static/ffmpeg"
)
RATE = 2000


def decode(path: Path) -> np.ndarray:
    completed = subprocess.run(
        [
            str(FFMPEG),
            "-v",
            "error",
            "-i",
            str(path),
            "-ac",
            "1",
            "-ar",
            str(RATE),
            "-f",
            "s16le",
            "-",
        ],
        check=True,
        stdout=subprocess.PIPE,
    )
    audio = np.frombuffer(completed.stdout, dtype="<i2").astype(np.float32)
    audio -= audio.mean()
    scale = np.sqrt(np.mean(audio * audio)) or 1.0
    return audio / scale


def best_match(needle: np.ndarray, haystack: np.ndarray) -> tuple[float, float]:
    if haystack.size < needle.size:
        needle, haystack = haystack, needle

    fft_size = 1 << (haystack.size + needle.size - 1).bit_length()
    corr = np.fft.irfft(
        np.fft.rfft(haystack, fft_size)
        * np.conj(np.fft.rfft(needle, fft_size)),
        fft_size,
    )
    valid = corr[: haystack.size - needle.size + 1]

    squared = haystack * haystack
    prefix = np.concatenate((np.zeros(1, dtype=np.float64), np.cumsum(squared, dtype=np.float64)))
    window_energy = prefix[needle.size :] - prefix[: -needle.size]
    denominator = np.sqrt(window_energy * np.sum(needle * needle)) + 1e-9
    normalized = valid / denominator
    index = int(np.argmax(normalized))
    return float(normalized[index]), index / RATE


current = decode(Path("review/video-premium/current-audio.wav"))
candidates = [
    Path("/Users/rafael/Downloads/fileb57f08.mp3"),
    Path("/Users/rafael/Downloads/63b1fb4e43149539556167.mp3"),
    Path("/Users/rafael/Downloads/63b1f9262b80a062173801.mp3"),
    Path("/Users/rafael/Downloads/filebb1b13.mp3"),
    Path("/Users/rafael/Downloads/63b1f7ffd9835785670574.mp3"),
    Path("/Users/rafael/Downloads/file3bfea6.mp3"),
    Path("/Users/rafael/Downloads/file234618 (2).mp3"),
    Path("/Users/rafael/Downloads/filefbe582.mp3"),
]

for candidate_path in candidates:
    candidate = decode(candidate_path)
    score, offset = best_match(current, candidate)
    print(f"{score:0.4f}\t{offset:8.2f}s\t{candidate_path.name}")
