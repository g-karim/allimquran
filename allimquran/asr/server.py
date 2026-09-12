"""Local same-origin Quran recitation ASR service for Qur'an Companion."""

from __future__ import annotations

import html
import json
import logging
import os
import re
import secrets
import tempfile
import threading
import time
import urllib.error
import urllib.request
from collections import defaultdict, deque
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, ConfigDict, StrictBool

from allimquran.asr.audio import transcribe_audio
from allimquran.asr.research import RETENTION_DAYS, VERSION, Corpus
from allimquran.asr.review import ReviewError, ReviewQueue

APP_ROOT = Path(__file__).resolve().parents[1]
MODEL_ID = os.getenv("QURAN_ASR_MODEL", "tarteel-ai/whisper-tiny-ar-quran")
MAX_AUDIO_BYTES = int(os.getenv("QURAN_ASR_MAX_AUDIO_BYTES", str(12 * 1024 * 1024)))
ALLOWED_ORIGIN = os.getenv("QURAN_ASR_ALLOWED_ORIGIN", "https://allimquran.com").rstrip("/")
RATE_LIMIT_PER_MINUTE = int(os.getenv("QURAN_ASR_RATE_LIMIT", "12"))
QURAN_CONTENT_API = "https://api.quran.com/api/v4"
MUSHAF_CACHE_ROOT = Path(os.getenv("QURAN_MUSHAF_CACHE", "/opt/allim-asr/cache/mushaf"))
MUSHAF_CACHE_SECONDS = int(os.getenv("QURAN_MUSHAF_CACHE_SECONDS", str(30 * 24 * 60 * 60)))
QURAN_TRANSLATION_CACHE_SECONDS = int(os.getenv("QURAN_TRANSLATION_CACHE_SECONDS", str(6 * 24 * 60 * 60)))
RUSSIAN_TRANSLATION_ID = int(os.getenv("QURAN_RUSSIAN_TRANSLATION_ID", "45"))
RUSSIAN_TRANSLATION_EDITIONS = {
	45: {"name": "Russian Translation (Elmir Kuliev)", "author": "Эльмир Кулиев"},
	79: {"name": "Abu Adel", "author": "Абу Адель"},
}
VERSE_KEY_RE = re.compile(r"^(?:[1-9]|[1-9][0-9]|1(?:0[0-9]|1[0-4])):(?:[1-9]|[1-9][0-9]|[12][0-9][0-9])$")
REVIEWED_RUSSIAN_GLOSSES = {
	"2:2": [
		"это / то",
		"Писание / Книга",
		"нет / не",
		"сомнение",
		"в нём",
		"руководство",
		"для богобоязненных",
	],
	"91:7": ["и душой", "и Тем, Кто", "соразмерил её"],
}
PUBLIC_FILES = {
	"index.html",
	"styles.css",
	"app.js",
	"quran-data.js",
	"sw.js",
	"manifest.webmanifest",
	"app-icon.svg",
}

app = FastAPI(title="Quran Companion ASR", docs_url=None, redoc_url=None)
_pipeline: Any | None = None
_pipeline_lock = threading.Lock()
_transcription_lock = threading.Lock()
_rate_limit_lock = threading.Lock()
_mushaf_cache_lock = threading.Lock()
_request_times: dict[str, deque[float]] = defaultdict(deque)
_research_root = os.getenv("QURAN_RESEARCH_ROOT")
research_corpus = Corpus(_research_root) if _research_root else None
RESEARCH_ENABLED = os.getenv("QURAN_RESEARCH_ENABLED", "0") == "1"
REVIEW_SECRET = os.getenv("QURAN_REVIEW_SECRET", "")
_research_stop = threading.Event()
logger = logging.getLogger(__name__)


def _research_maintenance():
	while not _research_stop.is_set():
		try:
			research_corpus.purge()
		except Exception:
			logger.warning("Research expiry cleanup failed")
		_research_stop.wait(3600)


@app.middleware("http")
async def security_headers(request, call_next):
	response = await call_next(request)
	response.headers["X-Content-Type-Options"] = "nosniff"
	response.headers["Referrer-Policy"] = "no-referrer"
	if request.url.path.startswith("/api/quran/translation/"):
		response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
	elif request.url.path.startswith("/api/mushaf/") or request.url.path.startswith("/api/quran/words/"):
		response.headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=604800"
	elif request.url.path.startswith(("/api/", "/internal/")):
		response.headers["Cache-Control"] = "no-store"
	return response


