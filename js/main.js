/**
 * Audiobook Library Main Application Entry Point
 * Orchestrates network fetches, event listeners, and live playback synchronization.
 */
window.AudiobookApp = window.AudiobookApp || {};

window.AudiobookApp.main = {
    activeAudio: null,
    isDraggingScrub: false,

    /**
     * Initializes global event mappings and initiates data loads
     */
    init: function() {
        const state = window.AudiobookApp.state;
        const ui = window.AudiobookApp.ui;
        const utils = window.AudiobookApp.utils;

        lucide.createIcons();
        state.initPersistence();
        ui.initObservers();
        this.activeAudio = document.getElementById('main-audio');

        this.bindEvents();
        this.attemptAutoFetch();
    },

    bindEvents: function() {
        const state = window.AudiobookApp.state;
        const ui = window.AudiobookApp.ui;
        const utils = window.AudiobookApp.utils;

        // Debounced search trigger (prevents micro-stuttering)
        const handleSearchInput = utils.debounce((e) => {
            state.searchQuery = e.target.value.toLowerCase().trim();
            ui.updateFilterBadges();
            ui.render(true);
        }, 150);
        document.getElementById('search-input').addEventListener('input', handleSearchInput);

        document.getElementById('sort-select').addEventListener('change', (e) => {
            state.currentSort = e.target.value;
            ui.render(true);
        });

        document.getElementById('category-filter').addEventListener('change', (e) => {
            state.activeCategory = e.target.value;
            ui.updateFilterBadges();
            ui.render(true);
        });

        document.getElementById('narrator-filter').addEventListener('change', (e) => {
            state.activeNarrator = e.target.value;
            ui.updateFilterBadges();
            ui.render(true);
        });

        document.getElementById('view-grid').addEventListener('click', () => ui.setLayout('grid'));
        document.getElementById('view-list').addEventListener('click', () => ui.setLayout('list'));

        // Series Grouping Toggle Action
        const groupBtn = document.getElementById('group-series-btn');
        groupBtn.addEventListener('click', () => {
            state.groupBySeries = !state.groupBySeries;
            if (state.groupBySeries) {
                groupBtn.className = "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-500 text-xs transition-all w-full sm:w-auto shrink-0";
            } else {
                groupBtn.className = "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 text-xs transition-all hover:bg-slate-900 hover:text-slate-200 w-full sm:w-auto shrink-0";
            }
            ui.render(true);
        });

        document.getElementById('clear-filters-btn').addEventListener('click', () => utils.resetFilters());

        // Dynamic viewport scroll sentinel observer (Infinite Progressive Scroll)
        const progressiveSentinel = document.getElementById('progressive-sentinel');
        if ('IntersectionObserver' in window && progressiveSentinel) {
            const sentinelObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const filtered = utils.getFilteredAndSortedData();
                    if (entry.isIntersecting && state.renderedCount < filtered.length) {
                        const spinner = document.getElementById('sentinel-spinner');
                        spinner.classList.remove('hidden');

                        // Render next batch
                        setTimeout(() => {
                            state.renderedCount += state.batchSize;
                            ui.render(false);
                        }, 250);
                    }
                });
            }, { rootMargin: "150px" });
            sentinelObserver.observe(progressiveSentinel);
        }

        // Setup Floating Audio Player Actions
        this.setupAudioPlayerEvents();
    },

    setupAudioPlayerEvents: function() {
        const state = window.AudiobookApp.state;
        const utils = window.AudiobookApp.utils;
        const ui = window.AudiobookApp.ui;

        const playerBar = document.getElementById('floating-audio-player');
        const playBtn = document.getElementById('player-play-btn');
        const prevBtn = document.getElementById('player-prev-btn');
        const nextBtn = document.getElementById('player-next-btn');
        const closeBtn = document.getElementById('player-close-btn');
        const progressBar = document.getElementById('player-progress-bar');
        const progressContainer = document.getElementById('player-progress-container');
        const currentTimeEl = document.getElementById('player-current-time');
        const durationEl = document.getElementById('player-duration');

        const updatePlayIconUI = () => {
            const isPaused = this.activeAudio.paused;
            const iconName = isPaused ? 'play' : 'pause';
            playBtn.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 fill-slate-950" id="player-play-icon"></i>`;
            lucide.createIcons({ node: playBtn });
        };

        playBtn.addEventListener('click', () => {
            if (this.activeAudio.paused) {
                this.activeAudio.play()
                    .then(updatePlayIconUI)
                    .catch(err => console.error("Playback error:", err));
            } else {
                this.activeAudio.pause();
                updatePlayIconUI();
            }
        });

        // Time updates: updates playback map and synchronizes progress bars
        this.activeAudio.addEventListener('timeupdate', () => {
            if (this.activeAudio.duration && !this.isDraggingScrub) {
                const percent = (this.activeAudio.currentTime / this.activeAudio.duration) * 100;
                progressBar.style.width = `${percent}%`;
                currentTimeEl.textContent = utils.formatTime(this.activeAudio.currentTime);
                durationEl.textContent = utils.formatTime(this.activeAudio.duration);

                // Instantly update local progress map
                if (state.currentPlayingBook) {
                    const bookId = utils.getBookId(state.currentPlayingBook);
                    state.updatePlaybackProgress(bookId, percent);

                    // Locate table row and cards containing targeted data attribute elements
                    const matchedElements = document.querySelectorAll(`[data-book-id="${bookId}"]`);
                    matchedElements.forEach(element => {
                        const progressIndicator = element.querySelector('.bg-brand-500');
                        const progressLabel = element.querySelector('.font-mono');
                        if (progressIndicator) {
                            progressIndicator.style.width = `${Math.round(percent)}%`;
                        }
                        if (progressLabel) {
                            progressLabel.textContent = `${Math.round(percent)}%`;
                        }
                    });
                }
            }
        });

        // Draggable Progress Scrubbing calculations
        const handleScrub = (clientX) => {
            const rect = progressContainer.getBoundingClientRect();
            const clickX = clientX - rect.left;
            const width = rect.width;
            if (this.activeAudio.duration) {
                const targetPercentage = Math.min(100, Math.max(0, clickX / width));
                progressBar.style.width = `${targetPercentage * 100}%`;
                currentTimeEl.textContent = utils.formatTime(targetPercentage * this.activeAudio.duration);
                return targetPercentage;
            }
            return 0;
        };

        progressContainer.addEventListener('mousedown', (e) => {
            this.isDraggingScrub = true;
            const pct = handleScrub(e.clientX);

            const onMouseMove = (moveEvent) => {
                handleScrub(moveEvent.clientX);
            };

            const onMouseUp = (upEvent) => {
                this.isDraggingScrub = false;
                const finalPct = handleScrub(upEvent.clientX);
                if (this.activeAudio.duration) {
                    this.activeAudio.currentTime = finalPct * this.activeAudio.duration;
                }
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Touch scrubbing support for mobile devices
        progressContainer.addEventListener('touchstart', (e) => {
            this.isDraggingScrub = true;
            handleScrub(e.touches[0].clientX);

            const onTouchMove = (moveEvent) => {
                handleScrub(moveEvent.touches[0].clientX);
            };

            const onTouchEnd = () => {
                this.isDraggingScrub = false;
                const currentWidth = parseFloat(progressBar.style.width) / 100;
                if (this.activeAudio.duration) {
                    this.activeAudio.currentTime = currentWidth * this.activeAudio.duration;
                }
                document.removeEventListener('touchmove', onTouchMove);
                document.removeEventListener('touchend', onTouchEnd);
            };

            document.addEventListener('touchmove', onTouchMove, { passive: true });
            document.addEventListener('touchend', onTouchEnd);
        }, { passive: true });

        prevBtn.addEventListener('click', () => {
            this.activeAudio.currentTime = Math.max(0, this.activeAudio.currentTime - 30);
        });

        nextBtn.addEventListener('click', () => {
            if (this.activeAudio.duration) {
                this.activeAudio.currentTime = Math.min(this.activeAudio.duration, this.activeAudio.currentTime + 30);
            }
        });

        closeBtn.addEventListener('click', () => {
            this.activeAudio.pause();
            state.currentPlayingBook = null;
            playerBar.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
            ui.updateStats();
            ui.render();
        });

        // Close modal when background overlay is clicked
        document.getElementById('detail-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('detail-modal')) {
                ui.closeModal();
            }
        });
    },

    /**
     * Attempts loading local JSON catalog database
     */
    attemptAutoFetch: function() {
        const state = window.AudiobookApp.state;
        const ui = window.AudiobookApp.ui;

        const loadingState = document.getElementById('loading-state');
        const errorState = document.getElementById('error-state');

        fetch('library.json')
            .then(res => {
                if (!res.ok) throw new Error("File fetch failure on local library");
                return res.json();
            })
            .then(data => {
                loadingState.classList.add('hidden');
                state.libraryData = data;

                // Unhide the dashboard UI elements
                document.getElementById('dashboard-content').classList.remove('hidden');

                this.initFiltersAndSelectors();
                ui.updateStats();
                ui.render(true);
            })
            .catch(err => {
                console.error("Local library lookup failed.", err);
                loadingState.classList.add('hidden');
                errorState.classList.remove('hidden');
            });
    },

    initFiltersAndSelectors: function() {
        const state = window.AudiobookApp.state;

        // Extract genres dynamically
        const categoriesSet = new Set();
        const narratorsSet = new Set();

        state.libraryData.forEach(book => {
            if (book.categories) {
                book.categories.split(';').forEach(cat => categoriesSet.add(cat.trim()));
            }
            if (book.narrators) {
                book.narrators.split(',').forEach(nar => narratorsSet.add(nar.trim()));
            }
        });

        const categorySelect = document.getElementById('category-filter');
        categorySelect.innerHTML = '<option value="all">All Categories</option>';
        Array.from(categoriesSet).sort().forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            categorySelect.appendChild(opt);
        });

        const narratorSelect = document.getElementById('narrator-filter');
        narratorSelect.innerHTML = '<option value="all">All Narrators</option>';
        Array.from(narratorsSet).sort().forEach(nar => {
            const opt = document.createElement('option');
            opt.value = nar;
            opt.textContent = nar;
            narratorSelect.appendChild(opt);
        });
    },

    /**
     * Activates live playback streams inside the floating custom player bar
     */
    playAudioFile: function(book) {
        const state = window.AudiobookApp.state;
        const utils = window.AudiobookApp.utils;

        const playerBar = document.getElementById('floating-audio-player');
        const playerTitle = document.getElementById('player-title');
        const playerAuthor = document.getElementById('player-author');
        const playBtn = document.getElementById('player-play-btn');

        let filePath = book.bookFile;
        if (!filePath.startsWith('bookFiles/') && !filePath.startsWith('http://') && !filePath.startsWith('https://') && !filePath.startsWith('./')) {
            filePath = 'bookFiles/' + filePath;
        }

        if (state.currentPlayingBook !== book) {
            state.currentPlayingBook = book;
            this.activeAudio.src = filePath;
            playerTitle.textContent = book.title;
            playerAuthor.textContent = book.authors;

            // Align custom floating player background to active audio style
            const style = utils.getCategoryStyle(book.categories);
            const playerCover = document.getElementById('player-cover');
            playerCover.className = `w-10 h-10 rounded-lg bg-gradient-to-br ${style.gradient} shrink-0 flex items-center justify-center text-slate-950 font-bold text-xs shadow-md`;
            playerCover.innerHTML = `<i data-lucide="${style.icon}" class="w-5 h-5 text-white"></i>`;
            lucide.createIcons({ node: playerCover });
        }

        const updatePlayIconUI = () => {
            const isPaused = this.activeAudio.paused;
            const iconName = isPaused ? 'play' : 'pause';
            playBtn.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 fill-slate-950" id="player-play-icon"></i>`;
            lucide.createIcons({ node: playBtn });
        };

        if (this.activeAudio.paused) {
            this.activeAudio.play()
                .then(updatePlayIconUI)
                .catch(err => {
                    console.error("Playback interrupted:", err);
                    alert("Unable to play audiobook file. Please confirm the file exists inside your 'bookFiles/' directory path.");
                });
        } else {
            this.activeAudio.pause();
            updatePlayIconUI();
        }

        playerBar.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
    }
};

// Start application
window.addEventListener('DOMContentLoaded', () => {
    window.AudiobookApp.main.init();
});
