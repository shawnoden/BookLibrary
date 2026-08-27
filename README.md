# BookLibrary

BookLibrary is a static, browser-only audiobook dashboard with a companion JSON Builder. It displays the catalog in grid or list form, supports search/filter/sort/group workflows, and includes persistent playback progress. No backend or database is required.

## Setup

1. Clone or download this repository.
2. Keep `index.html`, `generator.html`, `library.json`, the `js/` folder, and the `bookAssets/` folder together.
3. Place audiobook files and local cover art below `bookAssets/` using this layout:

	 ```text
	 bookAssets/
		 Author Name/
			 Series Name/
				 Book Title/
					 Book Title.mp3
					 Book Title.jpg
					 Book Title.metadata.json
			 Standalone Book/
				 Standalone Book.mp3
				 cover.jpg
	 ```

	 Series folders are optional for standalone books. The catalog may also reference a complete `bookAssets/...` path or a nested path relative to `bookAssets`.
4. Confirm `library.json` contains the records and asset paths for your collection.
5. Open `index.html` in a browser.

The CDN dependencies are loaded from the internet: Tailwind CSS, Lucide Icons, `jsmediatags`, and Google Fonts. The repository ignores `/bookAssets/` by default so a personal audiobook collection is not accidentally committed.

## Dashboard Usage

Open [index.html](index.html) to use the dashboard.

- Search by title, subtitle, author, narrator, series, or publisher.
- Filter by category or narrator.
- Sort by rating, duration, title, author, narrator, playback progress, or publication date.
- Switch between compact grid and detailed list views.
- Enable **Group Series** to arrange series chronologically and show standalone titles separately.
- Select a book to open its details modal.
- Use the player to play/pause, skip, rewind, and scrub through an audiobook.
- Playback percentage and completed status are saved in browser `localStorage`.
- Use the modal’s download action when a valid `bookFile` is available.

The dashboard reads `library.json` automatically. If the browser blocks local JSON requests under `file://`, use the local-server option below.

## JSON Builder

Open [generator.html](generator.html) to create a catalog from local media.

1. Select the `bookAssets` folder with **Choose folder**, or drag a folder onto the drop zone.
2. The Builder recursively discovers MP3 files, JSON metadata, and supported image files.
3. ID3 tags and audio duration are read locally in the browser. Files are not uploaded.
4. Review the generated records and metadata status.
5. Download the formatted `library.json` file and replace the project catalog with it.

The native directory picker is used where supported. The Builder falls back to `webkitdirectory` and recursive drag/drop traversal. Firefox may not expose relative folder paths through its picker; dragging the folder or selecting files individually provides a more reliable fallback.

## Library Schema

`library.json` is an array. Only `title` and `authors` are required. Authors, narrators, and categories are arrays of strings. Optional fields should use empty arrays/strings or `null` where appropriate.

```json
{
	"bookId": [
		{ "asin": "B000000000" },
		{ "audiobookId": "" },
		{ "isbn": "" }
	],
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
	"backgroundImage": "cover.jpg",
	"bookFile": "Book Title.mp3"
}
```

`durationSeconds` is canonical; `durationText` is for readable display. Ratings may be `null`. The dashboard normalizes arrays into display strings and derives rounded internal minutes without treating seconds as minutes.

## Images and Audio Paths

Cover resolution priority is:

1. Validated Base64 `data:image/...` value in `backgroundImage`.
2. A local file resolved under the matching `bookAssets/<author>/<series-or-title>/<title>/` folder.
3. A validated `http://` or `https://` URL.
4. A category-themed gradient.

Supported local image formats include JPG, JPEG, PNG, WebP, GIF, AVIF, and SVG. Relative audio paths resolve through the same `bookAssets` hierarchy. Paths containing traversal segments or unsafe protocols are rejected.

## Metadata Matching

The Builder supports:

- `Book.json` or `Book.metadata.json` beside the matching MP3.
- A direct metadata object in a folder containing one audiobook.
- Arrays of records.
- `{ "books": [] }` collections.
- Exact normalized relative-path, filename, or unambiguous title matching.

Audible metadata maps author/narrator names, publisher, description, dates, runtime, ASIN, ratings, cover URL, and leaf categories. Only the matched object’s top-level ASIN is used. Local covers override remote Audible covers. Audible media URLs or `|adbl|` album markers are not treated as series names.

## Local Server Option

Some browsers restrict `fetch('library.json')` and local media access when opening HTML directly with `file://`. If that happens, run a simple static server from the repository root, for example:

```text
python -m http.server 8000
```

Then open `http://localhost:8000/index.html`. This project does not require a build step or application server.

## Development Checks

Run these checks after code changes:

```text
node --check js/main.js
node --check js/state.js
node --check js/ui.js
node --check js/utils.js
node --check js/generator.js
git diff --check
```

The canonical regeneration specification is in [MasterPrompt.md](MasterPrompt.md).