@app.post("/internal/review")
async def internal_review(request: Request):
	"""Loopback-only Frappe bridge; never add this route to the public nginx proxy."""
	key = request.headers.get("x-allim-review-key", "")
	if (
		not request.client
		or request.client.host not in {"127.0.0.1", "::1"}
		or len(REVIEW_SECRET) < 64
		or not secrets.compare_digest(key, REVIEW_SECRET)
	):
		raise HTTPException(403, "Private reviewer bridge required")
	if not research_corpus:
		raise HTTPException(503, "Private corpus unavailable")
	# Bound body before JSON parsing, including chunked requests.
	chunks = bytearray()
	async for chunk in request.stream():
		chunks.extend(chunk)
		if len(chunks) > 65536:
			raise HTTPException(413, "Review payload too large")
	try:
		body = json.loads(chunks)
	except (ValueError, UnicodeDecodeError) as error:
		raise HTTPException(422, "Invalid review payload") from error
	if not isinstance(body, dict):
		raise HTTPException(422, "Invalid review payload")
	queue = ReviewQueue(research_corpus)
	try:
		action = body.get("action")
		if action == "list":
			return await run_in_threadpool(
				queue.listing, body.get("status", "pending"), body.get("offset", 0)
			)
		if action == "detail":
			return await run_in_threadpool(queue.detail, body.get("id"), body.get("reviewer"))
		if action == "audio":
			payload = await run_in_threadpool(queue.audio, body.get("id"))
			return Response(payload, media_type="audio/wav")
		if action == "save":
			return await run_in_threadpool(
				queue.save,
				body.get("id"),
				body.get("reviewer"),
				body.get("revision"),
				body.get("status"),
				body.get("annotation"),
			)
		raise ReviewError(422, "Invalid action")
	except ReviewError as error:
		raise HTTPException(error.status, str(error)) from error


def _get_pipeline():
	global _pipeline
	if _pipeline is not None:
		return _pipeline
	with _pipeline_lock:
		if _pipeline is None:
			from transformers import pipeline

			configured_device = os.getenv("QURAN_ASR_DEVICE", "-1")
			try:
				device: int | str = int(configured_device)
			except ValueError:
				device = configured_device
			_pipeline = pipeline(
				"automatic-speech-recognition",
				model=MODEL_ID,
				device=device,
			)
	return _pipeline


def _transcribe(path: str) -> dict[str, Any]:
	return transcribe_audio(path, _get_pipeline, _transcription_lock)


def _suffix_for(content_type: str) -> str:
	if "mp4" in content_type:
		return ".m4a"
	if "wav" in content_type:
		return ".wav"
	return ".webm"


def _fetch_quran_json(url: str) -> dict[str, Any]:
	request = urllib.request.Request(
		url,
		headers={
			"Accept": "application/json",
			"User-Agent": "ALLIM-Quran-Companion/1.0",
		},
	)
	try:
		with urllib.request.urlopen(request, timeout=20) as response:
			payload = response.read(6 * 1024 * 1024 + 1)
	except (urllib.error.URLError, TimeoutError, OSError) as error:
		raise HTTPException(status_code=502, detail="Quran source is temporarily unavailable") from error
	if len(payload) > 6 * 1024 * 1024:
		raise HTTPException(status_code=502, detail="Quran source response is too large")
	try:
		data = json.loads(payload.decode("utf-8"))
	except (UnicodeDecodeError, json.JSONDecodeError) as error:
		raise HTTPException(status_code=502, detail="Invalid Quran source response") from error
	if not isinstance(data, dict):
		raise HTTPException(status_code=502, detail="Invalid Quran source response")
	return data


def _cached_quran_json(
	cache_name: str,
	url: str,
	max_age_seconds: int = MUSHAF_CACHE_SECONDS,
) -> dict[str, Any]:
	MUSHAF_CACHE_ROOT.mkdir(parents=True, exist_ok=True)
	cache_path = MUSHAF_CACHE_ROOT / cache_name
	with _mushaf_cache_lock:
		if cache_path.is_file() and time.time() - cache_path.stat().st_mtime < max_age_seconds:
			try:
				cached = json.loads(cache_path.read_text(encoding="utf-8"))
				if isinstance(cached, dict):
					return cached
			except (OSError, json.JSONDecodeError):
				pass
		data = _fetch_quran_json(url)
		temporary_path = cache_path.with_suffix(cache_path.suffix + ".tmp")
		temporary_path.write_text(
			json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
		)
		temporary_path.replace(cache_path)
		return data


