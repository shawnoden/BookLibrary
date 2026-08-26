/**
 * Audiobook Library Utilities Module
 * Encapsulates sorting algorithms, categorizers, and calculation helpers.
 * Implements math conversions, deep search queries, data sorting formulas, and dynamic filter structures.
 */
window.AudiobookApp = window.AudiobookApp || {};

window.AudiobookApp.utils = {
    // Map genres directly to high-contrast cinematic visual styles
    categoryStyles: {
        "Adventure": { gradient: "from-amber-600 to-yellow-500", icon: "compass" },
        "Science Fiction": { gradient: "from-cyan-600 to-blue-600", icon: "rocket" },
        "Hard Science Fiction": { gradient: "from-sky-700 to-indigo-800", icon: "orbit" },
        "Post-Apocalyptic": { gradient: "from-red-900 to-stone-700", icon: "skull" },
        "Dystopian": { gradient: "from-zinc-800 to-orange-950", icon: "shield-alert" },
        "Fantasy": { gradient: "from-purple-800 to-violet-600", icon: "wand-2" },
        "Space Opera": { gradient: "from-slate-900 via-indigo-950 to-slate-900", icon: "sparkles" },
        "Default": { gradient: "from-brand-600 to-amber-600", icon: "headphones" }
    },

    /**
     * Safely resolve gradients and icons by categorizer strings
     */
    getCategoryStyle: function(catString) {
        if (!catString) return this.categoryStyles.Default;
        const primaryCat = catString.split(';')[0].trim();
        return this.categoryStyles[primaryCat] || this.categoryStyles.Default;
    },

    /**
     * Formatting helper converting seconds into highly readable HH:MM:SS text
     */
    formatTime: function(secs) {
        if (isNaN(secs)) return "0:00";
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        const formattedS = s < 10 ? '0' + s : s;
        if (h > 0) {
            const formattedM = m < 10 ? '0' + m : m;
            return `${h}:${formattedM}:${formattedS}`;
        }
        return `${m}:${formattedS}`;
    },

    /**
     * Debounces expensive rendering calls (like keystroke search checks)
     */
    debounce: function(func, delay) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
        };
    },

    /**
     * Resets navigation inputs back to base parameters
     */
    resetFilters: function() {
        const state = window.AudiobookApp.state;
        state.searchQuery = '';
        state.activeCategory = 'all';
        state.activeNarrator = 'all';
        state.currentSort = 'rating_desc';
        state.groupBySeries = false;

        document.getElementById('search-input').value = '';
        document.getElementById('category-filter').value = 'all';
        document.getElementById('narrator-filter').value = 'all';
        document.getElementById('sort-select').value = 'rating_desc';

        const groupBtn = document.getElementById('group-series-btn');
        groupBtn.className = "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 text-xs transition-all hover:bg-slate-900 hover:text-slate-200 w-full sm:w-auto shrink-0";

        window.AudiobookApp.ui.updateFilterBadges();
        window.AudiobookApp.ui.render(true);
    },

    /**
     * Numerically parses series track integers (or floats like 1.5)
     */
    getSeriesNumber: function(seriesOrder) {
        if (!seriesOrder) return 999;
        const match = seriesOrder.match(/[\d.]+/);
        return match ? parseFloat(match[0]) : 999;
    },

    /**
     * Executes filters and dynamic array sorts across the loaded dataset
     */
    getFilteredAndSortedData: function() {
        const state = window.AudiobookApp.state;
        
        // 1. Run Filters
        let filtered = state.libraryData.filter(book => {
            let matchesCategory = true;
            if (state.activeCategory !== 'all') {
                matchesCategory = book.categories && book.categories.split(';').map(c => c.trim()).includes(state.activeCategory);
            }

            let matchesNarrator = true;
            if (state.activeNarrator !== 'all') {
                matchesNarrator = book.narrators && book.narrators.split(',').map(n => n.trim()).includes(state.activeNarrator);
            }

            let matchesSearch = true;
            if (state.searchQuery) {
                matchesSearch = (
                    book.title.toLowerCase().includes(state.searchQuery) ||
                    (book.subtitle && book.subtitle.toLowerCase().includes(state.searchQuery)) ||
                    book.authors.toLowerCase().includes(state.searchQuery) ||
                    book.narrators.toLowerCase().includes(state.searchQuery) ||
                    (book.series && book.series.toLowerCase().includes(state.searchQuery)) ||
                    (book.publisher && book.publisher.toLowerCase().includes(state.searchQuery))
                );
            }

            return matchesCategory && matchesNarrator && matchesSearch;
        });

        // 2. Run Sorters
        filtered.sort((a, b) => {
            const progressA = state.playbackProgressMap[a.asin] || 0;
            const progressB = state.playbackProgressMap[b.asin] || 0;

            switch (state.currentSort) {
                case 'rating_desc':
                    return (b.ratingOverall || 0) - (a.ratingOverall || 0);
                case 'rating_asc':
                    return (a.ratingOverall || 0) - (b.ratingOverall || 0);
                case 'length_desc':
                    return (b.length || 0) - (a.length || 0);
                case 'length_asc':
                    return (a.length || 0) - (b.length || 0);
                case 'title_asc':
                    return a.title.localeCompare(b.title);
                case 'title_desc':
                    return b.title.localeCompare(a.title);
                case 'author_asc':
                    return a.authors.localeCompare(b.authors);
                case 'author_desc':
                    return b.authors.localeCompare(a.authors);
                case 'narrator_asc':
                    return a.narrators.localeCompare(b.narrators);
                case 'narrator_desc':
                    return b.narrators.localeCompare(a.narrators);
                case 'progress':
                    return progressB - progressA;
                case 'published':
                    return new Date(b.datePublished || 0) - new Date(a.datePublished || 0);
                default:
                    return 0;
            }
        });

        return filtered;
    }
};
