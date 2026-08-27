# Master Prompt: Recreate Audiobook Library Dashboard

Act as a Principal Frontend Software Architect. Recreate the complete **Audiobook Library Dashboard** described below as a modular, high-performance, browser-only static application. Build the working application, not a design mockup.

## Core Requirements

- Use plain HTML, CSS, and modern browser JavaScript.
- Do not use a framework, bundler, Node.js, build step, backend, database, or server-side file access.
- The application must run from a local project folder. Document browser restrictions around `file://` access and provide a simple local-server alternative only as a usage note.
- Use Tailwind CSS CDN, Lucide Icons CDN, `jsmediatags` CDN, and Google Fonts.
- Share modules through `window.AudiobookApp = window.AudiobookApp || {};`; do not use ES module imports or exports.
- Use a dark cinematic audiobook visual language with `#0b0f19`, slate surfaces, amber `#f59e0b`, high-contrast text, and restrained category colors.
- Make the interface responsive on mobile, tablet, and desktop.
- Treat all JSON, metadata, filenames, image values, and descriptions as untrusted input.

## Deliverables and Directory Structure

Create:

```text
index.html
library.json
generator.html
README.md
js/
  state.js
  utils.js
  ui.js
  main.js
  generator.js
bookAssets/
  <author name>/
    <series name>/
      <book title>/
        audio files
        cover files
        metadata JSON
    <book title>/
      audio files
      cover files
      metadata JSON
```

`bookAssets` is the single asset root for audiobook files and local cover art. Series books use `bookAssets/<author>/<series>/<title>/`; standalone books use `bookAssets/<author>/<title>/`. Keep the asset resolver flexible enough to handle arbitrary nested source folders selected by the JSON Builder.

Load dashboard scripts in this exact order:

```html
<script src="js/state.js"></script>
<script src="js/utils.js"></script>
<script src="js/ui.js"></script>
<script src="js/main.js"></script>
```

Load `js/generator.js` after the JSON Builder markup and load `jsmediatags` before it.

## Library JSON Schema

`library.json` is an array. Only `title` and `authors` are required. All other fields are optional and must tolerate missing, empty, or `null` values.

```json
[
  {
    "bookId": [
      { "asin": "B000000000" },
      { "audiobookId": "" },
      { "isbn": "" }
    ],
    "title": "Flybot",
    "subtitle": "",
    "authors": ["Dennis E. Taylor"],
    "narrators": ["Ray Porter"],
    "durationSeconds": 34620,
    "durationText": "9h 37m 0s",
    "description": "<p>Publisher description</p>",
    "publisher": "Audible Originals",
    "series": "",
    "seriesOrder": "",
    "ratingOverall": 4.5,
    "ratingPerformance": 4.6,
    "ratingStory": 4.4,
    "datePublished": "2025-06-26",
    "categories": ["Adventure", "Science Fiction"],
    "backgroundImage": "cover.jpg",
    "bookFile": "Flybot.mp3",
    "_comment": "Audible Book"
  }
]
```

Schema rules:

- `authors`, `narrators`, and `categories` are arrays of strings. Missing optional arrays become `[]`.
- `bookId` is an array of identifier objects. Values may be empty. Use the first non-empty identifier for stable persistence IDs, then fall back to a sanitized title-author key.
- `durationSeconds` is canonical. `durationText` is an optional display value. The dashboard may derive rounded internal minutes for calculations and legacy rendering, but never interpret seconds as minutes.
- Ratings are numbers from 0 to 5 or `null`; display `--` when unavailable.
- `series` and `seriesOrder` are optional strings.
- `backgroundImage` may be an embedded Base64 data URL, a local filename/path, or an HTTP(S) URL.
- `bookFile` may be a local filename/path or an HTTP(S) URL.

## Asset and Image Resolution

Resolve `backgroundImage` in this strict order:

1. **Base64 image:** If it starts with `data:image/`, use it directly after validating that it is a supported image data URL. This is the preferred source.
2. **Local asset:** If it is a relative filename/path, resolve it below `bookAssets/<author>/<series-or-title>/<title>/` using the first author string and the appropriate series/standalone layout. Preserve already-rooted `bookAssets/` paths.
3. **Remote image:** If it starts with `http://` or `https://`, use it after URL validation.
4. **Fallback:** If empty or invalid, render the category gradient.

Accept common image formats including JPG, JPEG, PNG, WebP, GIF, AVIF, and SVG. Do not allow `javascript:`, `data:` values except validated `data:image/`, CSS injection characters, or unsafe protocols. Local image files discovered by the Builder take priority over remote metadata images. Use `background-size: cover`, centered positioning, and no repeat.

Resolve `bookFile` below `bookAssets` using the same author/series/title layout when it is a relative path. Preserve HTTP(S) URLs and already-rooted `bookAssets/` paths. Expose play/download controls only when a valid file value exists.

## Dashboard Features

Create `index.html` titled **Audiobook Library** with a sticky header containing a headphones icon, title, year badge, subtitle, link to `generator.html`, total runtime, and catalog size.

Implement loading, success, empty, and clear error states while loading `library.json`. Normalize the source schema once after loading:

- Arrays of people become display strings joined with commas.
- Categories become a semicolon-delimited internal display string.
- `durationSeconds` becomes rounded internal minutes for existing calculations.
- Preserve the original values where useful for display and export.

Provide dynamic statistics for count, total runtime in days/hours/minutes, rounded total hours, completed count, and longest title/duration.

Provide:

- Debounced search around 150 ms across title, subtitle, authors, narrators, series, and publisher.
- Dynamic category and narrator filters.
- Closeable active-filter badges and clear-all control.
- Sort options for rating, duration, title, author, narrator, playback progress, and publication date.
- Grid/list view toggle.
- Series grouping toggle.

### Grid Cards

Cards must have stable dimensions, a minimum height near 195px, and a cover region near 120px that grows when categories wrap. Show Base64/local/remote cover art or a category gradient, readable overlays, category pills, series/volume badges, title, author, duration, rating, completion state, and playback progress. Show title and author once. Use `IntersectionObserver` lazy loading with `data-lazy-cover` where appropriate. Clicking a card opens the detail modal.

### List View

Render a responsive table with title/series, author, progress, duration, rating, and details action. Data columns are sortable by clicking headers; active headers toggle direction and show arrows synchronized with the sort dropdown.

### Details Modal

Show cover art or gradient, series/volume, title, subtitle, categories, author, narrator, publisher, publication date, duration, all ratings, sanitized description, close behavior, play, mark-listened, and download actions.

Descriptions may contain limited formatting. Sanitize through an allowlist permitting basic tags such as `p`, `b`, `strong`, `i`, `em`, `br`, `ul`, `ol`, `li`, and safe HTTP(S) links. Remove scripts, styles, event attributes, unsupported elements, and unsafe links. Use `textContent` for ordinary values.

### Audio Player and Persistence

Use one floating HTML5 audio player with play/pause, rewind 30 seconds, skip forward 30 seconds, close, current time, duration, mouse/touch scrubbing, progress updates, and clear missing-file errors. Persist rounded playback percentages and listened IDs in `localStorage`. Mark a book listened at 100 percent. Use stable IDs from `bookId`, ASIN, or sanitized title-author fallback. Handle malformed storage safely.

## JavaScript Modules

### `state.js`

Maintain global state including:

```js
libraryData: []
currentPlayingBook: null
isPlaying: false
currentLayout: 'grid'
activeCategory: 'all'
activeNarrator: 'all'
searchQuery: ''
currentSort: 'rating_desc'
groupBySeries: false
renderedCount: 40
batchSize: 40
listenedSet: new Set()
playbackProgressMap: {}
```

### `utils.js`

Provide schema normalization, stable ID generation, category styles, duration formatting, debounce, filters, sorting, filter reset, and numeric series-order parsing. Handle strings, arrays, nulls, objects, and missing optional fields safely.

