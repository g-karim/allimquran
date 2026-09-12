# ALLIM QURAN — Universal Hero Film

An original, language-light website hero film built after studying the structure—not the footage—of the current Tarteel homepage film.

## Creative structure

1. Dawn: the daily habit begins quietly.
2. Product close-up: the real ALLIM recitation interface appears on the phone.
3. Recitation: the authentic Arabic reading screen fills the frame.
4. Evening: learning remains part of ordinary life.
5. Memorization: the 300-repetition pathway becomes visible.
6. Together: knowledge passes between generations.
7. Home: the wider learning journey appears.
8. Brand close: four principles — `Read. Understand. Remember. Live by it.` / `اقرأ. افهم. احفظ. اعمل به.` / `Читай. Понимай. Запоминай. Воплощай.`

The master carries a three-pass recitation of Surah Al-Ikhlas by Maher al-Muaiqly, with no music. The repetition is intentional and supports the memorization theme. Website autoplay must begin muted; sound should be enabled only after a clear user action.

## Build

The three UI plates and final card are rendered from `plates.html` at 1280×720 and saved in `assets/`. Then run:

```sh
python3 video/hero-film/build_hero_film.py
```

Outputs:

- `output/ALLIM-Quran-Hero-Film-Universal-1080p.mp4`
- `output/ALLIM-Quran-Hero-Film-Universal-Web-720p.mp4`
- `output/ALLIM-Quran-Hero-Film-Universal-poster.jpg`
- `output/ALLIM-Quran-Hero-Film-Universal-contact-sheet.jpg`

## Asset provenance

- Human scenes: generated specifically for this ALLIM film with the built-in ImageGen workflow.
- Product screens: captured from the local ALLIM interface. The phone close-up uses a dedicated 640×900 RTL plate so no Arabic line is cropped.
- Wordmark and palette: current website-facing ALLIM assets in this workspace.
- No Tarteel footage, posters, logos, or interface assets are included.

## Qur'an text and recitation

- Visible ayah: Surah Al-Ikhlas 112:1 — `قُلْ هُوَ اللَّهُ أَحَدٌ ۝١`.
- Text was checked against the King Fahd Glorious Qur'an Printing Complex's published Qur'anic material.
- Local review audio: Maher al-Muaiqly, Surah Al-Ikhlas, QUL/Tarteel resource 562.
- QUL states that licensing varies by resource. Treat this audio cut as a local review master until the reciter recording's public/commercial-use permission is confirmed. The King Fahd Complex separately publishes a catalog of recordings expressly made available for public use; prefer the matching file from that catalog for production release.
