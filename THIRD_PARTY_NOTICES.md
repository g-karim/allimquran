# Third-party notices

The root MIT license applies to ALLIM application code, not automatically to
third-party content, recordings, brand marks or model weights.

- **Literata**: `allimquran/public/media/allim-literata-medium.woff2` is the
  existing site font. Copyright 2017 The Literata Project Authors.
  [SIL Open Font License 1.1](allimquran/public/media/Literata-OFL.txt), included
  from the [Google Fonts distribution](https://github.com/google/fonts/tree/main/ofl/literata).
- **ASR model**: the service uses
  [tarteel-ai/whisper-tiny-ar-quran](https://huggingface.co/tarteel-ai/whisper-tiny-ar-quran).
  Its model card declares Apache-2.0. Weights are downloaded separately and are
  not redistributed in this repository. ALLIM is independent of Tarteel AI.
- **Quran content and Mushaf glyphs**: the prototype uses Quran Foundation /
  [Quran.com](https://quran.com/) data and remotely served fonts. Upstream data
  caches and font collections are not committed. Preserve source attribution;
  check the provider's terms before redistributing datasets or font collections.
- **Recitation audio**: existing code links to [EveryAyah](https://everyayah.com/)
  and [MP3Quran](https://mp3quran.net/). Their recordings are not bundled or
  relicensed by ALLIM.
- **Explanations and translations**: the migrated prototype retains its existing
  inline source links, including Quranpedia references. This migration is not a
  provenance, translation-quality or scholarly review. Do not treat the MIT
  license as permission to reuse referenced books or translations independently.
- **ALLIM media**: project logos, demo videos, posters and subtitles were moved
  from the existing project's public files. Their inclusion preserves the
  prototype; it does not grant rights to unrelated third-party trademarks.

Frappe, LMS, FastAPI, Transformers, Torch and other dependencies retain their
respective licenses. Dependencies are installed separately, not vendored.
