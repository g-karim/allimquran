# Optional speech and Quran-content service

The source is `allimquran/asr/server.py`, with bounded audio handling in
`allimquran/asr/audio.py`. It is independent of Frappe request workers.
The service can load directly from the repository with Python 3.10 or newer;
do not install the Python-3.14 Frappe package into its separate environment.

For a new environment, install ffmpeg, create a virtual environment, install a
CPU or CUDA Torch build suitable for the host and `requirements.txt`, then run:

```sh
QURAN_ASR_ALLOWED_ORIGIN=http://localhost:8000 \
QURAN_MUSHAF_CACHE=/path/to/writable/cache/mushaf \
HF_HOME=/path/to/writable/cache \
  /path/to/venv/bin/uvicorn --app-dir /path/to/allimquran \
  allimquran.asr.server:app --host 127.0.0.1 --port 4175 --workers 1
```

Initial startup downloads and warms `tarteel-ai/whisper-tiny-ar-quran` unless
cached. Keep the existing environment/cache on an established deployment;
this migration does not require dependency or model upgrades.

The migrated production environment used Python 3.10.12, FastAPI 0.141.1,
Uvicorn 0.52.4, python-multipart 0.0.32, Transformers 4.57.6,
Torch 2.6.0+cpu and SoundFile 0.14.0. Requirements retain the original ranges;
they are not a complete dependency lock.

## Contract

- `GET /api/quran-asr/health`: `{"ready": true}` after model warmup.
- `POST /api/quran-asr`: multipart `audio`, `verse_key` (for example `1:1`);
  returns `transcript`, `preview_transcript`, `verse_key`, `status`, `reason`, `assessment`.
  Requires the allowed Origin/Referer and
  `X-Requested-With: QuranCompanion`.
- `GET /api/mushaf/chapters`, `/api/mushaf/page/{page}?mushaf=1`,
  `/api/mushaf/locate/{surah}/{ayah}`, `/api/quran/words/{surah}/{ayah}`.

`status` is `transcribed`, `no_speech`, or `uncertain`. `transcribed` describes an
ASR hypothesis, not a verified reading. `assessment` is `word_sequence_only`.
Digital silence is `no_speech`; quiet/short/unrecognized audio is `uncertain`.
Uncertain text is exposed only in `preview_transcript`, while `transcript` stays
empty so old open browser tabs cannot accidentally grant it credit.
Decode errors return 422 (`invalid_audio`), timeouts 504 (`decode_timeout`), and
model failures/queue saturation 503 (`asr_failed`/`asr_busy`). Error details contain
`code` and `message`; they never contain uploaded audio or a private transcript.

Audio is split at sustained quiet pauses with every sample retained. No textual
deduplication is applied across these pauses, preserving actual repeated phrases.
A span longer than 20 seconds without a safe pause uses overlapping 20-second
windows (3-second strides), **but its result is marked uncertain**: this checkpoint's
token merging can erase repetitions and cannot authorize completion. Clients must
not assess/credit `uncertain` preview text. The checkpoint/model is unchanged.

Defaults: 12 MB clips, a hard 60-second decoded-audio limit (oversize returns 422
`audio_too_long`, never silent clipping), 12 recognition requests/minute/IP,
one inference at a time with a 5-second queue wait, CPU inference, 30-day Quran-content cache. Uploaded audio
and normalized WAV files are temporary and cleaned in finally blocks; no recording
archive is created. ASR is not a verified tajwid assessment.

Deploy the matching Companion client and recognition-core asset with this API.
Old clients cannot display the new uncertainty reasons, although uncertain text
cannot be credited through the legacy field. Server-only deployment does not fix
the old client-side matcher. See [stage-one boundaries and checks](../../docs/recognition-stage1.md).

Only expose these endpoints through the same-origin reverse proxy. Do not expose
port 4175 publicly: the service trusts nginx's client-IP header. Model weights and
cache stay outside Git. See `deploy/allim-quran-asr.service`; its read-only bind
mount exposes only the app checkout despite ProtectHome=true.