def _plain_text(value: Any) -> str:
	clean = re.sub(r"<[^>]+>", "", str(value or ""))
	return html.unescape(clean).strip()


def _validate_request(request: Request, x_requested_with: str | None) -> None:
	if x_requested_with != "QuranCompanion":
		raise HTTPException(status_code=403, detail="Same-origin app request required")
	origin = (request.headers.get("origin") or "").rstrip("/")
	referer = request.headers.get("referer") or ""
	if origin != ALLOWED_ORIGIN and not referer.startswith(ALLOWED_ORIGIN + "/"):
		raise HTTPException(status_code=403, detail="Origin not allowed")

	client_key = request.headers.get("x-real-ip") or (request.client.host if request.client else "unknown")
	now = time.monotonic()
	with _rate_limit_lock:
		timestamps = _request_times[client_key]
		while timestamps and now - timestamps[0] >= 60:
			timestamps.popleft()
		if len(timestamps) >= RATE_LIMIT_PER_MINUTE:
			raise HTTPException(status_code=429, detail="Too many recognition requests")
		timestamps.append(now)


@app.on_event("startup")
def warm_model() -> None:
	_get_pipeline()
	if research_corpus:
		_research_stop.clear()
		threading.Thread(target=_research_maintenance, daemon=True).start()


@app.on_event("shutdown")
def stop_research_maintenance():
	_research_stop.set()


class ResearchConsent(BaseModel):
	model_config = ConfigDict(extra="forbid")
	version: str
	adult: StrictBool


def _validate_research_request(request, x_requested_with):
	# Reject conflicting Origin even if Referer happens to look same-origin.
	if request.headers.get("origin", "").rstrip("/") != ALLOWED_ORIGIN:
		raise HTTPException(403, "Origin not allowed")
	_validate_request(request, x_requested_with)


@app.get("/api/quran-asr/research")
async def research_config():
	return {
		"enabled": RESEARCH_ENABLED and research_corpus is not None,
		"version": VERSION,
		"retention_days": RETENTION_DAYS,
	}


@app.post("/api/quran-asr/research")
async def research_consent(
	request: Request,
	consent: ResearchConsent,
	x_requested_with: str | None = Header(default=None),
	x_allim_contribution: str | None = Header(default=None),
):
	_validate_research_request(request, x_requested_with)
	if not RESEARCH_ENABLED or research_corpus is None:
		raise HTTPException(503, "Participation is unavailable")
	try:
		expires = await run_in_threadpool(
			research_corpus.grant, x_allim_contribution, consent.version, consent.adult
		)
	except ValueError as error:
		raise HTTPException(
			422, "Current consent, adult confirmation and a valid key are required"
		) from error
	return {"granted": True, "expires": expires, "version": VERSION}


@app.delete("/api/quran-asr/research")
async def research_withdraw(
	request: Request,
	x_requested_with: str | None = Header(default=None),
	x_allim_contribution: str | None = Header(default=None),
):
	_validate_research_request(request, x_requested_with)
	# Withdrawal still works when new collection is switched off.
	if research_corpus is None:
		raise HTTPException(503, "Withdrawal is temporarily unavailable")
	try:
		deleted = await run_in_threadpool(research_corpus.revoke, x_allim_contribution)
	except ValueError as error:
		raise HTTPException(422, "Valid contribution key required") from error
	return {"withdrawn": True, "deleted_clips": deleted}


@app.get("/api/quran-asr/health")
async def health():
	return {"ready": _pipeline is not None}


@app.get("/api/mushaf/chapters")
async def mushaf_chapters():
	url = f"{QURAN_CONTENT_API}/chapters?language=en"
	data = await run_in_threadpool(_cached_quran_json, "chapters.json", url)
	chapters = data.get("chapters")
	if not isinstance(chapters, list) or len(chapters) != 114:
		raise HTTPException(status_code=502, detail="Quran chapter data is unavailable")
	return JSONResponse({"chapters": chapters, "source": "Quran Foundation Content API"})


