# BookLibrary

This is a work-in-progress application to display my list of audiobooks.

This project started as a simple request to Gemini to help me extract part of an Excel spreadsheet into a .json file. I didn't give it any further directions/limitations, and it built me an entire web application for managing my list of Audiobooks. So that got me thinking...

## Building a library JSON file

Open [generator.html](generator.html) in a browser and choose the `bookAssets` folder containing your MP3 files. The tool reads ID3 metadata and audio duration locally, then downloads a `library.json` file compatible with the dashboard. Each MP3 becomes one record, and its path below `bookAssets` is stored in `bookFile`. JSON files in the selected folder are read automatically.

The current `library.json` schema stores authors, narrators, and categories as arrays; duration as `durationSeconds` plus readable `durationText`; and identifiers as an array of `bookId` objects containing `asin`, `audiobookId`, and `isbn` values. Ratings may be `null`, and `backgroundImage` or `bookFile` may be empty. The dashboard normalizes these values for filtering and display while preserving the source schema in exported files.

JSON metadata can be a sidecar object such as `Book Name.json` beside `Book Name.mp3`, a metadata object anywhere in the same audiobook folder, or an array / `{ "books": [] }` collection with records matched by `title`, `bookFile`, `file`, or `filename`. A matching JSON value takes precedence over the corresponding MP3 tag; missing JSON fields keep the MP3-derived value.

Audible `.metadata.json` files are supported. The generator extracts author and narrator names, publisher, description, publication date, runtime, ASIN, cover image, ratings, and leaf category names from the Audible-specific nested fields. A local image in the audiobook folder takes precedence over the remote Audible cover URL; matching names, `cover`, `front`, `folder`, and `jacket` images are preferred. JPG, PNG, WebP, GIF, AVIF, and SVG images are recognized.

The browser cannot reliably determine audiobook ratings or narrator names from MP3 metadata. Those fields default to empty or zero values and can be edited in the generated JSON when needed.

The dashboard supports the current schema with string arrays for authors, narrators, and categories; `durationSeconds` and `durationText`; and structured `bookId` values. Cover images may be embedded as validated Base64 `data:image/...` URLs, referenced as local files below `bookAssets/<author>/<series-or-title>/<title>/`, or loaded from validated HTTP(S) URLs, in that priority order. Relative audio paths resolve below the same `bookAssets` layout.
