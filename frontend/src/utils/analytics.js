class Analytics {
    constructor() {
        this.events = [];
        this.sessionStart = Date.now();
    }

    track(event, data = {}) {
        const eventData = {
            event,
            data,
            timestamp: Date.now(),
            sessionTime: Date.now() - this.sessionStart,
            url: window.location.pathname,
            userAgent: navigator.userAgent
        };
        
        this.events.push(eventData);
        console.log('📊 Analytics:', eventData);
        
        // Optionnel: envoyer au backend
        // this.sendToBackend(eventData);
    }

    // Événements spécifiques Spotails
    trackCocktailView(cocktailId, cocktailName) {
        this.track('cocktail_view', { cocktailId, cocktailName });
    }

    trackSpotifyPlaylistCreated(cocktailId, playlistId) {
        this.track('spotify_playlist_created', { cocktailId, playlistId });
    }

    trackMusicPreview(trackId, trackName, cocktailId) {
        this.track('music_preview_played', { trackId, trackName, cocktailId });
    }

    trackFavoriteToggle(cocktailId, action) {
        this.track('favorite_toggle', { cocktailId, action });
    }

    trackSearch(query, resultsCount) {
        this.track('search_performed', { query, resultsCount });
    }

    trackUnifiedSearch(query, mode, count) {
        this.track('navbar_search', { query, mode, results: count });
    }

    getSessionSummary() {
        return {
            duration: Date.now() - this.sessionStart,
            eventsCount: this.events.length,
            uniqueCocktails: [...new Set(this.events
                .filter(e => e.event === 'cocktail_view')
                .map(e => e.data.cocktailId))].length,
            playlistsCreated: this.events.filter(e => e.event === 'spotify_playlist_created').length
        };
    }
}

export const analytics = new Analytics();