@app.get("/api/mushaf/page/{page_number}")
async def mushaf_page(page_number: int, mushaf: int = 1):
	if page_number < 1 or page_number > 604:
		raise HTTPException(status_code=404, detail="Mushaf page must be between 1 and 604")
	if mushaf not in {1, 2}:
		raise HTTPException(status_code=422, detail="Supported Mushaf values are 1 and 2")
	url = (
		f"{QURAN_CONTENT_API}/verses/by_page/{page_number}"
		"?words=true&word_fields=code_v1,code_v2,text_qpc_hafs,line_number,page_number"
		f"&per_page=all&mushaf={mushaf}"
	)
	data = await run_in_threadpool(_cached_quran_json, f"page-fonts-m{mushaf}-{page_number:03d}.json", url)
	verses = data.get("verses")
	if not isinstance(verses, list):
		raise HTTPException(status_code=502, detail="Mushaf page data is unavailable")
	return JSONResponse(
		{"page": page_number, "mushaf": mushaf, "verses": verses, "source": "Quran Foundation Content API"}
	)


@app.get("/api/mushaf/locate/{surah_number}/{ayah_number}")
async def locate_mushaf_verse(surah_number: int, ayah_number: int):
	if surah_number < 1 or surah_number > 114 or ayah_number < 1 or ayah_number > 286:
		raise HTTPException(status_code=404, detail="Invalid verse")
	verse_key = f"{surah_number}:{ayah_number}"
	url = f"{QURAN_CONTENT_API}/verses/by_key/{verse_key}?fields=page_number"
	data = await run_in_threadpool(
		_cached_quran_json, f"verse-{surah_number:03d}-{ayah_number:03d}.json", url
	)
	verse = data.get("verse") if isinstance(data, dict) else None
	page_number = verse.get("page_number") if isinstance(verse, dict) else None
	if not isinstance(page_number, int) or page_number < 1 or page_number > 604:
		raise HTTPException(status_code=502, detail="Mushaf page location is unavailable")
	return JSONResponse({"verse_key": verse_key, "page": page_number})


@app.get("/api/quran/words/{surah_number}/{ayah_number}")
async def quran_words(surah_number: int, ayah_number: int):
	if surah_number < 1 or surah_number > 114 or ayah_number < 1 or ayah_number > 286:
		raise HTTPException(status_code=404, detail="Invalid verse")
	verse_key = f"{surah_number}:{ayah_number}"
	url = (
		f"{QURAN_CONTENT_API}/verses/by_key/{surah_number}%3A{ayah_number}"
		"?language=en&words=true&word_fields=text_uthmani,text_qpc_hafs"
	)
	data = await run_in_threadpool(
		_cached_quran_json,
		f"words-{surah_number:03d}-{ayah_number:03d}.json",
		url,
	)
	verse = data.get("verse") if isinstance(data, dict) else None
	source_words = verse.get("words") if isinstance(verse, dict) else None
	if not isinstance(source_words, list):
		raise HTTPException(status_code=502, detail="Quran word data is unavailable")
	reviewed_ru = REVIEWED_RUSSIAN_GLOSSES.get(verse_key, [])
	words: list[dict[str, Any]] = []
	for source_word in source_words:
		if not isinstance(source_word, dict) or source_word.get("char_type_name") == "end":
			continue
		translation = source_word.get("translation")
		transliteration = source_word.get("transliteration")
		position = len(words) + 1
		gloss_ru = reviewed_ru[position - 1] if position <= len(reviewed_ru) else ""
		words.append(
			{
				"position": position,
				"arabic": _plain_text(
					source_word.get("text_uthmani")
					or source_word.get("text_qpc_hafs")
					or source_word.get("text")
				),
				"transliteration": _plain_text(
					transliteration.get("text") if isinstance(transliteration, dict) else ""
				),
				"gloss_en": _plain_text(translation.get("text") if isinstance(translation, dict) else ""),
				"gloss_ru": gloss_ru,
				"gloss_ar": "",
				"reviewed_ru": bool(gloss_ru),
			}
		)
	if not words:
		raise HTTPException(status_code=502, detail="Quran word data is unavailable")
	return JSONResponse(
		{
			"verse_key": verse_key,
			"words": words,
			"coverage": {
				"english": sum(1 for word in words if word["gloss_en"]),
				"russian_reviewed": sum(1 for word in words if word["gloss_ru"]),
				"total": len(words),
			},
			"source": "Quran Foundation Content API",
			"russian_layer": "ALLIM reviewed literal gloss",
		}
	)


