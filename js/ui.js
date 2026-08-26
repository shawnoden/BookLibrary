/**
 * Audiobook Library UI & Render Module
 * Manages DOM manipulation, lazy loading observers, modals, and dynamic progress metrics.
 */
window.AudiobookApp = window.AudiobookApp || {};

window.AudiobookApp.ui = {
    lazyObserver: null,

    /**
     * Setup intersection observers for cover lazy-loading
     */
    initObservers: function() {
        if ('IntersectionObserver' in window) {
            this.lazyObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const target = entry.target;
                        const coverSrc = target.getAttribute('data-lazy-cover');
                        if (coverSrc) {
                            target.style.backgroundImage = `url('${coverSrc}')`;
                        }
                        observer.unobserve(target);
                    }
                });
            }, { rootMargin: "100px 0px" });
        }
    },

    /**
     * Refreshes dynamic stats on the page
     */
    updateStats: function() {
        const state = window.AudiobookApp.state;
        const libraryData = state.libraryData;

        // Total count
        document.getElementById('stat-book-count').textContent = `${libraryData.length} audiobooks`;
        document.getElementById('card-count').textContent = libraryData.length;

        // Total Runtime minutes conversion
        const totalMinutes = libraryData.reduce((acc, curr) => acc + (curr.length || 0), 0);
        const d = Math.floor(totalMinutes / (24 * 60));
        const h = Math.floor((totalMinutes % (24 * 60)) / 60);
        const m = totalMinutes % 60;

        document.getElementById('stat-total-time').textContent = `${d}d ${h}h ${m}m`;
        document.getElementById('card-hours').textContent = `${Math.round(totalMinutes / 60)} hrs`;

        // Completed stats card
        const listenedCount = state.listenedSet.size;
        document.getElementById('card-completed').textContent = `${listenedCount} / ${libraryData.length}`;

        // Find Longest book
        if (libraryData.length > 0) {
            const longest = libraryData.reduce((prev, curr) => ((prev.length || 0) > (curr.length || 0)) ? prev : curr);
            document.getElementById('card-longest').textContent = `${longest.title} (${Math.round((longest.length || 0) / 60)}h)`;
        } else {
            document.getElementById('card-longest').textContent = "None";
        }
    },

    /**
     * Builds standard active filter tag elements
     */
    updateFilterBadges: function() {
        const state = window.AudiobookApp.state;
        const container = document.getElementById('active-filters-container');
        const badgesDiv = document.getElementById('filter-badges');

        badgesDiv.innerHTML = '';

        if (state.activeCategory === 'all' && state.activeNarrator === 'all' && !state.searchQuery) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');

        if (state.activeCategory !== 'all') {
            badgesDiv.appendChild(this.createBadge(`Category: ${state.activeCategory}`, () => {
                state.activeCategory = 'all';
                document.getElementById('category-filter').value = 'all';
                this.updateFilterBadges();
                this.render(true);
            }));
        }

        if (state.activeNarrator !== 'all') {
            badgesDiv.appendChild(this.createBadge(`Narrator: ${state.activeNarrator}`, () => {
                state.activeNarrator = 'all';
                document.getElementById('narrator-filter').value = 'all';
                this.updateFilterBadges();
                this.render(true);
            }));
        }

        if (state.searchQuery) {
            badgesDiv.appendChild(this.createBadge(`Query: "${state.searchQuery}"`, () => {
                state.searchQuery = '';
                document.getElementById('search-input').value = '';
                this.updateFilterBadges();
                this.render(true);
            }));
        }
    },

    createBadge: function(text, onRemove) {
        const span = document.createElement('span');
        span.className = "inline-flex items-center gap-1 bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md text-[11px]";
        span.innerHTML = `<span>${text}</span>`;

        const closeBtn = document.createElement('button');
        closeBtn.className = "text-slate-500 hover:text-red-400 ml-0.5 font-bold transition-colors";
        closeBtn.innerHTML = "&times;";
        closeBtn.onclick = onRemove;

        span.appendChild(closeBtn);
        return span;
    },

    /**
     * Master render controller
     */
    render: function(resetPagination = false) {
        const state = window.AudiobookApp.state;
        if (resetPagination) {
            state.renderedCount = state.batchSize;
        }

        const filtered = window.AudiobookApp.utils.getFilteredAndSortedData();
        const gridContainer = document.getElementById('books-grid');
        const listBody = document.getElementById('books-list-body');
        const emptyState = document.getElementById('empty-state');
        const listTable = document.getElementById('books-list');

        // Hide sentinel if all items are already visible
        const sentinelSpinner = document.getElementById('sentinel-spinner');
        if (state.renderedCount >= filtered.length) {
            sentinelSpinner.classList.add('hidden');
        }

        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
            gridContainer.classList.add('hidden');
            listTable.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        if (state.currentLayout === 'grid') {
            gridContainer.classList.remove('hidden');
            listTable.classList.add('hidden');
        } else {
            listTable.classList.remove('hidden');
            gridContainer.classList.add('hidden');
        }

        const subset = filtered.slice(0, state.renderedCount);

        if (state.groupBySeries) {
            this.renderGrouped(subset, filtered.length, gridContainer, listBody);
        } else {
            this.renderFlat(subset, gridContainer, listBody);
        }

        this.updateSortIcons();
    },

    renderFlat: function(data, gridContainer, listBody) {
        const state = window.AudiobookApp.state;
        if (state.currentLayout === 'grid') {
            gridContainer.innerHTML = '';
            data.forEach(book => {
                gridContainer.appendChild(this.createCompactGridCard(book));
            });
            lucide.createIcons({ node: gridContainer });
        } else {
            listBody.innerHTML = '';
            data.forEach(book => {
                listBody.appendChild(this.createListRow(book));
            });
            lucide.createIcons({ node: listBody });
        }
    },

    renderGrouped: function(data, totalCount, gridContainer, listBody) {
        const state = window.AudiobookApp.state;
        const utils = window.AudiobookApp.utils;

        const seriesGroups = {};
        const standalones = [];

        data.forEach(book => {
            if (book.series && book.series.trim() !== '') {
                const sName = book.series.trim();
                if (!seriesGroups[sName]) seriesGroups[sName] = [];
                seriesGroups[sName].push(book);
            } else {
                standalones.push(book);
            }
        });

        // Chronological sort within each cluster
        for (const sName in seriesGroups) {
            seriesGroups[sName].sort((a, b) => {
                const aNum = utils.getSeriesNumber(a.seriesOrder);
                const bNum = utils.getSeriesNumber(b.seriesOrder);
                return aNum - bNum;
            });
        }

        const sortedSeriesNames = Object.keys(seriesGroups).sort((a, b) => a.localeCompare(b));

        if (state.currentLayout === 'grid') {
            gridContainer.innerHTML = '';
            sortedSeriesNames.forEach(sName => {
                const books = seriesGroups[sName];
                const headerDiv = document.createElement('div');
                headerDiv.className = "col-span-full border-b border-slate-800 pb-1.5 mt-6 mb-2 flex justify-between items-end";
                headerDiv.innerHTML = `
                    <h3 class="text-xs font-bold text-brand-500 flex items-center gap-1.5 tracking-wider uppercase">
                        <i data-lucide="layers" class="w-4 h-4"></i> ${sName}
                    </h3>
                    <span class="text-[10px] text-slate-500 font-mono">${books.length} Volumes</span>
                `;
                gridContainer.appendChild(headerDiv);

                books.forEach(book => {
                    gridContainer.appendChild(this.createCompactGridCard(book));
                });
            });

            if (standalones.length > 0) {
                const headerDiv = document.createElement('div');
                headerDiv.className = "col-span-full border-b border-slate-800 pb-1.5 mt-8 mb-2 flex justify-between items-end";
                headerDiv.innerHTML = `
                    <h3 class="text-xs font-bold text-slate-400 flex items-center gap-1.5 tracking-wider uppercase">
                        <i data-lucide="headphones" class="w-4 h-4"></i> Standalone Titles
                    </h3>
                    <span class="text-[10px] text-slate-500 font-mono">${standalones.length} Audiobooks</span>
                `;
                gridContainer.appendChild(headerDiv);

                standalones.forEach(book => {
                    gridContainer.appendChild(this.createCompactGridCard(book));
                });
            }
            lucide.createIcons({ node: gridContainer });
        } else {
            listBody.innerHTML = '';
            sortedSeriesNames.forEach(sName => {
                const books = seriesGroups[sName];
                const headerRow = document.createElement('tr');
                headerRow.className = "bg-slate-900/30 text-slate-300";
                headerRow.innerHTML = `
                    <td colspan="6" class="p-3 font-semibold border-y border-slate-800 text-xs text-brand-500">
                        <div class="flex items-center justify-between">
                            <span class="flex items-center gap-2"><i data-lucide="layers" class="w-4 h-4"></i> ${sName}</span>
                            <span class="text-[10px] text-slate-500 font-normal font-mono">${books.length} Volumes</span>
                        </div>
                    </td>
                `;
                listBody.appendChild(headerRow);

                books.forEach(book => {
                    listBody.appendChild(this.createListRow(book));
                });
            });

            if (standalones.length > 0) {
                const headerRow = document.createElement('tr');
                headerRow.className = "bg-slate-900/30 text-slate-300";
                headerRow.innerHTML = `
                    <td colspan="6" class="p-3 font-semibold border-y border-slate-800 text-xs text-slate-400">
                        <div class="flex items-center justify-between">
                            <span class="flex items-center gap-2"><i data-lucide="headphones" class="w-4 h-4"></i> Standalone Titles</span>
                            <span class="text-[10px] text-slate-500 font-normal font-mono">${standalones.length} Audiobooks</span>
                        </div>
                    </td>
                `;
                listBody.appendChild(headerRow);

                standalones.forEach(book => {
                    listBody.appendChild(this.createListRow(book));
                });
            }
            lucide.createIcons({ node: listBody });
        }
    },

    /**
     * Generates a single compact cover art grid card (Semantic article)
     */
    createCompactGridCard: function(book) {
        const state = window.AudiobookApp.state;
        const utils = window.AudiobookApp.utils;
        const card = document.createElement('article');

        // Resolve absolute unique ID
        const bookId = utils.getBookId(book);

        // Listen tracking visualization modifiers
        const isListened = state.listenedSet.has(bookId);
        const listenedBgModifier = isListened ? 'border-emerald-500/30 bg-emerald-950/5' : 'border-slate-800/80 bg-slate-900/60';

        card.className = `group ${listenedBgModifier} border rounded-lg hover:border-slate-700/80 hover:bg-slate-900 transition-all duration-300 shadow-md flex flex-col justify-between overflow-hidden cursor-pointer min-h-[195px] h-auto`;
        card.setAttribute('aria-label', `${book.title} by ${book.authors}`);
        card.onclick = () => this.openModal(book);

        const style = utils.getCategoryStyle(book.categories);
        const hours = Math.floor((book.length || 0) / 60);
        const mins = (book.length || 0) % 60;
        const lengthStr = `${hours > 0 ? hours + 'h ' : ''}${mins}m`;
        const volNum = book.seriesOrder ? book.seriesOrder.split(':')[0].trim() : '#';

        // Retrieve saved playback percentage
        const savedProgress = state.playbackProgressMap[bookId] || 0;

        let lazyBgAttribute = '';
        if (book.backgroundImage) {
            let imgPath = book.backgroundImage;
            if (!imgPath.startsWith('backgroundImage/') && !imgPath.startsWith('http://') && !imgPath.startsWith('https://') && !imgPath.startsWith('./')) {
                imgPath = 'backgroundImage/' + imgPath;
            }
            lazyBgAttribute = `data-lazy-cover="${imgPath}"`;
        }

        const overlayClass = book.backgroundImage 
            ? "absolute inset-0 bg-slate-950/45 group-hover:bg-slate-950/20 transition-colors" 
            : "absolute inset-0 bg-slate-950/10 group-hover:bg-slate-950/0 transition-colors";

        const catBadgeClass = "text-[8px] font-extrabold text-white bg-white/20 border border-white/20 px-1.5 py-0.5 rounded backdrop-blur-sm tracking-wider uppercase truncate max-w-full cursor-help";

        const seriesBadgeClass = book.backgroundImage
            ? "inline-block text-[13px] font-bold text-white bg-slate-950/80 border border-white/10 px-1.5 py-0.5 rounded shadow-sm tracking-tight truncate max-w-full"
            : "inline-block text-[13px] font-bold text-white/95 bg-brand-500/50 px-1.5 py-0.5 rounded shadow-sm tracking-tight truncate max-w-full";

        const categoriesHtml = book.categories 
            ? book.categories.split(';').map(c => `<span class="${catBadgeClass}" title="${c.trim()}">${c.trim()}</span>`).join(' ')
            : `<span class="${catBadgeClass}">AUDIOBOOK</span>`;

        card.innerHTML = `
            <div class="min-h-[120px] h-auto bg-gradient-to-br ${style.gradient} relative p-2.5 flex flex-col justify-between shrink-0" ${lazyBgAttribute} id="card-cover-${bookId}">
                <div class="${overlayClass}"></div>
                <div class="absolute -right-6 -bottom-6 w-16 h-16 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500"></div>

                <div class="flex justify-between items-start z-10 w-full gap-2 mb-3">
                    <div class="flex flex-wrap gap-1.5 max-w-[85%]">
                        ${categoriesHtml}
                    </div>
                    <!-- Indicator Badge showing if Completed -->
                    <div class="flex items-center gap-1.5 shrink-0">
                        ${isListened ? `
                            <div class="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg" title="Marked as completed">
                                <i data-lucide="check" class="w-3 h-3 stroke-[3px]"></i>
                            </div>
                        ` : ''}
                        <i data-lucide="${style.icon}" class="w-3.5 h-3.5 text-white drop-shadow-md shrink-0 mt-0.5"></i>
                    </div>
                </div>

                <div class="z-10 text-left w-full mt-auto">
                    ${book.series ? `<span class="${seriesBadgeClass}">${book.series}</span> <span class="${seriesBadgeClass}">Vol. ${volNum}</span>` : ''}
                </div>
            </div>

            <div class="p-2.5 flex-1 flex flex-col justify-between bg-slate-900/40 relative">
                <div class="space-y-0.5">
                    <h3 class="text-sm font-bold text-slate-100 group-hover:text-brand-500 transition-colors leading-tight line-clamp-1" title="${book.title}">
                        ${book.title}
                    </h3>
                    <p class="text-xs text-slate-400 font-medium truncate">By ${book.authors}</p>
                </div>

                <div class="mt-2.5 space-y-2">
                    <!-- Elegant visual progress tracker matching the list state -->
                    ${savedProgress > 0 ? `
                        <div class="space-y-1" title="Playback Progress: ${savedProgress}%">
                            <div class="flex justify-between text-[9px] text-slate-500">
                                <span>Progress</span>
                                <span class="font-mono text-brand-500 font-semibold">${savedProgress}%</span>
                            </div>
                            <div class="h-1 bg-slate-950 w-full rounded-full overflow-hidden">
                                <div class="bg-brand-500 h-full rounded-full" style="width: ${savedProgress}%"></div>
                            </div>
                        </div>
                    ` : ''}

                    <div class="flex items-center justify-between pt-1 border-t border-slate-800/40">
                        <span class="inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <i data-lucide="clock" class="w-3 h-3 text-slate-500"></i>
                            ${lengthStr}
                        </span>
                        <span class="inline-flex items-center gap-0.5 text-[11px] font-bold text-brand-500">
                            <i data-lucide="star" class="w-3 h-3 fill-brand-500 text-brand-500"></i>
                            ${book.ratingOverall ? book.ratingOverall.toFixed(1) : '--'}
                        </span>
                    </div>
                </div>
            </div>
        `;

        if (this.lazyObserver) {
            const coverBlock = card.querySelector(`#card-cover-${bookId}`);
            if (coverBlock && book.backgroundImage) {
                this.lazyObserver.observe(coverBlock);
            }
        }

        return card;
    },

    /**
     * Generates a sleek row item inside the data table containing headphones progress bars
     */
    createListRow: function(book) {
        const state = window.AudiobookApp.state;
        const utils = window.AudiobookApp.utils;
        const row = document.createElement('tr');

        const bookId = utils.getBookId(book);
        const isListened = state.listenedSet.has(bookId);
        const progressPercentage = state.playbackProgressMap[bookId] || 0;

        row.className = `${isListened ? 'bg-emerald-950/5 hover:bg-emerald-950/10' : 'hover:bg-slate-900/80'} transition-colors duration-150 cursor-pointer text-slate-300`;
        row.onclick = () => this.openModal(book);

        const hours = Math.floor((book.length || 0) / 60);
        const mins = (book.length || 0) % 60;
        const lengthStr = `${hours > 0 ? hours + 'h ' : ''}${mins}m`;

        row.innerHTML = `
            <td class="p-3">
                <div class="flex items-center gap-2">
                    <div class="w-1.5 h-6 rounded-full bg-gradient-to-b ${utils.getCategoryStyle(book.categories).gradient} shrink-0"></div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-semibold text-slate-100 block max-w-xs sm:max-w-md truncate text-xs sm:text-sm">${book.title}</span>
                            ${isListened ? `
                                <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] rounded-full font-bold">Listened</span>
                            ` : ''}
                        </div>
                        ${book.series ? `<span class="text-[9px] text-brand-500 font-medium block truncate">${book.series} #${book.seriesOrder ? book.seriesOrder.split(':')[0].trim() : ''}</span>` : ''}
                    </div>
                </div>
            </td>
            <td class="p-3 text-slate-400 max-w-[120px] truncate">By ${book.authors}</td>
            <td class="p-3">
                <!-- Custom embedded dynamic progress bar -->
                <div class="flex items-center gap-2.5 min-w-[100px]" title="${progressPercentage}% completed">
                    <div class="h-1.5 w-24 bg-slate-950 rounded-full overflow-hidden relative shrink-0">
                        <div class="bg-brand-500 h-full rounded-full transition-all duration-300" style="width: ${progressPercentage}%"></div>
                    </div>
                    <span class="text-[10px] text-slate-400 font-mono font-bold">${progressPercentage}%</span>
                </div>
            </td>
            <td class="p-3 text-center font-mono whitespace-nowrap text-slate-400">${lengthStr}</td>
            <td class="p-3 text-center">
                <span class="inline-flex items-center gap-0.5 text-brand-500 font-semibold font-mono">
                    <i data-lucide="star" class="w-3.5 h-3.5 fill-brand-500 text-brand-500 inline"></i>
                    ${book.ratingOverall ? book.ratingOverall.toFixed(1) : '--'}
                </span>
            </td>
            <td class="p-3 text-right">
                <button class="text-[10px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-md transition-colors text-slate-300">
                    Details
                </button>
            </td>
        `;
        return row;
    },

    /**
     * Interactively triggers column headers sorting within list view layouts
     */
    handleHeaderSort: function(field) {
        const state = window.AudiobookApp.state;
        let nextSort = '';
        if (field === 'title') {
            nextSort = (state.currentSort === 'title_asc') ? 'title_desc' : 'title_asc';
        } else if (field === 'author') {
            nextSort = (state.currentSort === 'author_asc') ? 'author_desc' : 'author_asc';
        } else if (field === 'progress') {
            nextSort = (state.currentSort === 'progress') ? 'rating_desc' : 'progress';
        } else if (field === 'length') {
            nextSort = (state.currentSort === 'length_desc') ? 'length_asc' : 'length_desc';
        } else if (field === 'rating') {
            nextSort = (state.currentSort === 'rating_desc') ? 'rating_asc' : 'rating_desc';
        }

        state.currentSort = nextSort;
        document.getElementById('sort-select').value = state.currentSort;
        this.render(true);
    },

    /**
     * Synchronizes sort icon elements safely. Overwrites sort containers completely
     * to eliminate Lucide SVG replacement collisions.
     */
    updateSortIcons: function() {
        const state = window.AudiobookApp.state;
        const fields = ['title', 'author', 'progress', 'length', 'rating'];

        // 1. Reset all containers with standard placeholder tags
        fields.forEach(f => {
            const container = document.getElementById(`sort-icon-container-${f}`);
            if (container) {
                container.innerHTML = `<i data-lucide="chevrons-up-down" class="w-3.5 h-3.5 text-slate-500 shrink-0"></i>`;
                lucide.createIcons({ node: container });
            }
        });

        let activeField = '';
        let isAsc = true;

        if (state.currentSort.startsWith('title')) {
            activeField = 'title';
            isAsc = state.currentSort === 'title_asc';
        } else if (state.currentSort.startsWith('author')) {
            activeField = 'author';
            isAsc = state.currentSort === 'author_asc';
        } else if (state.currentSort === 'progress') {
            activeField = 'progress';
            isAsc = false;
        } else if (state.currentSort.startsWith('length')) {
            activeField = 'length';
            isAsc = state.currentSort === 'length_asc';
        } else if (state.currentSort.startsWith('rating')) {
            activeField = 'rating';
            isAsc = state.currentSort === 'rating_asc';
        }

        // 2. Hydrate active column's icon container safely
        if (activeField) {
            const activeContainer = document.getElementById(`sort-icon-container-${activeField}`);
            if (activeContainer) {
                const iconName = isAsc ? 'chevron-up' : 'chevron-down';
                activeContainer.innerHTML = `<i data-lucide="${iconName}" class="w-3.5 h-3.5 text-brand-500 font-bold shrink-0"></i>`;
                lucide.createIcons({ node: activeContainer });
            }
        }
    },

    /**
     * Displays centering cinematic modal drawer details
     */
    openModal: function(book) {
        const state = window.AudiobookApp.state;
        const utils = window.AudiobookApp.utils;
        const modal = document.getElementById('detail-modal');
        const card = document.getElementById('modal-card');

        // Extract stable ID
        const bookId = utils.getBookId(book);

        const style = utils.getCategoryStyle(book.categories);
        const coverArt = document.getElementById('modal-cover-art');
        coverArt.className = `w-32 h-32 md:w-40 md:h-40 rounded-xl flex flex-col justify-between p-3.5 shrink-0 shadow-lg text-slate-950 bg-gradient-to-br ${style.gradient} relative overflow-hidden`;

        let coverImgStyle = '';
        if (book.backgroundImage) {
            let imgPath = book.backgroundImage;
            if (!imgPath.startsWith('backgroundImage/')) {
                imgPath = 'backgroundImage/' + imgPath;
            }
            coverImgStyle = `background-image: url('${imgPath}'); background-size: cover; background-position: center;`;
        }
        coverArt.style = coverImgStyle;

        // Cover visualizer interior with overlays cleaned up
        coverArt.innerHTML = `
            <div class="absolute inset-0 bg-slate-950/20"></div>
            <div class="z-10 flex flex-col justify-start h-full w-full">
                <i data-lucide="${style.icon}" class="w-7 h-7 text-white drop-shadow"></i>
            </div>
        `;

        const seriesBadge = document.getElementById('modal-series-badge');
        if (book.series) {
            seriesBadge.textContent = `${book.series} #${book.seriesOrder ? book.seriesOrder.split(':')[0].trim() : ''}`;
            seriesBadge.classList.remove('hidden');
        } else {
            seriesBadge.classList.add('hidden');
        }

        document.getElementById('modal-title').textContent = book.title;
        document.getElementById('modal-subtitle').textContent = book.subtitle || '';
        document.getElementById('modal-author').textContent = book.authors;
        document.getElementById('modal-narrator').textContent = book.narrators;
        document.getElementById('modal-publisher').textContent = book.publisher || 'N/A';
        document.getElementById('modal-published-date').textContent = book.datePublished || 'N/A';

        // Display subcategories inside modal
        const modalCatsList = document.getElementById('modal-categories-list');
        modalCatsList.innerHTML = '';
        if (book.categories) {
            book.categories.split(';').forEach(c => {
                const pill = document.createElement('span');
                pill.className = "text-[9px] font-bold text-brand-500 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full tracking-wide";
                pill.textContent = c.trim();
                modalCatsList.appendChild(pill);
            });
        }

        // Configure Play, Download, and Interactive "Listened" toggle button
        const actionSection = document.getElementById('modal-action-section');
        if (book.bookFile) {
            actionSection.classList.remove('hidden');

            const playBtn = document.getElementById('modal-play-btn');
            playBtn.onclick = (e) => {
                e.stopPropagation();
                window.AudiobookApp.main.playAudioFile(book);
            };

            const downloadBtn = document.getElementById('modal-download-btn');
            let filePath = book.bookFile;
            if (!filePath.startsWith('bookFiles/')) {
                filePath = 'bookFiles/' + filePath;
            }
            downloadBtn.href = filePath;
        } else {
            actionSection.classList.add('hidden');
        }

        // Listened Toggle setup inside modal (Fixed to prevent querySelector null references)
        const listenedBtn = document.getElementById('modal-listened-btn');
        const updateListenedButtonUI = () => {
            const isCompleted = state.listenedSet.has(bookId);
            const iconName = isCompleted ? 'check-circle' : 'check';
            const btnText = isCompleted ? 'Completed' : 'Mark Completed';

            if (isCompleted) {
                listenedBtn.className = "w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-md active:scale-95";
            } else {
                listenedBtn.className = "w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-all border border-slate-700 shadow-sm active:scale-95";
            }

            // Overwriting absolute inner markup template prevents querySelector reference bugs
            listenedBtn.innerHTML = `<i data-lucide="${iconName}" class="w-3.5 h-3.5"></i> <span>${btnText}</span>`;
            lucide.createIcons({ node: listenedBtn });
        };
        updateListenedButtonUI();

        listenedBtn.onclick = (e) => {
            e.stopPropagation();
            state.toggleListened(bookId);
            updateListenedButtonUI();
            this.updateStats();
            this.render();
        };

        const hours = Math.floor((book.length || 0) / 60);
        const mins = (book.length || 0) % 60;
        document.getElementById('modal-duration').textContent = `${hours}h ${mins}m`;

        document.getElementById('modal-rating-overall').textContent = book.ratingOverall ? book.ratingOverall.toFixed(2) : '--';
        document.getElementById('modal-rating-story').textContent = book.ratingStory ? book.ratingStory.toFixed(2) : '--';
        document.getElementById('modal-rating-perf').textContent = book.ratingPerformance ? book.ratingPerformance.toFixed(2) : '--';

        document.getElementById('modal-description').innerHTML = book.description || '<p class="text-slate-500 italic">No publisher description sync available.</p>';

        modal.classList.remove('pointer-events-none');
        modal.classList.add('opacity-100');
        card.classList.remove('scale-95');
        card.classList.add('scale-100');

        lucide.createIcons({ node: modal });
    },

    closeModal: function() {
        const modal = document.getElementById('detail-modal');
        const card = document.getElementById('modal-card');

        modal.classList.remove('opacity-100');
        modal.classList.add('pointer-events-none');
        card.classList.add('scale-95');
        card.classList.remove('scale-100');
    },

    setLayout: function(layout) {
        const state = window.AudiobookApp.state;
        state.currentLayout = layout;

        const gridBtn = document.getElementById('view-grid');
        const listBtn = document.getElementById('view-list');

        if (layout === 'grid') {
            gridBtn.className = "flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-500 text-xs transition-all";
            listBtn.className = "flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 text-xs transition-all hover:bg-slate-900 hover:text-slate-200";
        } else {
            listBtn.className = "flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-500 text-xs transition-all";
            gridBtn.className = "flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 text-xs transition-all hover:bg-slate-900 hover:text-slate-200";
        }
        this.render(true);
    }
};
