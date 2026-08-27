# Master Prompt: Recreate BookLibrary

Act as a senior frontend engineer. Recreate the complete BookLibrary application described below as a static, browser-only HTML5 application. The result must be usable from a local folder and must not require a backend, build system, package installation, or server-side file access.

## Deliverables

Create this structure:

```text
index.html
library.json
generator.html
js/
  main.js
  state.js
  ui.js
  utils.js
  generator.js
backgroundImage/
bookFiles/
README.md
```

Use separate files exactly as shown. Keep application logic out of the HTML except for CDN configuration and page markup. Load scripts in dependency order:

```html
<script src="js/state.js"></script>
<script src="js/utils.js"></script>
<script src="js/ui.js"></script>
<script src="js/main.js"></script>
```

The generator page loads `js/generator.js` after its markup and must also load the `jsmediatags` browser library.

## Technology and Visual Direction

- Use plain HTML, CSS, and modern browser JavaScript.
- Use Tailwind CSS through its CDN and Lucide Icons through its CDN.
- Use `jsmediatags` through its CDN for MP3 ID3 metadata.
- Use a dark cinematic audiobook-library aesthetic.
- Base background: `#0b0f19`.
- Use slate-900/slate-950 panels and borders.
- Use amber `#f59e0b` as the primary brand accent.
- Use high-contrast white and slate text.
- Use a restrained mixture of amber, cyan, emerald, red, purple, and slate category treatments.
- Use a custom inline SVG favicon showing white headphones on an amber rounded square.
- Use responsive layouts for mobile, tablet, and desktop.
- Do not introduce a framework, bundler, backend, or database.
- Avoid unsafe HTML interpolation. All imported or user-controlled values must be escaped before entering HTML attributes or markup.

## Main Dashboard: index.html

Build an audiobook dashboard called "Audiobook Library" with:

- A sticky header containing:
  - Headphones brand icon.
  - Title and a small year badge.
  - Subtitle such as "Interactive Audio Collection Explorer".
  - Link to `generator.html` labeled "Build Library JSON".
  - Dynamic total runtime.
  - Dynamic catalog size.
- A loading state while `library.json` is fetched.
- A clean error state when `library.json` is missing, invalid, or cannot be fetched. Do not show upload controls on the main dashboard.
- A dashboard area hidden until data loads successfully.

### Dashboard statistics

Calculate from the loaded records:

- Total audiobook count.
- Total runtime from `length`, where length is minutes. Display days, hours, and minutes.
- Total hours, rounded for display.
- Completed count based on persisted playback state.
- Longest audiobook title and approximate hours.

### Controls

Provide:

- Debounced search input, approximately 150 ms.
- Search across title, subtitle, authors, narrators, series, and publisher.
- Sort dropdown with:
  - Highest rating.
  - Lowest rating.
  - Longest duration.
  - Shortest duration.
  - Title A-Z and Z-A.
  - Author A-Z and Z-A.
  - Narrator A-Z and Z-A.
  - Playback progress.
  - Publication date.
- Dynamic category filter populated from semicolon-delimited `categories` values.
- Dynamic narrator filter populated from comma-delimited `narrators` values.
- Closeable active-filter badges for search, category, and narrator filters.
- Clear-all-filters control.
- Series grouping toggle.
- Grid/list view toggle.

### Series grouping

When grouping is enabled:

- Group records with a non-empty `series` value.
- Sort books within each series by the numeric portion of `seriesOrder`.
- Support values such as `1`, `2`, `1.5`, and `1-3`.
- Render standalone titles in a separate section after series groups.
- Preserve the active sort/filter behavior as much as possible.

### Compact grid cards

Each card must:

- Have a minimum height near `195px` and be allowed to grow if category pills wrap.
- Have a top cover region with a minimum height near `120px` and automatic height.
- Render a category-themed gradient when there is no cover.
- Render `backgroundImage` when available.
- Use `background-size: cover`, `background-position: center`, and `background-repeat: no-repeat` so cover art fills its area without distortion.
- Lazy-load cover backgrounds with `IntersectionObserver` when available.
- Use a readable overlay over cover art.
- Render semicolon-delimited categories as separate translucent pills that wrap naturally.
- Show the full category in a native `title` tooltip.
- Render series name and volume as readable badges over the cover region.
- Show title and author exactly once in the lower card section.
- Show duration and overall rating in the lower card section.
- Show a completed indicator when the book is marked listened.
- Open the detail modal when clicked.
- Show playback progress when progress is greater than zero.

Do not place raw metadata into `innerHTML`. Escape text and attribute values, or create DOM nodes and assign `textContent`.

### Detailed list view

Render a responsive table with:

- Title and series.
- Author.
- Playback progress.
- Length.
- Rating.
- Action/details control.

All data columns except Action must be sortable by clicking their headers. Clicking the active header toggles direction. Header arrows must reflect the current sort and remain synchronized with the sort dropdown.

### Detail modal

Clicking a card or list row opens a centered modal overlay with:

- Cover image or category gradient.
- Cover image using centered `cover` sizing.
- Series and volume.
- Title and subtitle.
- Category pills.
- Author, narrator, publisher, and publication date.
- Duration.
- Overall, story, and performance ratings.
- Publisher description.
- Close button and click-outside-to-close behavior.
- Play, mark listened, and download controls when `bookFile` exists.

Use `textContent` for ordinary metadata fields. Publisher descriptions may contain basic HTML from Audible, so sanitize them through an allowlist before inserting them. Allow only basic tags such as `p`, `b`, `strong`, `i`, `em`, `br`, `ul`, `ol`, `li`, and safe `http`/`https` links. Remove scripts, styles, event attributes, unsafe URLs, and unsupported elements.

### Audio player

Implement a persistent floating player using one HTML5 `<audio>` element:

- Play/pause control.
- Current title and author.
- Rewind 30 seconds.
- Skip forward 30 seconds.
- Close player.
- Current time and duration.
- Click/drag scrubbing with mouse.
- Touch scrubbing on mobile.
- Progress bar updates during playback.
- Persist progress as a rounded percentage.
- Mark a book listened automatically at 100 percent.
- Show playback errors clearly when the file is missing.
- Stop/hide the player when closed.

Resolve audio paths as follows:

- Preserve absolute `http://`, `https://`, and `./` URLs.
- Preserve paths already beginning with `bookFiles/`.
- Prefix other local paths with `bookFiles/`.
- Do not permit arbitrary unsafe URLs.

## JavaScript Modules

### state.js

Create a global namespace such as `window.AudiobookApp`. The state module must hold:

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

Persist listened IDs and progress in `localStorage` under stable keys. Handle malformed localStorage safely. Use a stable book ID based on ASIN, ID, or a sanitized title-author fallback.

### utils.js

Provide:

- Category-to-gradient/icon mapping.
- Stable `getBookId`.
- Category style lookup.
- Seconds-to-readable-time formatting.
- Debounce helper.
- Filter reset helper.
- Numeric series-order parsing.
- Filtering and sorting logic.

All access to optional metadata must tolerate missing, null, or non-string values.

### ui.js

Implement:

- IntersectionObserver cover lazy loading.
- Statistics updates.
- Filter badge creation.
- Grid and list rendering.
- Series grouping rendering.
- Compact card creation.
- List-row creation.
- Sort indicators.
- Modal opening and closing.
- Sanitized description rendering.
- Safe metadata/image escaping.

Do not trust `library.json`; it is external input. Validate image sources before placing them in CSS. Accept local paths and `http`/`https` URLs only.

### main.js

Implement:

- Initialization.
- Event binding.
- Search, sorting, filtering, layout, and grouping controls.
- Progressive rendering with an IntersectionObserver sentinel.
- Audio player controls and scrubbing.
- Fetching `library.json`.
- Loading, success, and failure state transitions.
- Dynamic selector population.

