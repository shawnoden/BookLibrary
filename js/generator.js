(() => {
    const input = document.getElementById('folder-input');
    const chooseButton = document.getElementById('choose-folder-btn');
    const dropZone = document.getElementById('drop-zone');
    const status = document.getElementById('drop-status');
    const resultsPanel = document.getElementById('results-panel');
    const resultsBody = document.getElementById('results-body');
    const fileCount = document.getElementById('file-count');
    const downloadButton = document.getElementById('download-btn');
    const metadataSummary = document.getElementById('metadata-summary');
    let records = [];

    lucide.createIcons();

    chooseButton.addEventListener('click', () => input.click());
    input.addEventListener('change', () => processFiles(Array.from(input.files || [])));
    ['dragenter', 'dragover'].forEach(eventName => dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.add('dragging');
    }));
    ['dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.remove('dragging');
    }));
    dropZone.addEventListener('drop', event => processFiles(Array.from(event.dataTransfer.files || [])));
    downloadButton.addEventListener('click', downloadJson);

    async function processFiles(files) {
        const mp3Files = files.filter(file => file.name.toLowerCase().endsWith('.mp3'));
        const jsonFiles = files.filter(file => file.name.toLowerCase().endsWith('.json'));
        if (!mp3Files.length) {
            status.textContent = 'No MP3 files found in that selection';
            return;
        }
        records = [];
        resultsBody.innerHTML = '';
        resultsPanel.classList.remove('hidden');
        downloadButton.disabled = true;
        const metadataFiles = await readMetadataFiles(jsonFiles);
        status.textContent = `Reading ${mp3Files.length} MP3 file${mp3Files.length === 1 ? '' : 's'}${jsonFiles.length ? ` and ${jsonFiles.length} JSON file${jsonFiles.length === 1 ? '' : 's'}` : ''}...`;
        for (const file of mp3Files) {
            const result = await readFileRecord(file, metadataFiles);
            records.push(result.record);
            renderRow(result.record, result.error);
        }
        fileCount.textContent = records.length;
        downloadButton.disabled = records.length === 0;
        status.textContent = `Finished: ${records.length} record${records.length === 1 ? '' : 's'} ready`;
        const matchedMetadata = records.filter(record => record._metadataMatched).length;
        records.forEach(record => delete record._metadataMatched);
        metadataSummary.textContent = `${matchedMetadata} record${matchedMetadata === 1 ? '' : 's'} enriched from adjacent JSON. Ratings default to 0 when unavailable.`;
    }

    async function readMetadataFiles(files) {
        const metadata = [];
        for (const file of files) {
            try {
                const value = JSON.parse(await file.text());
                metadata.push({ file, value });
            } catch (error) {
                metadata.push({ file, value: null, error: 'invalid JSON' });
            }
        }
        return metadata;
    }

    function readTags(file) {
        return new Promise(resolve => {
            window.jsmediatags.read(file, {
                onSuccess: tag => resolve({ tags: tag.tags || {}, error: '' }),
                onError: error => resolve({ tags: {}, error: error.type || 'metadata unavailable' })
            });
        });
    }

    function getDuration(file) {
        return new Promise(resolve => {
            const audio = document.createElement('audio');
            const url = URL.createObjectURL(file);
            audio.preload = 'metadata';
            audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round((audio.duration || 0) / 60)); };
            audio.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
            audio.src = url;
        });
    }

    async function readFileRecord(file, metadataFiles) {
        const [{ tags, error }, duration] = await Promise.all([readTags(file), getDuration(file)]);
        const sidecar = findMetadata(file, metadataFiles);
        const title = textValue(tags.title) || file.name.replace(/\.mp3$/i, '');
        const author = textValue(tags.albumartist) || textValue(tags.artist);
        const narrator = textValue(tags.narrator) || textValue(tags.albumartist) || '';
        const year = textValue(tags.year).slice(0, 10);
        const relativePath = file.webkitRelativePath || file.name;
        const record = {
                title,
                subtitle: '',
                authors: author,
                narrators: narrator,
                length: duration,
                description: textValue(tags.comment),
                publisher: textValue(tags.publisher),
                series: textValue(tags.album),
                seriesOrder: textValue(tags.track),
                ratingOverall: 0,
                ratingPerformance: 0,
                ratingStory: 0,
                datePublished: year,
                categories: textValue(tags.genre),
                bookFile: relativePath,
                asin: '',
                backgroundImage: ''
        };
        if (sidecar) {
            mergeMetadata(record, sidecar);
            record._metadataMatched = true;
        }
        if (!record.asin) delete record.asin;
        return { record, error: error && !sidecar ? error : '' };
    }

    function findMetadata(audioFile, metadataFiles) {
        const audioPath = normalizePath(audioFile.webkitRelativePath || audioFile.name);
        const audioDirectory = audioPath.includes('/') ? audioPath.slice(0, audioPath.lastIndexOf('/')) : '';
        const audioBase = audioFile.name.replace(/\.mp3$/i, '').toLowerCase();
        const candidates = metadataFiles.filter(item => item.value && typeof item.value === 'object');
        const exactSidecar = candidates.find(item => {
            const jsonPath = normalizePath(item.file.webkitRelativePath || item.file.name);
            const jsonBase = item.file.name.replace(/\.json$/i, '').replace(/\.metadata$/i, '').toLowerCase();
            return jsonPath.slice(0, jsonPath.lastIndexOf('/')) === audioDirectory && jsonBase === audioBase;
        });
        if (exactSidecar) {
            return selectMetadataRecord(exactSidecar.value, audioFile) || (isMetadataObject(exactSidecar.value) ? exactSidecar.value : null);
        }

        const matchingRecord = candidates.map(item => selectMetadataRecord(item.value, audioFile)).find(Boolean);
        if (matchingRecord) return matchingRecord;

        const directoryMetadata = candidates.find(item => {
            const jsonPath = normalizePath(item.file.webkitRelativePath || item.file.name);
            return jsonPath.slice(0, jsonPath.lastIndexOf('/')) === audioDirectory && isMetadataObject(item.value);
        });
        return directoryMetadata ? directoryMetadata.value : null;
    }

    function isMetadataObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value) && !Array.isArray(value.books);
    }

    function selectMetadataRecord(value, audioFile) {
        const recordsToCheck = Array.isArray(value) ? value : Array.isArray(value.books) ? value.books : [];
        const audioName = audioFile.name.toLowerCase();
        return recordsToCheck.find(item => {
            if (!item || typeof item !== 'object') return false;
            const fileName = textValue(item.bookFile || item.file || item.filename || item.fileName).toLowerCase();
            const title = textValue(item.title).toLowerCase();
            return fileName.endsWith(audioName) || title === audioFile.name.replace(/\.mp3$/i, '').toLowerCase();
        }) || null;
    }

    function mergeMetadata(record, metadata) {
        metadata = normalizeMetadata(metadata);
        const aliases = {
            author: 'authors', artist: 'authors', albumArtist: 'authors', narrator: 'narrators',
            genre: 'categories', album: 'series', track: 'seriesOrder', year: 'datePublished',
            duration: 'length', file: 'bookFile', publisher_name: 'publisher',
            publisher_summary: 'description', merchandising_summary: 'description',
            runtime_length_min: 'length', issue_date: 'datePublished', release_date: 'datePublished'
        };
        Object.entries(metadata).forEach(([key, value]) => {
            const target = aliases[key] || key;
            if (!(target in record) || value === null || value === undefined || value === '') return;
            if (target === 'length') {
                record[target] = durationInMinutes(value, record.length);
            } else if (['ratingOverall', 'ratingPerformance', 'ratingStory'].includes(target)) {
                record[target] = Number(value) || record[target];
            } else {
                record[target] = textValue(value);
            }
        });
    }

    function normalizeMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object') return {};
        const normalized = { ...metadata };
        const rating = metadata.rating || {};
        const images = metadata.product_images || {};

        if (typeof metadata.asin === 'string' && metadata.asin.trim()) normalized.asin = metadata.asin.trim();
        if (metadata.authors) normalized.authors = peopleValue(metadata.authors);
        if (metadata.narrators) normalized.narrators = peopleValue(metadata.narrators);
        if (metadata.publisher_name) normalized.publisher_name = metadata.publisher_name;
        if (metadata.publisher_summary) normalized.publisher_summary = metadata.publisher_summary;
        if (metadata.runtime_length_min) normalized.runtime_length_min = metadata.runtime_length_min;
        if (metadata.issue_date || metadata.release_date || metadata.publication_datetime) {
            normalized.datePublished = metadata.issue_date || metadata.release_date || metadata.publication_datetime;
        }
        if (rating.overall_distribution) normalized.ratingOverall = rating.overall_distribution.average_rating;
        if (rating.performance_distribution) normalized.ratingPerformance = rating.performance_distribution.average_rating;
        if (rating.story_distribution) normalized.ratingStory = rating.story_distribution.average_rating;
        if (metadata.category_ladders) normalized.categories = categoryValue(metadata.category_ladders);
        if (images['500'] || images['300'] || images['large']) normalized.backgroundImage = images['500'] || images['300'] || images.large;
        return normalized;
    }

    function peopleValue(value) {
        if (!Array.isArray(value)) return textValue(value);
        return value.map(person => typeof person === 'object' ? person.name : person).filter(Boolean).join(', ');
    }

    function categoryValue(ladders) {
        if (!Array.isArray(ladders)) return textValue(ladders);
        const names = ladders.flatMap(item => Array.isArray(item.ladder) ? item.ladder : [])
            .map(category => typeof category === 'object' ? category.name : category)
            .filter(Boolean);
        return [...new Set(names)].join('; ');
    }

    function durationInMinutes(value, fallback) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue) || numericValue <= 0) return fallback;
        return numericValue > 100 ? Math.round(numericValue / 60) : Math.round(numericValue);
    }

    function normalizePath(value) {
        return String(value).replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
    }

    function textValue(value) {
        if (!value) return '';
        if (typeof value === 'object' && value.text) return String(value.text);
        if (typeof value === 'object' && value.name) return String(value.name);
        if (Array.isArray(value)) return value.join(', ');
        return String(value);
    }

    function renderRow(record, error) {
        const row = document.createElement('tr');
        row.className = 'text-slate-300';
        row.innerHTML = `<td class="p-3 font-medium text-white">${escapeHtml(record.title)}</td><td class="p-3">${escapeHtml(record.authors || 'Unknown')}</td><td class="p-3">${escapeHtml(record.series || '-')}</td><td class="p-3 mono">${record.length ? `${record.length} min` : '-'}</td><td class="p-3 ${error ? 'text-amber-400' : 'text-emerald-400'}">${error ? 'Filename fallback' : 'Tags read'}</td>`;
        resultsBody.appendChild(row);
    }

    function downloadJson() {
        const blob = new Blob([JSON.stringify(records, null, 4)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'library.json';
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }
})();