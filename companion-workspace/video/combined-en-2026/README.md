# ALLIM QURAN — Combined POV Film (English)

Vertical social film combining real moving footage with current ALLIM QURAN mobile-interface inserts.

## Deliverables

- `output/ALLIM-Quran-Combined-POV-EN-1080x1920.mp4` — delivery master
- `output/ALLIM-Quran-Combined-POV-EN-Web-720x1280.mp4` — smaller web review copy
- `output/ALLIM-Quran-Combined-POV-EN.vtt` — English captions
- `output/ALLIM-Quran-Combined-POV-EN-poster.jpg` — poster frame
- `output/ALLIM-Quran-Combined-POV-EN-contact-sheet.jpg` — visual QA sheet

The approved English narration is `en-GB-RyanNeural`, rate `-6%`, pitch `-3Hz`.

## Visual sources

The app inserts use the current English mobile interface captured from ALLIM QURAN: Today, Read, Hifz, and Tafsir. No simulated phone-screen tracking or replacement is used.

The end card uses the exact current production wordmark from `homepage/allim-header-logo.png` without recolouring or redrawing it.

Real-motion footage is licensed from Pexels and intentionally avoids identifiable faces and blank phone mockups:

- Islam 24, video 7401908: <https://www.pexels.com/video/a-person-flipping-the-pages-of-the-quran-7401908/>
- Gizem Gökce, video 36072619: <https://www.pexels.com/video/close-up-of-hands-holding-an-open-quran-36072619/>
- RDNE Stock project, video 7249519: <https://www.pexels.com/video/a-person-touching-a-quran-book-7249519/>

Pexels license: <https://www.pexels.com/license/>. The footage is used as general lifestyle imagery and does not imply an endorsement by any depicted person or creator.

## Build

Run:

```sh
/Users/rafael/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 build_combined_video.py
```

The build is deterministic apart from encoder-level metadata and requires the stock files under `assets/stock/` plus the approved narration and UI captures in the sibling `pov-en-2026` project.