### `ui.js`

Provide statistics, filter badges, grid/list rendering, series grouping, lazy cover loading, cards, rows, sort indicators, modal behavior, sanitized descriptions, and safe image resolution. Dynamic Lucide updates must target dedicated containers rather than stale replaced `<i>` nodes.

### `main.js`

Provide initialization, library loading, normalization, selectors, search/filter/sort/layout/group events, progressive rendering with an `IntersectionObserver` sentinel, audio controls, scrubbing, and persistence synchronization.

## JSON Builder

Create `generator.html` as a local-only browser tool linked from the dashboard. It must:

- Select a directory using the native File System Access directory picker when available.
- Fall back to `webkitdirectory`, `directory`, and `multiple` input attributes.
- Recursively walk all nested directories.
- Recursively process dropped directory entries and support older `DataTransfer.files` fallback.
- Discover MP3 files, JSON metadata, and image files at every depth.
- Preserve selected-folder-relative paths.
- Explain Firefox limitations when folder selection does not expose relative paths; support folder drag/drop or individual-file selection.
- Read ID3 tags with `jsmediatags` and duration with an HTML5 audio element.
- Show processing status, results table, record count, enriched-record count, invalid-JSON count, and download button.
- Replace prior results on each new selection.
- Export the schema defined above as formatted `library.json`.

For each MP3:

- Use title tag or filename without `.mp3`.
- Use album artist or artist as the author array.
- Use narrator tag or an empty narrator array.
- Use album as a series fallback only when it is meaningful.
- Ignore album values beginning with URLs or containing Audible markers such as `|adbl|`.
- Use track as series-order fallback.
- Use genre as the category array fallback.
- Preserve exact duration seconds and derive `durationText`.
- Set a relative `bookFile` path below `bookAssets`.

### Metadata Matching

Support exact same-directory `Book.json` and `Book.metadata.json` sidecars, direct metadata objects for a single audiobook folder, arrays of records, and `{ "books": [] }` collections. Match by exact normalized relative path or exact unambiguous filename/title. Never use loose suffix matching. Reject ambiguous matches. Missing fields preserve MP3-derived values. Invalid JSON must be reported without stopping valid records.

### Audible Metadata

Support top-level Audible fields including `asin`, `title`, `authors`, `narrators`, `publisher_name`, `publisher_summary`, `merchandising_summary`, `runtime_length_min`, dates, category ladders, product images, and rating distributions.

Map author/narrator `.name` values to string arrays, publisher and description fields, dates, rating averages, and the last category name from each ladder. Keep `runtime_length_min` as minutes. Use only the matched audiobook object’s top-level ASIN; never search reviews, relationships, chapters, content references, or related products. Local covers override remote Audible covers.

## Robustness, Security, and Acceptance Checks

- Escape imported data before HTML interpolation and prefer DOM APIs/textContent.
- Validate image and audio URLs and allow only safe local paths, HTTP(S), or validated image data URLs.
- Handle missing fields, null ratings, empty libraries, malformed JSON, duplicate titles/IDs, missing files, invalid durations, and one bad file without aborting the whole process.
- Revoke Blob/object URLs after use.
- Keep large collections responsive with progressive rendering.
- Verify dashboard loading with the current array-based schema.
- Verify Base64 images render before local and remote images.
- Verify local `bookAssets` cover and audio paths resolve for both series and standalone layouts.
- Verify recursive Builder processing, exact sidecar matching, Firefox fallback messaging, and formatted schema export.
- Verify Audible metadata, including author/narrator arrays and minute-accurate runtime.
- Verify a Project Hail Mary album value containing a media URL/`|adbl|` is not treated as a series.
- Verify descriptions cannot inject scripts or event handlers.
- Run JavaScript syntax checks, editor diagnostics, and `git diff --check` before finishing.

Document usage, browser limitations, the schema, and the `bookAssets` directory convention in `README.md`.
