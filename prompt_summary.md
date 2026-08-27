# Master Prompt: Recreate BookLibrary

Act as a senior frontend engineer. Recreate the complete **BookLibrary** audiobook dashboard and JSON Builder described below. Build a working static browser application, not a mockup.

## Core Constraints

- Use plain HTML, CSS, and modern browser JavaScript.
- Do not use a framework, bundler, backend, database, package installation, or server-side file access.
- The application must work from local files where browser security permits it.
- Use Tailwind CSS from its CDN, Lucide Icons from its CDN, and `jsmediatags` from its CDN.
- Keep logic in separate JavaScript files rather than inline script blocks.
- Use a dark cinematic visual style: `#0b0f19` background, slate panels, amber `#f59e0b` accent, high-contrast text, and restrained cyan/emerald/red/category accents.
- Make the layout responsive on mobile, tablet, and desktop.
- Escape imported values and validate all user-controlled URLs. Never trust `library.json` or metadata files.

## Required Files

Create this structure:

```text
index.html
library.json
generator.html
prompt_summary.md
README.md
js/
  main.js
  state.js
  ui.js
  utils.js
  generator.js
backgroundImage/
bookFiles/
```

The dashboard loads `state.js`, `utils.js`, `ui.js`, then `main.js`. The JSON Builder loads `generator.js` after its markup and loads `jsmediatags`.

## Dashboard: `index.html`

Create an audiobook library named **Audiobook Library** with a sticky header containing a headphones brand icon, title, year badge, subtitle, link to `generator.html`, dynamic total runtime, and catalog size.

Implement loading, success, and clean failure states while fetching `library.json`. If the file is missing, invalid, or blocked by browser file security, show a useful error and do not show upload controls on the dashboard.

Calculate and display:

- Total audiobook count.
- Total runtime from `length` values in minutes, shown as days, hours, and minutes.
- Total hours rounded for display.
- Completed/listened count from persisted playback state.
- Longest title and approximate duration.

Provide these controls:

- Debounced search, approximately 150 ms.
- Search through title, subtitle, authors, narrators, series, and publisher.
- Dynamic category and narrator filters.
- Closeable active-filter badges and a clear-all control.
- Sort options for rating high/low, duration long/short, title A-Z/Z-A, author, narrator, playback progress, and publication date.
- Grid/list layout toggle.
- Series grouping toggle.

### Grid Cards

Cards must have a stable compact layout with a minimum height near `195px`, a cover region near `120px`, and room to grow when category pills wrap. Use a category gradient when no cover exists. When a cover exists, use centered, non-distorted `cover` behavior with no repeat.

Lazy-load cover backgrounds with `IntersectionObserver` when available. Display readable overlays, category pills, series and volume badges, title, author, duration, rating, completion state, and playback progress. Show each title and author once. Clicking a card opens the details modal.

### List View

Render a responsive table with title/series, author, playback progress, length, rating, and an action/details control. Every data column except Action is sortable by clicking its header. Clicking the active header toggles direction, and header arrows stay synchronized with the sort dropdown.

### Details Modal

Open a centered modal from a card or list row. Include cover or category gradient, series and volume, title, subtitle, category pills, author, narrator, publisher, publication date, duration, all three ratings, sanitized publisher description, close behavior, play, mark-listened, and download controls when `bookFile` exists.

Use `textContent` for ordinary fields. Publisher descriptions may contain basic HTML, but sanitize them through an allowlist. Permit only basic formatting/list tags such as `p`, `b`, `strong`, `i`, `em`, `br`, `ul`, `ol`, and `li`, plus safe `http`/`https` links. Remove scripts, styles, event handlers, unsafe URLs, and unsupported elements.

### Audio Player

Use one persistent floating HTML5 `<audio>` element. Provide play/pause, rewind 30 seconds, skip forward 30 seconds, close, current time, duration, progress updates, click/drag/touch scrubbing, and clear playback errors.

Persist playback progress as a rounded percentage and automatically mark a book listened at 100 percent. Stop and hide the player when closed. Resolve audio paths as follows:

- Preserve `http://`, `https://`, and `./` URLs.
- Preserve paths beginning with `bookFiles/`.
- Prefix other local paths with `bookFiles/`.
- Reject unsafe protocols and arbitrary URLs.

## JavaScript Responsibilities

### `state.js`

Create a global namespace such as `window.AudiobookApp` containing:

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

Persist listened IDs and progress in `localStorage` under stable keys. Handle malformed storage safely. Generate stable IDs from ASIN, ID, or a sanitized title-author fallback.

### `utils.js`

Provide stable IDs, debounce, filtering, sorting, category style/icon mappings, duration formatting, filter reset, and numeric series-order parsing. Support series orders such as `1`, `2`, `1.5`, and `1-3`. Tolerate missing, null, malformed, and non-string optional metadata.

### `ui.js`

Implement statistics, filter badges, grid/list rendering, series grouping, cards, rows, sort indicators, modal behavior, lazy covers, sanitized descriptions, and safe metadata/image rendering. Accept only local image paths or `http`/`https` image URLs.

### `main.js`

Implement initialization, event binding, fetching `library.json`, loading/error transitions, dynamic filter population, search, sorting, filtering, grouping, layout switching, progressive rendering with an `IntersectionObserver` sentinel, audio controls, scrubbing, and persistence updates.

## `library.json` Contract

Use an array of records with this shape:

```json
{
  "title": "Book title",
  "subtitle": "Optional subtitle",
  "authors": "Author Name",
  "narrators": "Narrator Name",
  "length": 600,
  "description": "<p>Publisher description</p>",
  "publisher": "Publisher Name",
  "series": "Series Name",
  "seriesOrder": "1",
  "ratingOverall": 4.5,
  "ratingPerformance": 4.6,
  "ratingStory": 4.4,
  "datePublished": "2024-01-01",
  "categories": "Adventure; Science Fiction",
  "bookFile": "Series Name/Book.mp3",
  "asin": "B000000000",
  "backgroundImage": "Series Name/Book.jpg"
}
```

`length` is always minutes. Ratings are numeric values from 0 to 5. `asin` and `backgroundImage` are optional.

## JSON Builder: `generator.html`

Create a local-only page named **Library JSON Builder** with a link back to the dashboard, folder selection, drag/drop, status messaging, a results table, metadata summary, record count, and formatted `library.json` download.

The builder must recursively discover MP3, JSON, and image files through all nested folders. Support `webkitdirectory` as a fallback and use the native File System Access directory picker when available. Also recursively traverse dropped directory entries. Preserve selected-folder-relative paths for every file so nested sidecars and covers match correctly. If Firefox does not provide folder-relative paths through its picker, explain the limitation and support folder drag/drop or individual-file selection.

Read MP3 ID3 tags with `jsmediatags` and measure duration with an HTML5 audio element. Use:

- Title tag, or filename without `.mp3`.
- Album artist, or artist, as author.
- Narrator tag, with a reasonable fallback.
- Album as a series fallback only when it is a real series value.
- Track as series-order fallback.
- Genre as category fallback.
- Rounded audio duration in minutes.
- Folder-relative MP3 path as `bookFile`.

Continue processing when one file has missing tags, invalid duration, or another recoverable error.

### Metadata Matching

Read JSON files found anywhere under the selected folder. Support:

1. `Book Name.json` beside `Book Name.mp3`.
2. `Book Name.metadata.json` beside `Book Name.mp3`.
3. A direct metadata object in an audiobook folder containing one MP3.
4. An array of records.
5. An object shaped as `{ "books": [] }`.

Prefer an exact same-directory basename sidecar. For collections, match only exact normalized relative paths or exact unambiguous filename/title matches. Do not use loose suffix matching. Do not choose an arbitrary record when duplicates are ambiguous. Missing JSON fields preserve MP3-derived values. Invalid JSON is reported without stopping valid records.

### Audible Metadata

Support Audible metadata objects containing fields such as:

- Top-level `asin`, `title`, `authors`, `narrators`.
- `publisher_name`, `publisher_summary`, `merchandising_summary`.
- `runtime_length_min`, `issue_date`, `release_date`, `publication_datetime`.
- `category_ladders` and `product_images`.
- Rating distributions under `rating.overall_distribution`, `performance_distribution`, and `story_distribution`.

Map author and narrator object `.name` values into comma-separated strings; map publisher and description fields; map dates; map rating averages; and use the last category name from each ladder, joined with semicolons. Keep `runtime_length_min` as minutes without dividing by 60.

Use only the matched audiobook metadata object's top-level ASIN. Never extract ASINs from reviews, relationships, chapters, content references, or related products.

Normalize series safely. Accept meaningful strings and objects with fields such as `name`, `seriesName`, `title`, or `series`; accept arrays by joining meaningful names. Accept explicit `series_name` and `series_sequence` fields. Ignore media-description album values beginning with URLs or containing Audible markers such as `|adbl|`; these are not series names.

### Local Covers

Recognize `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.avif`, and `.svg`. Within the same audiobook folder prefer:

1. Same basename as the MP3.
2. `cover`, `coverart`, `front`, `folder`, or `jacket`.
3. The only image in the folder.

Local covers always override remote Audible cover URLs. Export relative paths, never Blob URLs. Strip the selected root consistently.

## Robustness and Security

- Escape all imported values before HTML interpolation.
- Prefer `textContent` and DOM construction.
- Sanitize allowlisted publisher HTML.
- Validate audio and image protocols.
- Handle empty libraries, malformed JSON, missing tags, duplicate titles, duplicate ASINs, missing files, invalid durations, and missing optional fields.
- One bad file must not stop the export.
- Revoke object URLs after use.
- Repeated selections replace prior results cleanly.
- Keep large-library processing responsive and predictable.

## Acceptance Checks

Before finishing, verify:

1. The dashboard loads valid `library.json` data and shows a useful failure state when it cannot.
2. Search, filters, sort dropdowns, sortable headers, grouping, badges, and layout toggles work.
3. Cards grow when category pills wrap and covers use centered `cover` behavior.
4. Modal metadata and sanitized descriptions render correctly.
5. Audio playback, pause, seek, rewind, skip, progress persistence, and listened state work.
6. The builder recursively processes nested MP3, JSON, and image files.
7. Nested sidecars and covers match the correct audiobook.
8. Audible metadata produces correct title, authors, narrators, publisher, ratings, ASIN, description, categories, and runtime in minutes. For a 2564-minute Cryptonomicon example, output approximately `2564`, not `43`.
9. A Project Hail Mary Audible file with no series metadata does not receive a media URL/`|adbl|` description as its series.
10. Local cover art overrides a remote Audible image.
11. Invalid JSON is reported without preventing valid records from exporting.
12. Malicious metadata cannot inject markup or scripts.
13. Run JavaScript syntax checks, editor diagnostics, and `git diff --check` before finishing.

Implement the complete working application and document how to use both pages. Do not stop at a design mockup or a partial scaffold.