@app.get("/api/quran/translation/{surah_number}/{ayah_number}")
async def quran_translation(
	surah_number: int,
	ayah_number: int,
	resource_id: int = RUSSIAN_TRANSLATION_ID,
):
	if surah_number < 1 or surah_number > 114 or ayah_number < 1 or ayah_number > 286:
		raise HTTPException(status_code=404, detail="Invalid verse")
	edition = RUSSIAN_TRANSLATION_EDITIONS.get(resource_id)
	if not edition:
		raise HTTPException(status_code=422, detail="Unsupported Russian translation")
	verse_key = f"{surah_number}:{ayah_number}"
	url = (
		f"{QURAN_CONTENT_API}/verses/by_key/{surah_number}%3A{ayah_number}"
		f"?language=ru&translations={resource_id}"
	)
	data = await run_in_threadpool(
		_cached_quran_json,
		f"translation-ru-{resource_id}-{surah_number:03d}-{ayah_number:03d}.json",
		url,
		QURAN_TRANSLATION_CACHE_SECONDS,
	)
	verse = data.get("verse") if isinstance(data, dict) else None
	translations = verse.get("translations") if isinstance(verse, dict) else None
	translation = translations[0] if isinstance(translations, list) and translations else None
	text = _plain_text(translation.get("text")) if isinstance(translation, dict) else ""
	if not text:
		raise HTTPException(status_code=502, detail="Russian translation is unavailable")
	return JSONResponse(
		{
			"verse_key": verse_key,
			"language": "ru",
			"text": text,
			"resource_id": resource_id,
			"edition": edition["name"],
			"author": edition["author"],
			"source": "Quran Foundation",
			"attribution": "Quran data provided by Quran Foundation.",
		}
	)


@app.post("/api/quran-asr")
async def transcribe(
	request: Request,
	audio: UploadFile = File(...),
	verse_key: str = Form(...),
	x_requested_with: str | None = Header(default=None),
	x_allim_contribution: str | None = Header(default=None),
	research_session: str = Form(default=""),
	research_language: str = Form(default=""),
	research_mode: str = Form(default=""),
):
	_validate_request(request, x_requested_with)
	if not VERSE_KEY_RE.fullmatch(verse_key):
		raise HTTPException(status_code=422, detail="Invalid verse key")
	content_type = (audio.content_type or "").lower()
	if not content_type.startswith("audio/"):
		raise HTTPException(status_code=415, detail="Audio file required")

	total = 0
	temporary_path: str | None = None
	try:
		with tempfile.NamedTemporaryFile(delete=False, suffix=_suffix_for(content_type)) as temporary:
			temporary_path = temporary.name
			while True:
				chunk = await audio.read(1024 * 1024)
				if not chunk:
					break
				total += len(chunk)
				if total > MAX_AUDIO_BYTES:
					raise HTTPException(status_code=413, detail="Audio clip is too large")
				temporary.write(chunk)
		if total == 0:
			raise HTTPException(status_code=422, detail="Audio clip is empty")
		started = time.monotonic()
		result = await run_in_threadpool(_transcribe, temporary_path)
		if RESEARCH_ENABLED and research_corpus and x_allim_contribution:
			try:
				await run_in_threadpool(
					research_corpus.capture,
					x_allim_contribution,
					research_session,
					temporary_path,
					verse_key,
					result,
					MODEL_ID,
					time.monotonic() - started,
					research_language,
					research_mode,
					getattr(getattr(getattr(_pipeline, "model", None), "config", None), "_commit_hash", None),
				)
			except Exception:
				# Corpus failures must not fail reading, expose a transcript or log the key.
				logger.warning("Research sample was not saved")
		return {**result, "verse_key": verse_key}
	finally:
		await audio.close()
		if temporary_path:
			try:
				Path(temporary_path).unlink(missing_ok=True)
			except OSError:
				pass


@app.get("/{asset_path:path}", include_in_schema=False)
async def static_asset(asset_path: str):
	requested = asset_path or "index.html"
	if requested not in PUBLIC_FILES:
		raise HTTPException(status_code=404, detail="Not found")
	return FileResponse(APP_ROOT / requested)
