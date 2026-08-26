(() => {
    const input = document.getElementById('folder-input');
    const chooseButton = document.getElementById('choose-folder-btn');
    const dropZone = document.getElementById('drop-zone');
    const status = document.getElementById('drop-status');
    const resultsPanel = document.getElementById('results-panel');
    const resultsBody = document.getElementById('results-body');
    const fileCount = document.getElementById('file-count');
    const downloadButton = document.getElementById('download-btn');
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
        if (!mp3Files.length) {
            status.textContent = 'No MP3 files found in that selection';
            return;
        }
        records = [];
        resultsBody.innerHTML = '';
        resultsPanel.classList.remove('hidden');
        downloadButton.disabled = true;
        status.textContent = `Reading ${mp3Files.length} MP3 file${mp3Files.length === 1 ? '' : 's'}...`;
        for (const file of mp3Files) {
            const result = await readFileRecord(file);
            records.push(result.record);
            renderRow(result.record, result.error);
        }
        fileCount.textContent = records.length;
        downloadButton.disabled = records.length === 0;
        status.textContent = `Finished: ${records.length} record${records.length === 1 ? '' : 's'} ready`;
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

    async function readFileRecord(file) {
        const [{ tags, error }, duration] = await Promise.all([readTags(file), getDuration(file)]);
        const title = textValue(tags.title) || file.name.replace(/\.mp3$/i, '');
        const author = textValue(tags.albumartist) || textValue(tags.artist);
        const narrator = textValue(tags.narrator) || textValue(tags.albumartist) || '';
        const year = textValue(tags.year).slice(0, 10);
        const relativePath = file.webkitRelativePath || file.name;
        return {
            record: {
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
                bookFile: relativePath
            },
            error
        };
    }

    function textValue(value) {
        if (!value) return '';
        if (typeof value === 'object' && value.text) return String(value.text);
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