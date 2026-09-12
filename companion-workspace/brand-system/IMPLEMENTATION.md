# ALLIM QURAN — logo implementation

## Website favicon

Copy the files from `exports/` into the public asset directory and add:

```html
<link rel="icon" href="/assets/allim-favicon-hadith-v4.svg" type="image/svg+xml">
<link rel="icon" href="/assets/allim-favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/assets/allim-favicon-16.png" sizes="16x16" type="image/png">
<link rel="apple-touch-icon" href="/assets/allim-app-icon-180.png">
<link rel="manifest" href="/assets/site.webmanifest">
<meta name="theme-color" content="#061713">
```

## Usage

- Dark digital surfaces: `allim-hadith-embrace-symbol.svg` or `allim-primary-hadith-v4-dark.svg`.
- Light surfaces: `allim-hadith-embrace-symbol-light.svg` or `allim-primary-hadith-v4-light.svg`.
- Single-color print, engraving and embossing: `allim-hadith-embrace-symbol-mono.svg`.
- Favicon below 32 px: `allim-favicon-hadith-v4.svg`.
- App stores and home screen: PNG 1024, 512, 192 or 180 from `exports/`.

Do not rasterize the horizontal lockup when SVG is supported. Do not add glow to the print or light-surface versions.
