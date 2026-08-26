/**
 * Audiobook Library State Module
 * Initializes namespace, manages reactivity, and local storage bindings.
 * Creates the unified global singleton namespace and encapsulates the state fields, default configurations, and localStorage synchronization pipelines.
 */
window.AudiobookApp = window.AudiobookApp || {};

window.AudiobookApp.state = {
    // Primary collection storage
    libraryData: [],
    
    // Playback state variables
    currentPlayingBook: null,
    isPlaying: false,

    // Layout/Viewing flags
    currentLayout: 'grid', // 'grid' | 'list'
    activeCategory: 'all',
    activeNarrator: 'all',
    searchQuery: '',
    currentSort: 'rating_desc',
    groupBySeries: false,

    // High-performance scroll rendering limits (Sentinel Batch pagination)
    renderedCount: 40,
    batchSize: 40,

    // Interactive tracking arrays (Hydrated from persistent LocalStorage)
    listenedSet: new Set(),
    playbackProgressMap: {}, // Maps bookId -> percent int [0-100]

    /**
     * Loads the persistence layers safely
     */
    initPersistence: function() {
        try {
            const savedListened = localStorage.getItem('ab_listened_list');
            if (savedListened) {
                const parsed = JSON.parse(savedListened);
                this.listenedSet = new Set(parsed);
            }
            const savedProgress = localStorage.getItem('ab_playback_progress_map');
            if (savedProgress) {
                this.playbackProgressMap = JSON.parse(savedProgress);
            }
        } catch (e) {
            console.error("Failed to read progress storage layers:", e);
        }
    },

    /**
     * Toggles the listened state of a specific audiobook ID
     */
    toggleListened: function(bookId) {
        if (this.listenedSet.has(bookId)) {
            this.listenedSet.delete(bookId);
            // If marked unlistened, reset progress mapping if complete
            if (this.playbackProgressMap[bookId] === 100) {
                delete this.playbackProgressMap[bookId];
            }
        } else {
            this.listenedSet.add(bookId);
            this.playbackProgressMap[bookId] = 100; // Complete progress
        }
        this.savePersistence();
    },

    /**
     * Updates playback progress mapping dynamically
     */
    updatePlaybackProgress: function(bookId, percent) {
        const value = Math.min(100, Math.max(0, Math.round(percent)));
        this.playbackProgressMap[bookId] = value;
        if (value === 100) {
            this.listenedSet.add(bookId);
        }
        this.savePersistence();
    },

    /**
     * Persists local changes to storage engine
     */
    savePersistence: function() {
        try {
            localStorage.setItem('ab_listened_list', JSON.stringify(Array.from(this.listenedSet)));
            localStorage.setItem('ab_playback_progress_map', JSON.stringify(this.playbackProgressMap));
        } catch (e) {
            console.error("Failed to write to LocalStorage:", e);
        }
    }
};
