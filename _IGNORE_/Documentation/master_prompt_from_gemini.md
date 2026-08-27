Act as a Principal Frontend Software Architect. Generate a modular, high-performance, single-page application named "Audiobook Library Dashboard" with a dark cinematic UI. The app must run flawlessly via local file systems (file:// protocol) without Node.js, build steps, or local web servers.

[DATABASE CONFIGURATION (library.json)]
The application relies on a local "library.json" database placed in the same folder. You must parse this file dynamically. The schema has been streamlined: ONLY "title" and "authors" are required attributes. Everything else is optional and must be handled gracefully with fallbacks if missing or null.

JSON Schema Specifications:
- An array of Audiobook objects, each containing:
  - "title" (string, required): Title of the audiobook.
  - "authors" (Array of Objects, required): Structured array of author objects, e.g. ["Dennis E. Taylor"].
  - "subtitle" (string, optional): Subtitle or tagline.
  - "narrators" (Array of Objects, optional): Structured array of narrator objects, e.g. ["Ray Porter","Wil Weaton"]. (Handle missing value gracefully; map to empty array []).
  - "publisher" (string, optional): Publishing company.
  - "datePublished" (string, optional): Format "YYYY-MM-DD" for chronological sorting.
  - "durationSeconds" (number, optional): Total duration in seconds. (If missing, default to 0. Dynamic stats must ignore or skip 0-duration books).
  - "durationText" (string, optional): Display string (e.g., "9h 37m 0s").
  - "ratingOverall" (number or null, optional): 0.0 to 5.0 overall star rating. (Handle null/missing values gracefully with dynamic visual fallback "--").
  - "ratingStory" (number or null, optional): 0.0 to 5.0 story rating. (Handle null/missing values gracefully with dynamic visual fallback "--").
  - "ratingPerformance" (number or null, optional): 0.0 to 5.0 narrator performance rating. (Handle null/missing values gracefully with dynamic visual fallback "--").
  - "categories" (Array of Strings, optional): A native JSON array of strings representing genres or themes, e.g. ["Adventure", "Time Travel"]. (If missing, default to an empty array []).
  - "series" (string, optional): The name of the series this book belongs to (for Series Grouping).
  - "seriesOrder" (string, optional): Volume sequence identifier (e.g. "1", "2.5", "Vol. 3" - parsed numerically to order series items chronologically).
  - "backgroundImage" (string, optional): Path, Base64 string, or absolute URL for the cover image.
  - "bookFile" (string, optional): Path or filename to the audio track (reveals "Play" and "Download" options if defined).

[BOOK ASSETS & DIRECTORY RESOLUTION LOGIC]
Any files required for a book's card (e.g., cover images, audio files) are organized inside a parent "bookAssets" folder. Under "bookAssets", there is a folder for the Author, and then the series or books that author has written are nested inside that folder. Every individual book is isolated inside its own folder named after the book title.
- Path Schema for Series Books: bookAssets/<author name>/<series name>/<book title>/
- Path Schema for Standalone Books: bookAssets/<author name>/<book title>/
- Note: This target sub-folder may also contain a local JSON file representing metadata for that specific book. The parsing code must be designed to dynamically resolve paths using this structure while remaining flexible enough to handle various potential single-book metadata schemas in future iterations.

Resolve visual "backgroundImage" cover art using this strict priority hierarchy:
1. Base64 Encoded Image: If the string starts with "data:image/", render it directly.
2. Local Asset Subfolder: If the string is a local filename (contains no protocol and doesn't start with "data:image/"), resolve it dynamically inside the structured assets folder:
   - If the book belongs to a series: `bookAssets/<first author name>/<series>/<title>/<backgroundImage>`
   - If the book is a standalone: `bookAssets/<first author name>/<title>/<backgroundImage>`
3. Remote Link: If the string starts with "http://" or "https://", use the external URL directly.
4. Fallback: If empty, blank, or missing, fall back smoothly to a beautiful genre-themed CSS gradient.

Example library.json Structure:
[
  {
    "title": "Flybot",
    "subtitle": "",
    "authors": [ {"name": "Dennis E. Taylor"} ],
    "narrators": [ {"name": "Ray Porter"} ],
    "durationSeconds": 34620,
    "durationText": "9h 37m 0s",
    "description": "<p>Mysterious tech, a devious AI...</p>",
    "publisher": "Audible Originals",
    "series": "",
    "seriesOrder": "",
    "ratingOverall": 4.58094358444214,
    "ratingPerformance": 4.8339729309082,
    "ratingStory": 4.51666307449341,
    "datePublished": "2025-06-26",
    "categories": ["Adventure"],
    "backgroundImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "bookFile": ""
  }
]

[ARCHITECTURAL RULES]
1. NO ES6 IMPORTS/EXPORTS: Script files must share state and interfaces through a unified, globally defined namespace: 'window.AudiobookApp = window.AudiobookApp || {};'.
2. SCRIPT LOADING SEQUENCE: index.html must load scripts in this exact order:
   - js/state.js (manages variables, localStorage cache, and persistence).
   - js/utils.js (helpers, alphanumeric unique ID cleaners, sort mathematics, and debouncers).
   - js/ui.js (pure DOM generation, layout toggles, progressive sentinel pagination, and cover lazy-loading).
   - js/main.js (application entry, event handlers, audio player scrubbers, and catalog data fetching).
3. SYSTEM ROBUSTNESS (CRASH PREVENTION):
   - Lucide Dynamic Replacements: Lucide destroys '<i>' tags when converting them to SVG vectors. Any dynamic icon updates (like sort chevrons or play & complete buttons) must wrap the target icon in a static '<span>' container, rewrite the container's innerHTML with a fresh placeholder '<i>' tag, and target ONLY that container using 'lucide.createIcons({ node: container })' to prevent reference errors.
   - Clean CSS Selectors & Sanitization: Audiobook IDs must be generated via a utility 'getBookId(book)' that sanitizes strings using: 'replace(/[^a-zA-Z0-9-_]/g, "_")' to filter out characters (like single/double quotes) that crash document.querySelector queries.
   - Data Attribute Element Targeting: Query structural elements in real-time by binding and checking 'data-book-id="..."' attributes instead of nesting selector logic in element IDs.
   - Robust Missing-Data Checks: Avoid executing methods directly on optional parameters. If ratings are null, display fallback indicators. Safely check array fields before mapping over authors, narrators, or categories.

[FEATURES TO IMPLEMENT]
1. INTERACTIVE PLAYER & DRIFT CONTROLS:
   - Floating audio player bar at the bottom right with dynamic visualizer thumbnails.
   - Draggable scrubber progress bar supporting mouse and touch events (passive tracking configured) to navigate and seek audio duration.
   - Instant timeline feedback: real-time percentages synced back to the matching audiobook's list progress bar and compact grid progress meter.
2. DYNAMIC SERIES & STANDALONES:
   - Option to group catalog by Series. Series sorted alphabetically; books within series sorted numerically (supporting floats like Vol. 1.5).
   - Standalone titles must be automatically isolated and rendered under their own dedicated section at the bottom of the page.
3. SCALABILITY:
   - Cap initial DOM rendering to 40 items.
   - Implement an IntersectionObserver-based sentinel spinner at the bottom of the page to trigger progressive batch pagination.
   - Implement IntersectionObserver lazy-loading on card cover backgrounds using a 'data-lazy-cover' attribute.
4. "COMPLETED" LOCAL PERSISTENCE:
   - Interactive toggles on cards, row buttons, and the modal details block to flag audiobooks as "Listened".
   - Flags must be synced dynamically to localStorage and automatically update the global count statistics.
5. TECH STACK:
   - Tailwind CSS CDN, Lucide Icons CDN, Google Fonts (Inter). Dark cinematic background (#0b0f19), slate-900 panels, and amber-500 brand accent highlights.
   - Inline SVG Favicon showing white headphones over an amber rounded canvas.

Produce index.html, js/state.js, js/utils.js, js/ui.js, and js/main.js.




Example Folder Structure:

audiobook-library/              <-- Root Project Folder
├── index.html                  <-- Main Interface
├── library.json                <-- Global Database
├── js/                         <-- Vanilla Script Engines
│   ├── state.js
│   ├── utils.js
│   ├── ui.js
│   └── main.js
└── bookAssets/                 <-- Main Assets Directory
    │
    ├── Matt Dinniman/          <-- Author Folder
    │   └── Dungeon Crawler Carl/   <-- Series Folder
    │       ├── Dungeon Crawler Carl/   <-- Book Folder (named after Book Title)
    │       │   ├── DungeonCrawlerCarlBook1.png   <-- backgroundImage
    │       │   ├── crash.mp3                    <-- bookFile
    │       │   └── book1-audible-meta.json      <-- Standalone book metadata JSON
    │       │
    │       └── Carl's Doomsday Scenario/ <-- Book Folder
    │           ├── doomsday.png
    │           └── doomsday.mp3
    │
    ├── Dennis E. Taylor/       <-- Author Folder
    │   ├── Bobiverse/          <-- Series Folder
    │   │   ├── We Are Legion (We Are Bob)/ <-- Book Folder
    │   │   │   ├── WeAreLegion.png
    │   │   │   └── legion.mp3
    │   │   └── For We Are Many/    <-- Book Folder
    │   │       ├── ForWeAreMany.png
    │   │       └── many.mp3
    │   │
    │   └── Flybot/             <-- Standalone Book Folder (named after Book Title)
    │       ├── Flybot.png              <-- backgroundImage
    │       ├── Flybot.mp3              <-- bookFile
    │       └── flybot-single-meta.json <-- Dynamic standalone metadata JSON
    │
    └── Eric O'Neill/           <-- Author Folder
        └── Gray Day/           <-- Standalone Book Folder
            ├── GrayDayCover.jpg        <-- Cover Art
            └── GrayDay.mp3             <-- Standalone Audiobook Track