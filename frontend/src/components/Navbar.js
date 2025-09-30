import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { jwtDecode }from 'jwt-decode';
import axios from '../axiosConfig';
import useDebounce from '../hooks/useDebounce';
import { analytics } from '../utils/analytics';
import '../styles/Navbar.css';

// Composant UserMenu déroulant
const UserMenu = ({ username, isAdmin, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('spotails-theme') !== 'light';
  });
  const [audioAutoPlay, setAudioAutoPlay] = useState(() => {
    return localStorage.getItem('spotails-audio-autoplay') === 'true';
  });
  
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    // helper to avoid layout shift when hiding scrollbar
    const setBodyNoScroll = (enable) => {
      if (enable) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
          document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setBodyNoScroll(true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      setBodyNoScroll(false);
    };
  }, [isOpen]);

  // Gestion du thème
  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('spotails-theme', theme);
    
    // Application du thème sans affecter la navbar
    if (darkMode) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
      // Préserver les styles navbar
      document.documentElement.style.setProperty('--navbar-bg', '#121212');
      document.documentElement.style.setProperty('--navbar-border', 'rgba(255, 255, 255, 0.1)');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
      // Mode clair MAIS navbar reste sombre
      document.documentElement.style.setProperty('--navbar-bg', '#121212');
      document.documentElement.style.setProperty('--navbar-border', 'rgba(255, 255, 255, 0.1)');
    }
  }, [darkMode]);

  // Gestion audio
  useEffect(() => {
    localStorage.setItem('spotails-audio-autoplay', String(audioAutoPlay));
    // Application globale de l'autoplay
    window.spotailsAudioAutoPlay = audioAutoPlay;
  }, [audioAutoPlay]);

  const toggleTheme = () => {
    setDarkMode(prev => !prev);
  };

  const toggleAudioAutoPlay = () => {
    setAudioAutoPlay(prev => !prev);
  };

  const getInitials = (name) => {
    return name ? name.substring(0, 2).toUpperCase() : 'U';
  };

  return (
    <div className="user-menu-container" ref={menuRef}>
      {/* Trigger Button */}
      <button
        className={`user-menu-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="user-avatar">
          <span className="avatar-text">{getInitials(username)}</span>
          <div className="avatar-status"></div>
        </div>
        <span className="user-name">{username}</span>
        <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'} chevron-icon`}></i>
      </button>

      {/* Backdrop */}
      {isOpen && <div className="menu-backdrop" onClick={() => setIsOpen(false)}></div>}

      {/* Enhanced Dropdown Menu - MODIFIÉ: largeur ajustée */}
      <div className={`user-dropdown-menu premium ${isOpen ? 'open' : ''}`}>
        {/* Header avec informations utilisateur */}
        <div className="dropdown-header">
          <div className="user-profile-section">
            <div className="user-avatar-large">
              <span className="avatar-text-large">{getInitials(username)}</span>
              <div className="avatar-glow"></div>
            </div>
            <div className="user-info-detailed">
              <h3 className="user-name-display">{username}</h3>
              <div className="user-badges">
                {isAdmin && <span className="badge admin-badge">Administrateur</span>}
                <span className="badge member-badge">Utilisateur</span>
              </div>
              <div className="user-stats">
                <div className="stat-item">
                  <i className="bi bi-music-note"></i>
                  <span>47 favoris</span>
                </div>
                <div className="stat-item">
                  <i className="bi bi-collection-play"></i>
                  <span>12 playlists</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation principale */}
        <div className="dropdown-section">
          <div className="section-title">Navigation</div>
          <Link 
            to="/account" 
            className="dropdown-item premium-item"
            onClick={() => setIsOpen(false)}
          >
            <div className="item-icon">
              <i className="bi bi-person-gear"></i>
            </div>
            <div className="item-content">
              <span className="item-title">Mon Compte</span>
              <span className="item-subtitle">Gérer mes informations</span>
            </div>
            <i className="bi bi-arrow-right item-arrow"></i>
          </Link>

          <Link 
            to="/favorite-tracks" 
            className="dropdown-item premium-item"
            onClick={() => setIsOpen(false)}
          >
            <div className="item-icon">
              <i className="bi bi-heart-fill"></i>
            </div>
            <div className="item-content">
              <span className="item-title">Mes Favoris</span>
              <span className="item-subtitle">Sons et playlists</span>
            </div>
            <i className="bi bi-arrow-right item-arrow"></i>
          </Link>
        </div>

        {/* Section Admin - MODIFIÉ: couleur violette */}
        {isAdmin && (
          <div className="dropdown-section admin-section">
            <div className="section-title admin-title">
              <i className="bi bi-shield-check"></i>
              Administration
            </div>
            <Link 
              to="/admin" 
              className="dropdown-item admin-item"
              onClick={() => setIsOpen(false)}
            >
              <div className="item-icon admin-icon">
                <i className="bi bi-gear-fill"></i>
              </div>
              <div className="item-content">
                <span className="item-title">Dashboard Admin</span>
                <span className="item-subtitle">Gérer l'application</span>
              </div>
              <i className="bi bi-arrow-right item-arrow"></i>
            </Link>
          </div>
        )}

        {/* Section Paramètres - supprimée (Apparence / Lecture automatique retirées) */}

        {/* Footer avec déconnexion */}
        <div className="dropdown-footer">
          <button 
            onClick={() => { setIsOpen(false); onLogout(); }}
            className="logout-button"
          >
            <i className="bi bi-box-arrow-right"></i>
            <span>Déconnexion</span>
          </button>
          <div className="version-info">Spotails v2.0.1</div>
        </div>
      </div>
    </div>
  );
};

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const username = localStorage.getItem("username");
    const token = localStorage.getItem("token");
    const isAuthenticated = !!localStorage.getItem("token");

    // États pour la recherche - MODIFIÉ: initialiser depuis localStorage
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMode, setSearchMode] = useState(() => {
        return localStorage.getItem('spotails-search-mode') || "tracks";
    });
    const [autoPlayPreview, setAutoPlayPreview] = useState(() => {
        return localStorage.getItem('spotails-auto-play') === 'true';
    });
    const [onlyWithPreview, setOnlyWithPreview] = useState(() => {
        return localStorage.getItem('spotails-only-preview') === 'true';
    });
    // nombre de résultats de tracks chargés (utilisé dans la recherche)
    const [trackLimit, setTrackLimit] = useState(10);
    const [selectedTracks, setSelectedTracks] = useState([]);
    const [favoriteTracks, setFavoriteTracks] = useState([]);
    const [loadingFavorites, setLoadingFavorites] = useState(false);
    const [playlistName, setPlaylistName] = useState("");
    const [creatingPlaylist, setCreatingPlaylist] = useState(false);

    const audioRef = useRef(null);
    const [playingTrackId, setPlayingTrackId] = useState(null);

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Correction de la vérification admin - IMPORTANT
    let isAdmin = false;
    if (token) {
        try {
            const decodedToken = jwtDecode(token);
            isAdmin = decodedToken.role === "admin";
            // Mise à jour du localStorage pour cohérence
            localStorage.setItem("isAdmin", String(isAdmin));
        } catch (error) {
            console.error("Token invalide:", error);
            localStorage.setItem("isAdmin", "false");
        }
    }

    useEffect(() => {
        const checkRole = async () => {
            try {
                const res = await axios.get("/users/me");
                if (res.data.role !== jwtDecode(token).role) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("username");
                    navigate("/login");
                    window.location.reload();
                }
            } catch (err) {
                localStorage.removeItem("token");
                localStorage.removeItem("username");
                navigate("/login");
                window.location.reload();
            }
        };

        if (token) {
            checkRole();
        }
    }, [token, navigate]);

    const formatDuration = (ms = 0) => {
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const popularityBar = (p = 0) => (
        <div className="popularity-bar">
            <div className="popularity-fill" style={{ width: `${p}%` }} />
        </div>
    );

    const loadFavoriteTracks = async () => {
        if (loadingFavorites) return;
        try {
            setLoadingFavorites(true);
            const res = await axios.get("/spotify/favorite-tracks");
            setFavoriteTracks(res.data || []);
        } catch (e) {
            console.warn("Fav tracks load error", e);
        } finally {
            setLoadingFavorites(false);
        }
    };

    const isFavoriteTrack = (id) => favoriteTracks.some(f => f.trackId === id);

    // remplacé/complété : toggleFavoriteTrack
    const toggleFavoriteTrack = async (track) => {
        try {
            // enregistrer la recherche courante dans l'historique si présente
            if (searchQuery && searchQuery.trim()) addToHistory(searchQuery);

            if (isFavoriteTrack(track.id)) {
                await axios.delete(`/spotify/favorite-tracks/${track.id}`);
                setFavoriteTracks(prev => prev.filter(f => f.trackId !== track.id));
            } else {
                await axios.post("/spotify/favorite-tracks", {
                    trackId: track.id,
                    trackName: track.name,
                    artistName: track.artists?.[0]?.name,
                    previewUrl: track.preview_url,
                    spotifyUrl: track.external_urls?.spotify,
                    albumImage: track.album?.images?.[1]?.url
                });
                loadFavoriteTracks();
            }
        } catch (e) {
            console.error("Fav toggle err", e);
        }
    };

    const toggleSelectTrack = (track) => {
        setSelectedTracks(prev =>
            prev.find(t => t.id === track.id)
                ? prev.filter(t => t.id !== track.id)
                : [...prev, track]
        );
    };

    const clearSelection = () => setSelectedTracks([]);

    const createCustomPlaylist = async () => {
        if (!selectedTracks.length) return;
        setCreatingPlaylist(true);
        try {
            const payload = {
                name: playlistName || `Spotails Mix (${selectedTracks.length} titres)`,
                tracks: selectedTracks.map(t => ({ id: t.id }))
            };
            const res = await axios.post("/spotify/create-custom-playlist", payload);
            alert("Playlist créée !");
            analytics.track("playlist_created_from_nav", { count: selectedTracks.length });
            setSelectedTracks([]);
            setPlaylistName("");
            if (res.data?.playlist?.external_urls?.spotify) {
                window.open(res.data.playlist.external_urls.spotify, "_blank", "noopener");
            }
        } catch (e) {
            console.error(e);
            alert("Erreur création playlist");
        } finally {
            setCreatingPlaylist(false);
        }
    };

    // remplacé/complété : playPreview
    const playPreview = (track) => {
        // enregistrer la recherche courante dans l'historique si présente
        if (searchQuery && searchQuery.trim()) addToHistory(searchQuery);

        if (!track.preview_url) return;
        if (!audioRef.current) return;
        if (playingTrackId === track.id) {
            audioRef.current.pause();
            setPlayingTrackId(null);
            return;
        }
        audioRef.current.src = track.preview_url;
        audioRef.current.play().then(() => {
            setPlayingTrackId(track.id);
            analytics.trackMusicPreview(track.id, track.name, null);
        }).catch(() => {});
    };

    const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
    const getUploadUrl = (filename) => {
        if (!filename) return "/thumbnail-placeholder.jpg";
        if (/^https?:\/\//i.test(filename)) return filename;
        return `${API_BASE}/uploads/${filename}`;
    };

    // --- Nouveau: mapping couleurs + inférence thème pour un morceau ---
    const trackThemeColors = {
        jazz: "#8b6f47",
        rock: "#d9534f",
        rap: "#4b4b4b",
        disco: "#d89e00",
        détente: "#ffce54",
        tropical: "#f67280",
        moderne: "#7a5af5",
        pop: "#1db954"
    };
    const inferTrackTheme = (track) => {
        const text = `${track.name} ${track.artists?.map(a=>a.name).join(" ")}`.toLowerCase();
        if (/jazz|sax|swing|blues/.test(text)) return "jazz";
        if (/rock|metal|guitar|punk|indie/.test(text)) return "rock";
        if (/(rap|hip.?hop|trap)/.test(text)) return "rap";
        if (/disco|funk|groove/.test(text)) return "disco";
        if (/chill|ambient|lofi|relax/.test(text)) return "détente";
        if (/tropical|reggae|latin|summer/.test(text)) return "tropical";
        if (/electro|edm|dance|house/.test(text)) return "moderne";
        return "pop";
    };

    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const resultsFlat = useMemo(() => {
        if (!showSearchResults) return [];
        if (searchMode === "cocktails") return searchResults.cocktails || [];
        return searchResults.tracks || [];
    }, [showSearchResults, searchResults, searchMode]);

    // historique des recherches (localStorage)
    const [searchHistory, setSearchHistory] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("searchHistory") || "[]");
        } catch {
            return [];
        }
    });
    const [inputFocused, setInputFocused] = useState(false);

    const HISTORY_KEY = "searchHistory";
    const HISTORY_LIMIT = 10;

    const saveHistoryToStorage = (arr) => {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    };

    const addToHistory = (q) => {
        const v = (q || "").trim();
        if (!v) return;
        setSearchHistory(prev => {
            const next = [v, ...prev.filter(x => x.toLowerCase() !== v.toLowerCase())].slice(0, HISTORY_LIMIT);
            saveHistoryToStorage(next);
            return next;
        });
    };

    const clearHistory = () => {
        setSearchHistory([]);
        localStorage.removeItem(HISTORY_KEY);
    };

    // Recherche avec debounce
    useEffect(() => {
        const performSearch = async () => {
            if (debouncedSearchQuery.trim().length < 2) {
                setSearchResults({ cocktails: [], tracks: [] });
                setShowSearchResults(false);
                return;
            }
            setIsSearching(true);
            try {
                if (searchMode === "tracks") {
                    if (favoriteTracks.length === 0) loadFavoriteTracks();
                    const params = {
                        q: debouncedSearchQuery,
                        limit: trackLimit,
                        market: "FR"
                    };
                    const spotifyRes = await axios.get("/spotify/search-tracks", { params });
                    let tracks = spotifyRes.data?.tracks?.items || [];
                    if (onlyWithPreview) {
                        tracks = tracks.filter(t => t.preview_url);
                    }
                    setSearchResults({ cocktails: [], tracks });
                    analytics.trackUnifiedSearch(debouncedSearchQuery, "tracks", tracks.length);
                    if (autoPlayPreview) {
                        const first = tracks.find(t => t.preview_url);
                        if (first) playPreview(first);
                    }
                } else {
                    const cocktailRes = await axios.get("/cocktails", {
                        params: { q: debouncedSearchQuery, limit: 10 }
                    });
                    setSearchResults({ cocktails: cocktailRes.data?.data || [], tracks: [] });
                    analytics.trackUnifiedSearch(debouncedSearchQuery, "cocktails", (cocktailRes.data?.data || []).length);
                }
                setShowSearchResults(true);
            } catch (e) {
                console.error("Search err", e);
                setSearchResults({ cocktails: [], tracks: [] });
                setShowSearchResults(false);
            } finally {
                setIsSearching(false);
            }
        };
        performSearch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearchQuery, searchMode, trackLimit, onlyWithPreview]);

    // Ne PAS effacer la recherche si on navigue vers /cocktails via le bouton
    useEffect(() => {
        const preserve = ["/cocktails"];
        if (!preserve.includes(location.pathname)) {
            setShowSearchResults(false);
            setSearchQuery("");
        }
    }, [location]);

    // Fermer les résultats quand on clique ailleurs
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.navbar-search-container')) {
                setShowSearchResults(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        navigate("/");
        window.location.reload();
    };

    const handleResultClick = (type, item) => {
        // enregistrer la recherche courante dans l'historique si présente
        if (searchQuery && searchQuery.trim()) addToHistory(searchQuery);

        if (type === "cocktail") {
            navigate(`/cocktails/${item._id}`);
            setShowSearchResults(false);
        }
    };

    // remplacé/complété : openSpotifyTrack
    const openSpotifyTrack = (track) => {
        // enregistrer la recherche courante dans l'historique si présente
        if (searchQuery && searchQuery.trim()) addToHistory(searchQuery);

        // ouverture dans Spotify (votre logique existante)
        try {
            const url = track.external_urls?.spotify || track.uri || null;
            if (url) window.open(url, "_blank", "noopener");
        } catch (err) {
            console.error("Erreur ouverture Spotify:", err);
        }
    };

    const handleSearchSubmit = (e) => {
        if (e?.preventDefault) e.preventDefault();
        const q = searchQuery.trim();
        if (!q) return;
        addToHistory(q);
        setShowSearchResults(true);
        setHighlightedIndex(-1);
    };

    const handleSeeAll = () => {
        if (searchMode === "cocktails") {
            navigate(`/cocktails?q=${encodeURIComponent(searchQuery.trim())}`);
            setShowSearchResults(false);
        } else {
            if (trackLimit < 50) {
                setTrackLimit(l => (l === 10 ? 30 : 50));
            } else {
                // Ouverture recherche Spotify si fin locale
                if (searchQuery.trim()) {
                    window.open(`https://open.spotify.com/search/${encodeURIComponent(searchQuery.trim())}`, "_blank", "noopener");
                }
            }
        }
    };

    // Helper pour savoir si on montre les suggestions
    const showSuggestions = inputFocused && !searchQuery && searchHistory.length > 0;

    // Persister préférences navbar
    useEffect(() => {
        localStorage.setItem('spotails-search-mode', searchMode);
    }, [searchMode]);

    useEffect(() => {
        localStorage.setItem('spotails-auto-play', String(autoPlayPreview));
    }, [autoPlayPreview]);

    useEffect(() => {
        localStorage.setItem('spotails-only-preview', String(onlyWithPreview));
    }, [onlyWithPreview]);

    // TEMPORAIRE: Debug - ajoutez ceci après la déclaration de searchMode
    // console.log('🔍 Navbar searchMode actuel:', searchMode);
    // console.log('🔍 localStorage search-mode:', localStorage.getItem('spotails-search-mode'));

    return (
      <nav className="navbar navbar-expand-lg navbar-custom d-flex justify-content-between align-items-center">
        <div className="container">
          <div className="navbar-content">
            {/* Logo à gauche */}
            <Link to="/" className="navbar-brand">
              <img src={`${process.env.PUBLIC_URL}/iconWhite.svg`} alt="Spotails" />
            </Link>

            {/* Barre de recherche au centre */}
            <div className="search-section">
              <div
                className="navbar-search-container mx-4 position-relative"
                style={{ flexGrow: 1, maxWidth: 640 }}
              >
                <div className={`spotify-search-wrapper ${showSearchResults ? 'open' : ''}`}>
                  <div className="mode-switch">
                    <button
                      type="button"
                      className={`mode-btn ${searchMode === 'cocktails' ? 'active' : ''}`}
                      onClick={() => { setSearchMode('cocktails'); setHighlightedIndex(-1); }}
                      aria-pressed={searchMode === 'cocktails'}
                    >
                      <i className="bi bi-cup-straw me-1" /> Cocktails
                    </button>
                    <button
                      type="button"
                      className={`mode-btn ${searchMode === 'tracks' ? 'active' : ''}`}
                      onClick={() => { setSearchMode('tracks'); setHighlightedIndex(-1); }}
                      aria-pressed={searchMode === 'tracks'}
                    >
                      <i className="bi bi-music-note-beamed me-1" /> Sons
                    </button>
                  </div>

                  <form onSubmit={handleSearchSubmit} className="flex-grow-1 d-flex position-relative">
                    <input
                      type="text"
                      className="spotify-search-input"
                      placeholder={
                        searchMode === "cocktails"
                          ? "Rechercher un cocktail (nom, thème, mot-clé)…"
                          : "Rechercher un morceau (titre, artiste)…"
                      }
                      value={searchQuery}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSearchQuery(v);
                        if (v.trim().length === 0) {
                          setShowSearchResults(false);
                        } else {
                          setShowSearchResults(true);
                        }
                        setHighlightedIndex(-1);
                      }}
                      onFocus={() => {
                        setInputFocused(true);
                        if (searchQuery.trim().length > 0) setShowSearchResults(true);
                      }}
                      onBlur={() => setTimeout(() => setInputFocused(false), 120)}
                    />
                    <div className="search-actions d-flex align-items-center">
                      {searchMode === 'tracks' && (
                        <button
                          type="button"
                          className={`mini-btn ${autoPlayPreview ? 'active' : ''}`}
                          title="Lecture auto des aperçus"
                          onClick={() => setAutoPlayPreview(v => !v)}
                        >
                          <i className="bi bi-broadcast-pin" />
                        </button>
                      )}
                      {searchMode === 'tracks' && (
                        <button
                          type="button"
                          className={`mini-btn ${onlyWithPreview ? 'active' : ''}`}
                          title="Seulement morceaux avec aperçu"
                          onClick={() => setOnlyWithPreview(v => !v)}
                        >
                          <i className="bi bi-soundwave" />
                        </button>
                      )}
                      {searchQuery && (
                        <button
                          type="button"
                          className="mini-btn"
                          title="Effacer"
                          onClick={() => { setSearchQuery(""); setHighlightedIndex(-1); }}
                        >
                          <i className="bi bi-x-lg" />
                        </button>
                      )}
                      <button className="mini-btn primary" type="submit" aria-label="Rechercher">
                        <i className="bi bi-search" />
                      </button>
                    </div>
                  </form>

                  {/* Suggestions d'historique */}
                  {showSuggestions && (
                    <div className="search-suggestions" role="listbox" aria-label="Suggestions de recherche">
                      <div className="suggestions-header d-flex justify-content-between align-items-center">
                        <small className="text-muted">Recherches récentes</small>
                        <button
                          className="btn btn-link p-0 text-decoration-none text-muted clear-history-btn"
                          onMouseDown={(e) => { e.preventDefault(); clearHistory(); }}
                        >
                          Effacer
                        </button>
                      </div>
                      <ul className="list-unstyled mb-0">
                        {searchHistory.map((s, i) => (
                          <li
                            key={s + i}
                            className="suggestion-item d-flex justify-content-between align-items-center"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSearchQuery(s);
                              addToHistory(s);
                              setShowSearchResults(true);
                              setInputFocused(false);
                            }}
                          >
                            <div className="suggestion-text">{s}</div>
                            <button
                              className="btn btn-sm btn-link remove-suggestion"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSearchHistory(prev => {
                                  const next = prev.filter(x => x.toLowerCase() !== s.toLowerCase());
                                  saveHistoryToStorage(next);
                                  return next;
                                });
                              }}
                              title={`Supprimer "${s}"`}
                            >
                              <i className="bi bi-x-lg" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Résultats (cocktails / tracks) */}
                  {!showSuggestions && showSearchResults && (searchResults.cocktails?.length > 0 || searchResults.tracks?.length > 0) && (
                    <div className="spotify-results-panel" role="list">
                      {searchMode === "tracks" && (
                        <div className="results-legend">
                          <span className="legend-dot" /> Barre verte = popularité Spotify (0–100)
                        </div>
                      )}

                      {searchMode === "cocktails" && (searchResults.cocktails || []).map((c, idx) => {
                        const active = idx === highlightedIndex;
                        return (
                          <div
                            key={c._id}
                            className={`result-item cocktail ${active ? 'active' : ''}`}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            onClick={() => handleResultClick('cocktail', c)}
                            role="option"
                          >
                            <div className="left">
                              {(c.thumbnail || c.image) ? (
                                <img
                                  src={getUploadUrl(c.thumbnail || c.image)}
                                  alt={c.name}
                                  className="thumb-img"
                                  loading="lazy"
                                  onError={(e) => { e.currentTarget.src = "/thumbnail-placeholder.jpg"; }}
                                />
                              ) : (
                                <div className="thumb placeholder">
                                  <i className="bi bi-cup-straw" />
                                </div>
                              )}
                            </div>
                            <div className="center">
                              <div className="title">{c.name}</div>
                              <div className="meta">
                                <span className="chip" style={{ backgroundColor: c.color }}>{c.theme}</span>
                                {c.description && <span className="desc">{c.description.slice(0, 70)}…</span>}
                              </div>
                            </div>
                            <div className="right">
                              <i className="bi bi-cup-straw" />
                            </div>
                          </div>
                        );
                      })}

                      {searchMode === "tracks" && (searchResults.tracks || []).map((t, idx) => {
                        const active = idx === highlightedIndex;
                        const themeLabel = inferTrackTheme(t);
                        const themeColor = trackThemeColors[themeLabel] || "#1db954";
                        return (
                          <div
                            key={t.id}
                            className={`result-item track ${active ? 'active' : ''} ${playingTrackId === t.id ? 'playing' : ''}`}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            role="option"
                          >
                            <div className="left">
                              {t.album?.images?.[2] ? (
                                <img src={t.album.images[2].url} alt={t.name} className="thumb-img" />
                              ) : (
                                <div className="thumb placeholder"><i className="bi bi-music-note" /></div>
                              )}
                            </div>

                            <div className="center" onClick={() => playPreview(t)}>
                              <div className="title">
                                {t.name}
                                {t.preview_url && <span className="badge-preview ms-2"><i className="bi bi-headphones" /> 30s</span>}
                              </div>
                              <div className="meta">
                                <span className="artist">{t.artists?.map(a => a.name).join(", ") || "Artiste inconnu"}</span>
                                {t.album?.name && <span className="album"> • {t.album.name}</span>}
                                <span className="chip track-theme ms-2" style={{ backgroundColor: themeColor, color: "#111" }} title={`Thème estimé: ${themeLabel}`}>
                                  {themeLabel}
                                </span>
                              </div>
                              <div className="sub-meta">
                                {t.duration_ms && <span>{formatDuration(t.duration_ms)}</span>}
                                {t.external_urls?.spotify && (
                                  <span className="open-link" onClick={(e) => { e.stopPropagation(); openSpotifyTrack(t); }}>
                                    Ouvrir Spotify ↗
                                  </span>
                                )}
                              </div>
                              <div className="popularity-bar-mini" role="progressbar" aria-label={`Popularité ${t.popularity || 0} pourcent`} aria-valuenow={t.popularity || 0} aria-valuemin="0" aria-valuemax="100" title={`Popularité Spotify: ${t.popularity || 0}%`}>
                                <div style={{ width: `${t.popularity || 0}%` }} />
                              </div>
                            </div>

                            <div className="right d-flex align-items-center gap-1">
                              <button className={`mini-btn ${isFavoriteTrack(t.id) ? 'fav' : ''}`} title="Favori" onClick={(e) => { e.stopPropagation(); toggleFavoriteTrack(t); }}>
                                <i className={`bi ${isFavoriteTrack(t.id) ? 'bi-heart-fill' : 'bi-heart'}`} />
                              </button>

                              <button className={`mini-btn ${selectedTracks.find(sel => sel.id === t.id) ? 'sel' : ''}`} title="Sélection pour playlist" onClick={(e) => { e.stopPropagation(); toggleSelectTrack(t); }}>
                                <i className="bi bi-plus-circle" />
                              </button>

                              {t.preview_url ? (
                                <button className={`mini-btn ${playingTrackId === t.id ? 'playing' : ''}`} title={playingTrackId === t.id ? 'Pause' : 'Lecture aperçu'} onClick={(e) => { e.stopPropagation(); playPreview(t); }}>
                                  <i className={`bi ${playingTrackId === t.id ? 'bi-pause-fill' : 'bi-play-fill'}`} />
                                </button>
                              ) : (
                                <span className="no-preview" title="Pas d'aperçu"><i className="bi bi-volume-mute" /></span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <div className="results-footer">
                        <button onClick={handleSeeAll} className="w-100 btn btn-sm btn-outline-light" disabled={searchMode === "tracks" && trackLimit >= 50}>
                          {searchMode === "cocktails"
                            ? `Voir tous les cocktails pour "${searchQuery}"`
                            : trackLimit >= 50
                              ? `Fin des résultats • ${searchResults.tracks?.length || 0} morceaux`
                              : `Charger plus (${trackLimit} → ${trackLimit === 10 ? 30 : 50})`}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {isSearching && (
                    <div className="position-absolute w-100 mt-1 bg-dark border rounded p-3 text-center" style={{ zIndex: 1100 }}>
                      <div className="spinner-border spinner-border-sm text-light" role="status" />
                    </div>
                  )}

                  {showSearchResults && debouncedSearchQuery.length >= 2 && !isSearching && searchResults.cocktails?.length === 0 && searchResults.tracks?.length === 0 && (
                    <div className="position-absolute w-100 mt-1 bg-dark border rounded p-3 text-center text-muted" style={{ zIndex: 1100 }}>
                      Aucun résultat pour "{debouncedSearchQuery}"
                    </div>
                  )}

                  <audio ref={audioRef} style={{ display: "none" }} onEnded={() => setPlayingTrackId(null)} onError={() => setPlayingTrackId(null)} />
                </div>
              </div>
            </div>

            {/* Navigation + Profil à droite */}
            <div className="navbar-right">
              <div className="navbar-nav">
                <Link to="/cocktails" className={`nav-item ${location.pathname === '/cocktails' ? 'active' : ''}`}>
                  <i className="bi bi-cup-straw" /> Nos Cocktails
                </Link>
                <Link to="/themes" className={`nav-item ${location.pathname === '/themes' ? 'active' : ''}`}>
                  <i className="bi bi-palette" /> Thèmes
                </Link>
                <Link to="/favorite-tracks" className={`nav-item ${location.pathname === '/favorite-tracks' ? 'active' : ''}`}>
                  <i className="bi bi-heart" /> Mes Sons
                </Link>
              </div>

              {isAuthenticated ? (
                <UserMenu username={username} isAdmin={isAdmin} onLogout={handleLogout} />
              ) : (
                <div className="auth-buttons">
                  <Link to="/login" className="btn-auth login">Connexion</Link>
                  <Link to="/register" className="btn-auth register">Inscription</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    );
};

export default Navbar;