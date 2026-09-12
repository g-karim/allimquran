# ALLIM QURAN — First-Person English Film

Vertical 9:16 product film built from original first-person lifestyle plates and current public English ALLIM QURAN screens.

## Story

The viewer moves through one day: a quiet beginning, recitation, a structured 300-repetition path, source-linked tafsir, and a reflective close.

## Build

```bash
/Users/rafael/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 video/pov-en-2026/build_video.py
```

The narration uses the approved ALLIM English voice `en-GB-RyanNeural`, rate `-6%`, pitch `-3Hz`. The build intentionally has no fallback to a local system voice. A subtle room tone is used without music. The AI-generated lifestyle plates contain no rendered Qur'anic text; the product screens are direct captures from the current public English interface.

## Outputs

- `output/ALLIM-Quran-POV-EN-1080x1920.mp4` — master
- `output/ALLIM-Quran-POV-EN-Web-720x1280.mp4` — web/social delivery
- `output/ALLIM-Quran-POV-EN.vtt` — English captions
- `output/ALLIM-Quran-POV-EN-poster.jpg` — poster
- `output/ALLIM-Quran-POV-EN-contact-sheet.jpg` — visual QA contact sheet
