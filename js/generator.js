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
    let selectionRoot = '';

    lucide.createIcons();

    chooseButton.addEventListener('click', chooseFolder);
    input.addEventListener('change', () => {
        const files = Array.from(input.files || []);
        if (files.length && !files.some(file => file.webkitRelativePath)) {
            status.textContent = 'Firefox did not provide folder paths. Drop the folder here or select files individually.';
        }
        processFiles(files);
    });
    ['dragenter', 'dragover'].forEach(eventName => dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.add('dragging');
    }));
    ['dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.remove('dragging');
    }));
    dropZone.addEventListener('drop', event => processDroppedItems(event.dataTransfer));
    downloadButton.addEventListener('click', downloadJson);

    async function chooseFolder() {
        if (!window.showDirectoryPicker) {
            input.click();
            return;
        }

        try {
            const directory = await window.showDirectoryPicker({ mode: 'read' });
            status.textContent = `Scanning ${directory.name} and all subfolders...`;
            const files = [];
            await collectDirectoryFiles(directory, '', files);
            await processFiles(files);
        } catch (error) {
            if (error.name !== 'AbortError') status.textContent = 'Unable to read that folder';
        }
    }

    async function collectDirectoryFiles(directory, relativeDirectory, files) {
        for await (const [name, handle] of directory.entries()) {
            const relativePath = `${relativeDirectory}${name}`;
            if (handle.kind === 'file') {
                const file = await handle.getFile();
                Object.defineProperty(file, 'relativePath', { value: relativePath, configurable: true });
                files.push(file);
            } else if (handle.kind === 'directory') {
                await collectDirectoryFiles(handle, `${relativePath}/`, files);
            }
        }
    }

    async function processFiles(files) {
        const mp3Files = files.filter(file => file.name.toLowerCase().endsWith('.mp3'));
        const jsonFiles = files.filter(file => file.name.toLowerCase().endsWith('.json'));
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png|webp|gif|avif|svg)$/i.test(file.name));
        if (!mp3Files.length) {
            status.textContent = 'No MP3 files found in that selection';
            return;
        }
        records = [];
        resultsBody.innerHTML = '';
        resultsPanel.classList.remove('hidden');
        downloadButton.disabled = true;
        selectionRoot = getSelectionRoot([...mp3Files, ...jsonFiles, ...imageFiles]);
        const metadataFiles = await readMetadataFiles(jsonFiles);
        status.textContent = `Reading ${mp3Files.length} MP3 file${mp3Files.length === 1 ? '' : 's'}${jsonFiles.length ? ` and ${jsonFiles.length} JSON file${jsonFiles.length === 1 ? '' : 's'}` : ''}...`;
        for (const file of mp3Files) {
            const result = await readFileRecord(file, metadataFiles, imageFiles, mp3Files);
            records.push(result.record);
            renderRow(result.record, result.error);
        }
        fileCount.textContent = records.length;
        downloadButton.disabled = records.length === 0;
        const pathWarning = !files.some(file => file.relativePath || file.webkitRelativePath) ? ' Folder paths were unavailable.' : '';
        status.textContent = `Finished: ${records.length} record${records.length === 1 ? '' : 's'} ready.${pathWarning}`;
        const matchedMetadata = records.filter(record => record._metadataMatched).length;
        const invalidMetadata = metadataFiles.filter(item => item.error).length;
        records.forEach(record => delete record._metadataMatched);
        metadataSummary.textContent = `${matchedMetadata} record${matchedMetadata === 1 ? '' : 's'} enriched from adjacent JSON. ${invalidMetadata ? `${invalidMetadata} JSON file${invalidMetadata === 1 ? '' : 's'} could not be parsed. ` : ''}Ratings default to 0 when unavailable.`;
    }

    async function processDroppedItems(dataTransfer) {
        if (!dataTransfer.items) {
            processFiles(Array.from(dataTransfer.files || []));
            return;
        }
        const files = [];
        for (const item of Array.from(dataTransfer.items)) {
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
            if (entry) {
                await collectEntryFiles(entry, '', files);
            } else {
                const file = item.getAsFile ? item.getAsFile() : null;
                if (file) files.push(file);
            }
        }
        processFiles(files);
    }

    async function collectEntryFiles(entry, relativeDirectory, files) {
        if (entry.isFile) {
            await new Promise(resolve => entry.file(file => {
                Object.defineProperty(file, 'relativePath', { value: `${relativeDirectory}${file.name}`, configurable: true });
                files.push(file);
                resolve();
            }, resolve));
            return;
        }
        if (!entry.isDirectory) return;

        const reader = entry.createReader();
        const entries = [];
        let batch;
        do {
            batch = await new Promise(resolve => reader.readEntries(resolve, () => resolve([])));
            entries.push(...batch);
        } while (batch.length);

        const directory = `${relativeDirectory}${entry.name}/`;
        for (const child of entries) await collectEntryFiles(child, directory, files);
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
            audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(audio.duration || 0)); };
            audio.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
            audio.src = url;
        });
    }

    async function readFileRecord(file, metadataFiles, imageFiles, audioFiles) {
        const [{ tags, error }, durationSeconds] = await Promise.all([readTags(file), getDuration(file)]);
        const sidecar = findMetadata(file, metadataFiles, audioFiles);
        const title = textValue(tags.title) || file.name.replace(/\.mp3$/i, '');
        const author = textValue(tags.albumartist) || textValue(tags.artist);
        const narrator = textValue(tags.narrator) || textValue(tags.albumartist) || '';
        const year = textValue(tags.year).slice(0, 10);
        const relativePath = relativeFilePath(file);
        const record = {
                title,
                subtitle: '',
                authors: author,
                narrators: narrator,
                length: Math.round(durationSeconds / 60),
                _durationSeconds: durationSeconds,
                description: textValue(tags.comment),
                publisher: textValue(tags.publisher),
                series: seriesValue(tags.album),
                seriesOrder: seriesOrderValue(tags.track),
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
        const localImage = findLocalImage(file, imageFiles);
        if (localImage) record.backgroundImage = localImage;
        if (!record.asin) delete record.asin;
        if (!record.backgroundImage) delete record.backgroundImage;
        return { record, error: error && !sidecar ? error : '' };
    }

    function findLocalImage(audioFile, imageFiles) {
        const audioPath = normalizePath(relativeFilePath(audioFile));
        const audioDirectory = audioPath.includes('/') ? audioPath.slice(0, audioPath.lastIndexOf('/')) : '';
        const audioBase = audioFile.name.replace(/\.mp3$/i, '').toLowerCase();
        const inDirectory = imageFiles.filter(file => {
            const imagePath = normalizePath(relativeFilePath(file));
            return imagePath.slice(0, imagePath.lastIndexOf('/')) === audioDirectory;
        });
        const sameName = inDirectory.find(file => file.name.replace(/\.[^.]+$/, '').toLowerCase() === audioBase);
        if (sameName) return relativeFilePath(sameName);

        const preferredNames = ['cover', 'coverart', 'front', 'folder', 'jacket'];
        const preferredImage = inDirectory.find(file => preferredNames.includes(file.name.replace(/\.[^.]+$/, '').toLowerCase()));
        if (preferredImage) return relativeFilePath(preferredImage);
        if (inDirectory.length === 1) return relativeFilePath(inDirectory[0]);
        return '';
    }

    function findMetadata(audioFile, metadataFiles, audioFiles) {
        const audioPath = normalizePath(relativeFilePath(audioFile));
        const audioDirectory = audioPath.includes('/') ? audioPath.slice(0, audioPath.lastIndexOf('/')) : '';
        const audioBase = audioFile.name.replace(/\.mp3$/i, '').toLowerCase();
        const candidates = metadataFiles.filter(item => item.value && typeof item.value === 'object');
        const exactSidecar = candidates.find(item => {
            const jsonPath = normalizePath(relativeFilePath(item.file));
            const jsonBase = item.file.name.replace(/\.json$/i, '').replace(/\.metadata$/i, '').toLowerCase();
            return jsonPath.slice(0, jsonPath.lastIndexOf('/')) === audioDirectory && jsonBase === audioBase;
        });
        if (exactSidecar) {
            return selectMetadataRecord(exactSidecar.value, audioFile) || (isMetadataObject(exactSidecar.value) ? exactSidecar.value : null);
        }

        const matchingRecords = candidates.map(item => selectMetadataRecord(item.value, audioFile)).filter(Boolean);
        if (matchingRecords.length === 1) return matchingRecords[0];

        const directoryMetadata = candidates.find(item => {
            const jsonPath = normalizePath(relativeFilePath(item.file));
            const sameDirectoryAudio = audioFiles.filter(file => {
                const filePath = normalizePath(relativeFilePath(file));
                return filePath.slice(0, filePath.lastIndexOf('/')) === audioDirectory;
            });
            return jsonPath.slice(0, jsonPath.lastIndexOf('/')) === audioDirectory && isMetadataObject(item.value) && sameDirectoryAudio.length === 1;
        });
        return directoryMetadata ? directoryMetadata.value : null;
    }

    function isMetadataObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value) && !Array.isArray(value.books);
    }

    function selectMetadataRecord(value, audioFile) {
        const recordsToCheck = Array.isArray(value) ? value : Array.isArray(value.books) ? value.books : [];
        const audioPath = normalizePath(relativeFilePath(audioFile));
        const audioName = audioFile.name.toLowerCase();
        return recordsToCheck.find(item => {
            if (!item || typeof item !== 'object') return false;
            const fileName = textValue(item.bookFile || item.file || item.filename || item.fileName).toLowerCase();
            const title = textValue(item.title).toLowerCase();
            const normalizedFileName = normalizePath(fileName);
            const fileMatches = normalizedFileName === audioPath || (!normalizedFileName.includes('/') && normalizedFileName === audioName);
            return fileMatches || title === audioFile.name.replace(/\.mp3$/i, '').toLowerCase();
        }) || null;
    }

    function mergeMetadata(record, metadata) {
        metadata = normalizeMetadata(metadata);
        const aliases = {
            author: 'authors', artist: 'authors', albumArtist: 'authors', narrator: 'narrators',
            genre: 'categories', album: 'series', track: 'seriesOrder', year: 'datePublished',
            duration: 'length', file: 'bookFile', publisher_name: 'publisher',
            publisher_summary: 'description', merchandising_summary: 'description',
            runtime_length_min: 'length', issue_date: 'datePublished', release_date: 'datePublished',
            series_name: 'series', series_sequence: 'seriesOrder'
        };
        Object.entries(metadata).forEach(([key, value]) => {
            const target = aliases[key] || key;
            if (!(target in record) || value === null || value === undefined || value === '') return;
            if (target === 'series') {
                record[target] = seriesValue(value) || record[target];
            } else if (target === 'seriesOrder') {
                record[target] = seriesOrderValue(value) || record[target];
            } else if (target === 'length') {
                record[target] = key === 'runtime_length_min' ? minutesValue(value, record.length) : durationInMinutes(value, record.length);
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
        const names = ladders.map(item => Array.isArray(item.ladder) ? item.ladder[item.ladder.length - 1] : null)
            .map(category => typeof category === 'object' ? category.name : category)
            .filter(Boolean);
        return [...new Set(names)].join('; ');
    }

    function durationInMinutes(value, fallback) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue) || numericValue <= 0) return fallback;
        return numericValue > 100 ? Math.round(numericValue / 60) : Math.round(numericValue);
    }

    function minutesValue(value, fallback) {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : fallback;
    }

    function seriesValue(value) {
        if (Array.isArray(value)) return value.map(item => seriesValue(item)).filter(Boolean).join('; ');
        if (value && typeof value === 'object') return seriesValue(value.name || value.seriesName || value.title || value.series);
        if (typeof value !== 'string') return '';
        const series = value.trim();
        return /^https?:\/\//i.test(series) || /\|adbl\|/i.test(series) ? '' : series;
    }

    function seriesOrderValue(value) {
        if (value && typeof value === 'object') return seriesOrderValue(value.sequence || value.order || value.number || value.position);
        return value === null || value === undefined ? '' : String(value).trim();
    }

    function getSelectionRoot(files) {
        const firstPath = files.map(file => file.relativePath || file.webkitRelativePath).find(Boolean);
        return firstPath ? firstPath.split('/')[0] : '';
    }

    function relativeFilePath(file) {
        const path = file.relativePath || file.webkitRelativePath || file.name;
        return selectionRoot && path.startsWith(`${selectionRoot}/`) ? path.slice(selectionRoot.length + 1) : path;
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
        const exportRecords = records.map(toLibrarySchemaRecord);
        const blob = new Blob([JSON.stringify(exportRecords, null, 4)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'library.json';
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function toLibrarySchemaRecord(record) {
        const authors = record.authors ? record.authors.split(',').map(value => value.trim()).filter(Boolean) : [];
        const narrators = record.narrators ? record.narrators.split(',').map(value => value.trim()).filter(Boolean) : [];
        const categories = record.categories ? record.categories.split(';').map(value => value.trim()).filter(Boolean) : [];
        const durationSeconds = Math.max(0, Math.round(Number(record._durationSeconds) || Number(record.length) * 60 || 0));
        return {
            bookId: record.bookId || (record.asin ? [{ asin: record.asin }, { audiobookId: '' }, { isbn: '' }] : [{ asin: '' }, { audiobookId: '' }, { isbn: '' }]),
            title: record.title,
            subtitle: record.subtitle || '',
            authors,
            narrators,
            durationSeconds,
            durationText: formatDurationText(durationSeconds),
            description: record.description || '',
            publisher: record.publisher || '',
            series: record.series || '',
            seriesOrder: record.seriesOrder || '',
            ratingOverall: record.ratingOverall || null,
            ratingPerformance: record.ratingPerformance || null,
            ratingStory: record.ratingStory || null,
            datePublished: record.datePublished || '',
            categories,
            backgroundImage: record.backgroundImage || '',
            bookFile: record.bookFile || '',
            _comment: 'Generated Audiobook'
        };
    }

    function formatDurationText(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }
})();