## library.json data schema

Use an array of records. A normal record should look like:

```json
{
  "bookId": [{ "asin": "B000000000" }, { "audiobookId": "" }, { "isbn": "" }],
    "title": "Book title",
    "subtitle": "Optional subtitle",
  "authors": ["Author Name"],
  "narrators": ["Narrator Name"],
  "durationSeconds": 36000,
  "durationText": "10h 0m 0s",
    "description": "<p>Publisher description</p>",
    "publisher": "Publisher Name",
    "series": "Series Name",
    "seriesOrder": "1",
    "ratingOverall": 4.5,
    "ratingPerformance": 4.6,
    "ratingStory": 4.4,
    "datePublished": "2024-01-01",
    "categories": ["Adventure", "Science Fiction"],
    "bookFile": "Series Name/Book.mp3",
    "backgroundImage": "Series Name/Book.jpg"
}
```

  `authors`, `narrators`, and `categories` are arrays. `durationSeconds` is canonical and `durationText` is its readable representation. `bookId` is an array of identifier objects containing `asin`, `audiobookId`, and `isbn`; individual values may be empty. Ratings may be `null`, and `backgroundImage` or `bookFile` may be empty. The dashboard may normalize these values into internal display fields such as comma-separated people, semicolon-separated categories, and rounded minute values.

## Generator page: generator.html

Create a second page called "Library JSON Builder" with:

- Link back to `index.html`.
- Folder picker using `webkitdirectory`, `directory`, and `multiple`.
- Native File System Access directory picker when available, with recursive directory-handle traversal.
- Drag-and-drop support for selected files.
- Local-only messaging: files are read in the browser and never uploaded.
- Selection of all MP3, JSON, and local image files recursively through every nested folder.
- Preservation of selected-folder-relative paths for matching and export.
- Firefox fallback messaging when a directory picker does not provide relative paths; support folder drag-and-drop or individual-file selection.
- Results table showing title, author, series, duration, and metadata status.
- Count of generated records.
- Count of records enriched from JSON.
- Count of invalid JSON files.
- Download button producing a formatted `library.json`.

### MP3 extraction

For each MP3:

- Read ID3 tags with `jsmediatags`.
- Use title tag or filename without `.mp3` as title.
- Use album artist or artist as author.
- Use narrator tag or a reasonable fallback.
- Use album as series fallback only when it is a meaningful series value; ignore media URLs and Audible marker strings such as `|adbl|`.
- Use track as series order fallback.
- Use genre as category fallback.
- Measure duration with an `<audio>` element, retain exact `durationSeconds`, and derive rounded minutes only for internal display.
- Preserve the selected-folder-relative MP3 path as `bookFile`.
- Continue when tags or duration cannot be read, using safe defaults.

### JSON sidecar matching

Read JSON files from the selected folder automatically. Support:

1. `Book Name.json` beside `Book Name.mp3`.
2. Audible `Book Name.metadata.json` beside `Book Name.mp3`.
3. A direct metadata object in a folder containing one audiobook.
4. An array of records.
5. An object shaped like `{ "books": [] }`.

Match collection records by exact normalized relative path or exact unambiguous filename/title. Never use a loose suffix match that can confuse `Book.mp3` with `LongBook.mp3`. Reject ambiguous duplicate title matches rather than selecting an arbitrary record. Exact sidecars take priority.

Missing fields in JSON must preserve MP3-derived values. Invalid JSON must be reported without stopping the whole generation.

Export the current schema with structured `bookId`, people/category arrays, `durationSeconds`, `durationText`, and optional empty file/image fields.

### Audible metadata mapping

Support Audible `.metadata.json` objects such as:

```json
{
    "asin": "B086WMZ9WR",
    "title": "Cryptonomicon",
    "authors": [{ "name": "Neal Stephenson" }],
    "narrators": [{ "name": "William Dufris" }],
    "publisher_name": "Audible Studios",
    "publisher_summary": "<p>Description</p>",
    "runtime_length_min": 2564,
    "issue_date": "2020-08-08",
    "category_ladders": [],
    "product_images": { "500": "https://example/image.jpg" },
    "rating": {
        "overall_distribution": { "average_rating": 4.4 },
        "performance_distribution": { "average_rating": 4.6 },
        "story_distribution": { "average_rating": 4.4 }
    }
}
```

Map:

- `asin` to the audiobook record's own ASIN only.
- `authors[].name` to comma-separated `authors`.
- `narrators[].name` to comma-separated `narrators`.
- `publisher_name` to `publisher`.
- `publisher_summary` or `merchandising_summary` to `description`.
- `runtime_length_min` directly to `length` in minutes. Do not divide it by 60.
- `issue_date`, `release_date`, or `publication_datetime` to `datePublished`.
- The three rating distribution averages to the three rating fields.
- The last category in each category ladder to semicolon-separated `categories`.
- The preferred Audible product image to `backgroundImage` only when no local image is available.

Never search nested reviews, relationships, chapters, content references, or related products for an ASIN. Only use the top-level ASIN belonging to the matched audiobook metadata object.

Do not treat Audible media-description album values, URLs, or `|adbl|` markers as a series name. Explicit series fields take precedence over an MP3 album fallback.

### Local image priority

Local images must take priority over remote Audible images. Recognize at least:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`
- `.gif`
- `.avif`
- `.svg`

Within the audiobook's folder, prefer:

1. An image with the same basename as the MP3.
2. `cover`, `coverart`, `front`, `folder`, or `jacket`.
3. The only image in that folder.

Export a relative local path, never a temporary Blob URL. Strip the selected directory root consistently so generated paths work when copied into the project. Use the remote Audible URL only if no local image matches.

## Security and robustness requirements

- Escape all imported data before HTML interpolation.
- Use `textContent` wherever possible.
- Sanitize allowed publisher HTML.
- Validate image and audio URLs.
- Do not execute HTML, script, or event-handler attributes from metadata.
- Handle malformed JSON, missing tags, missing files, invalid durations, empty libraries, duplicate titles, duplicate ASINs, and missing optional fields.
- Do not let one bad MP3 or JSON file prevent other records from exporting.
- Avoid memory leaks from object URLs; revoke them after media metadata is read and after downloads when appropriate.
- Ensure repeated folder selections replace previous results cleanly.
- Keep the UI responsive for large collections. Process files predictably and use progressive rendering on the dashboard.

## Acceptance checks

Before finishing, verify:

1. Opening `index.html` loads `library.json` and renders the dashboard.
2. Missing `library.json` shows the error state without uncaught errors.
3. Grid/list toggles work.
4. Search, filters, sort dropdowns, header sorting, grouping, and badges work.
5. Cards expand when category pills wrap.
6. Cover images fill their assigned cover areas with centered `cover` behavior.
7. Modal metadata and sanitized descriptions render correctly.
8. A local MP3 can play, pause, seek, rewind, skip, and persist progress.
9. `generator.html` can recursively process MP3, JSON, and image files.
10. The supplied Audible metadata produces the correct author, narrator, publisher, ratings, ASIN, description, categories, and approximately `2564` minutes internally.
11. `Book.metadata.json` matches `Book.mp3`.
12. Local cover art overrides a remote Audible cover URL.
13. Invalid JSON is reported but does not stop valid records.
14. Malicious metadata is displayed as text and cannot inject markup or scripts.
15. The dashboard loads the current array-based schema without a normalization error.
16. Run JavaScript syntax checks and editor/linter diagnostics on every JS and HTML file.
17. Run a whitespace or patch-integrity check before finishing.

Do not stop at a design mockup. Implement the complete working application and all listed behavior.
