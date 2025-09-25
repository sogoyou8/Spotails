import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../axiosConfig';
import "bootstrap-icons/font/bootstrap-icons.css";
import "../styles/ThemesPage.css";
import { analytics } from '../utils/analytics';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
const placeholder = `${process.env.PUBLIC_URL || ""}/thumbnail-placeholder.jpg`;
const getUploadUrl = (filename) => {
  if (!filename) return placeholder;
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${API_BASE}/uploads/${filename}`;
};

// Helper pour inférer thème musical depuis un track
const inferTrackTheme = (t = {}) => {
  const name = (t.name || t.trackName || "").toLowerCase();
  const artists = Array.isArray(t.artists)
    ? t.artists.map((a) => a.name || a).join(" ").toLowerCase()
    : (t.artistName || "").toLowerCase();
  const hay = `${name} ${artists}`;
  if (/jazz|swing|bossa/.test(hay)) return "jazz";
  if (/rock|metal|grunge|punk/.test(hay)) return "rock";
  if (/rap|hip.?hop|trap/.test(hay)) return "rap";
  if (/disco|funk/.test(hay)) return "disco";
  if (/chill|relax|calm|détente|detente|ambient|lofi/.test(hay)) return "détente";
  if (/tropic|latin|regga/.test(hay)) return "tropical";
  if (/edm|electro|electronic|house|techno|future/.test(hay)) return "moderne";
  return "pop";
};

const ThemesPage = () => {
  const navigate = useNavigate();
  const { themeParam } = useParams();
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [cocktails, setCocktails] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [suggestedCocktails, setSuggestedCocktails] = useState([]);
  const [loadingThemes, setLoadingThemes] = useState(true);
  const [loadingCocktails, setLoadingCocktails] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [favoriteTracks, setFavoriteTracks] = useState([]);
  const [themeImages, setThemeImages] = useState({}); // { [themeName]: imageUrl }

  // Prefetch images Spotify pour chaque thème (avec cache localStorage)
  useEffect(() => {
    if (!themes.length) return;

    const cacheKey = (t) => `themeImage:${t}`;
    const fromCache = (t) => {
      try {
        const raw = localStorage.getItem(cacheKey(t));
        if (!raw) return null;
        const { url, ts } = JSON.parse(raw);
        // 7 jours de TTL
        if (Date.now() - ts > 7 * 24 * 60 * 60 * 1000) return null;
        return url || null;
      } catch { return null; }
    };
    const saveCache = (t, url) => {
      try { localStorage.setItem(cacheKey(t), JSON.stringify({ url, ts: Date.now() })); } catch {}
    };

    let cancelled = false;
    const run = async () => {
      const next = {};
      // Limiter la parallélisation (4 en même temps)
      const chunks = [];
      for (let i = 0; i < themes.length; i += 4) chunks.push(themes.slice(i, i + 4));

      for (const chunk of chunks) {
        const promises = chunk.map(async (th) => {
          const name = th.name;
          const cached = fromCache(name);
          if (cached) { next[name] = cached; return; }
          try {
            const res = await axios.get("/spotify/theme-image", { params: { theme: name } });
            const url = res.data?.image || null;
            if (url) { next[name] = url; saveCache(name, url); }
          } catch {}
        });
        await Promise.all(promises);
        if (cancelled) return;
        setThemeImages(prev => ({ ...prev, ...next }));
      }
    };
    run();
    return () => { cancelled = true; };
  }, [themes]);

  useEffect(() => {
    loadThemes();
    loadFavoriteTracks();
  }, []);

  useEffect(() => {
    if (themeParam && themes.length > 0) {
      const theme = themes.find(t => t.name.toLowerCase() === themeParam.toLowerCase());
      if (theme) {
        setSelectedTheme(theme);
        loadThemeContent(theme);
      }
    }
  }, [themeParam, themes]);

  const loadThemes = async () => {
    try {
      const res = await axios.get("/cocktails");
      const allCocktails = res.data.data || [];
      
      // Grouper par thème avec comptage
      const themeMap = {};
      allCocktails.forEach(cocktail => {
        const theme = cocktail.theme;
        if (!themeMap[theme]) {
          themeMap[theme] = {
            name: theme,
            count: 0,
            cocktails: []
          };
        }
        themeMap[theme].count++;
        themeMap[theme].cocktails.push(cocktail);
      });

      setThemes(Object.values(themeMap));
      setLoadingThemes(false);
    } catch (err) {
      console.error("Erreur chargement thèmes:", err);
      setLoadingThemes(false);
    }
  };

  const loadFavoriteTracks = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await axios.get("/spotify/favorite-tracks");
      setFavoriteTracks(res.data || []);
    } catch (err) {
      console.warn("Erreur chargement favoris:", err);
    }
  };

  const loadThemeContent = async (theme) => {
    setLoadingCocktails(true);
    setLoadingTracks(true);
    try {
      // Cocktails
      const cocktailRes = await axios.get("/cocktails", { params: { theme: theme.name, limit: 20 } });
      setCocktails(Array.isArray(cocktailRes.data) ? cocktailRes.data : (cocktailRes.data?.data || []));
      setLoadingCocktails(false);

      // Tracks (normalisation robuste)
      const trackRes = await axios.get(`/spotify/search/${encodeURIComponent(theme.name)}`, { params: { limit: 20 } });
      const tData = trackRes.data;
      const normalized = Array.isArray(tData)
        ? tData
        : (tData?.items || tData?.tracks || tData?.data || []);
      setTracks(Array.isArray(normalized) ? normalized : []);
      setLoadingTracks(false);

      await fetchCocktailSuggestions([theme.name]);
    } catch (err) {
      console.error("Erreur chargement contenu thème:", err);
      setCocktails([]);
      setTracks([]);
      setLoadingCocktails(false);
      setLoadingTracks(false);
    }
  };

  // Suggestions de cocktails basées sur les termes (exclut le thème courant et les doublons)
  const fetchCocktailSuggestions = async (terms = []) => {
    const currentThemeName = selectedTheme?.name || "";
    const norm = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    // On retire explicitement le thème courant des termes
    const tnames = (terms || [])
      .map(t => String(t || "").trim())
      .filter(Boolean)
      .filter(t => norm(t) !== norm(currentThemeName));

    const q = tnames.join(" ").trim();
    if (!q) { setSuggestedCocktails([]); return; }

    try {
      const res = await axios.get("/cocktails", { params: { q, limit: 24 } });
      const payload = res.data;
      const items = Array.isArray(payload) ? payload : (payload.data || []);

      // Exclure: thème courant + cocktails déjà présents dans le panneau principal
      const excludeIds = new Set((cocktails || []).map(c => String(c._id)));
      const filtered = items.filter(c =>
        c &&
        !excludeIds.has(String(c._id)) &&
        norm(c.theme || "") !== norm(currentThemeName)
      );

      // Score très simple basé sur présence des termes dans name/description + bonus image
      const score = (c) => {
        const hay = `${c.name || ""} ${c.description || ""}`.toLowerCase();
        let s = 0;
        tnames.forEach(t => { if (t && hay.includes(t.toLowerCase())) s += 2; });
        if (c.thumbnail || c.image) s += 0.5;
        return s;
      };

      // Unicité par _id puis tri par score
      const seen = new Set();
      const unique = [];
      for (const c of filtered) {
        const id = String(c._id);
        if (!seen.has(id)) { seen.add(id); unique.push(c); }
      }
      unique.sort((a, b) => score(b) - score(a));

      setSuggestedCocktails(unique.slice(0, 8));
    } catch (e) {
      console.error("❌ Erreur suggestions cocktails:", e.response?.status, e.response?.data || e.message);
      setSuggestedCocktails([]);
    }
  };

  const handleThemeSelect = (theme) => {
    setSelectedTheme(theme);
    loadThemeContent(theme);
    navigate(`/themes/${encodeURIComponent(theme.name.toLowerCase())}`);
    analytics.track('theme_selected', { themeName: theme.name, cocktailCount: theme.count });
  };

  const handleTrackSelect = async (track) => {
    const trackTheme = inferTrackTheme(track);
    const artist = Array.isArray(track.artists) 
      ? track.artists.map(a => a.name || a).join(", ") 
      : (track.artistName || "");
    
    console.log("🎵 Track sélectionné dans ThemesPage:", { 
      theme: trackTheme, 
      artist, 
      trackName: track.name 
    });
    
    // Suggérer cocktails basés sur le thème musical du track + thème cocktail actuel
    const terms = selectedTheme ? [selectedTheme.name, trackTheme] : [trackTheme];
    await fetchCocktailSuggestions(terms);
    
    analytics.trackMusicPreview(track.id, track.name, selectedTheme?.name);
  };

  const playPreview = (track) => {
    if (currentTrack && currentTrack.id === track.id) {
      // Arrêter la lecture
      const audio = document.getElementById("theme-audio");
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setCurrentTrack(null);
      return;
    }

    if (!track.preview_url) return;

    const audio = document.getElementById("theme-audio");
    if (audio) {
      audio.src = track.preview_url;
      audio.play().catch(console.warn);
      setCurrentTrack(track);
    }
  };

  const toggleTrackFavorite = async (track) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return alert("Connectez-vous pour gérer vos favoris");

      const isFav = favoriteTracks.some(f => f.trackId === track.id);
      const payload = {
        trackId: track.id,
        trackName: track.name,
        artistName: Array.isArray(track.artists) ? track.artists.map(a => a.name).join(", ") : "",
        albumImage: track.album?.images?.[0]?.url || "",
        previewUrl: track.preview_url || "",
        spotifyUrl: track.external_urls?.spotify || ""
      };

      if (isFav) {
        await axios.delete(`/spotify/favorite-tracks/${track.id}`);
        setFavoriteTracks(prev => prev.filter(f => f.trackId !== track.id));
      } else {
        await axios.post("/spotify/favorite-tracks", payload);
        setFavoriteTracks(prev => [...prev, { ...payload, trackId: track.id }]);
      }
    } catch (err) {
      console.error("Erreur toggle favori:", err);
    }
  };

  const isFavoriteTrack = (trackId) => favoriteTracks.some(f => f.trackId === trackId);

  if (loadingThemes) {
    return (
      <div className="themes-page">
        <div className="themes-hero">
          <h1>Exploration par Thèmes</h1>
          <p>Découvrez cocktails et musiques organisés par ambiances</p>
        </div>
        <div className="themes-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skel-block" style={{ height: 170 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="themes-page">
      {/* Hero Section */}
      <div className="themes-hero">
        <h1>Exploration par Thèmes</h1>
        <p>Découvrez l'harmonie parfaite entre cocktails et musiques selon l'ambiance désirée</p>
      </div>

      {selectedTheme && (
        <button className="theme-back" onClick={() => { setSelectedTheme(null); navigate('/themes'); }}>
          <i className="bi bi-arrow-left"></i> Retour aux thèmes
        </button>
      )}

      {/* Grille des thèmes ou contenu détaillé */}
      {!selectedTheme ? (
        <div className="themes-grid">
          {themes.map(theme => {
            // 1) Image Spotify du thème si disponible, sinon collage des thumbnails, sinon placeholder
            const spotifyImg = themeImages[theme.name] || null;
            const collage = (theme.cocktails || [])
              .map(c => getUploadUrl(c.thumbnail))
              .filter(Boolean)
              .slice(0, 4);
            const images = spotifyImg ? [spotifyImg] : (collage.length ? collage : [placeholder]);

            return (
              <div
                key={theme.name}
                className="theme-card"
                onClick={() => handleThemeSelect(theme)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleThemeSelect(theme); } }}
              >
                <div className="theme-card-media">
                  <div className={`cover-collage collage-${Math.min(images.length, 3)}`}>
                    {images.map((src, idx) => (
                      <div key={idx} className="ccell">
                        <img
                          src={src || placeholder}
                          alt={theme.name}
                          onError={(e) => { e.currentTarget.src = placeholder; }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="theme-overlay-gradient" />
                </div>
                <div className="theme-card-body">
                  <h3>{theme.name}</h3>
                  <div className="count">{theme.count} cocktail{theme.count > 1 ? 's' : ''}</div>
                  <div className="enter-icon"><i className="bi bi-arrow-right"></i></div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Layout détaillé pour un thème sélectionné */
        <div className="theme-detail-layout fade-in-soft">
          {/* Panel Cocktails */}
          <div className="theme-panel">
            <div className="theme-panel-header">
              <h4>
                <i className="bi bi-cup-straw"></i>
                Cocktails {selectedTheme.name}
              </h4>
              <span className="badge bg-success">{cocktails.length}</span>
            </div>
            <div className="theme-panel-body">
              {loadingCocktails ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="skel-block" style={{ height: 120, margin: "14px 10px 0" }} />
                ))
              ) : cocktails.length === 0 ? (
                <div className="empty-hint">Aucun cocktail trouvé pour ce thème</div>
              ) : (
                <div className="cocktail-grid">
                  {cocktails.map(cocktail => (
                    <div
                      key={cocktail._id}
                      className="cocktail-card v2"
                      onClick={() => navigate(`/cocktails/${cocktail._id}`)}
                      role="button"
                    >
                      <div className="bg-thumb">
                        <img
                          src={getUploadUrl(cocktail.thumbnail) || placeholder}
                          alt={cocktail.name}
                          onError={(e) => { e.currentTarget.src = placeholder; }}
                        />
                      </div>
                      <div className="grad-overlay" />
                      <div className="cc-body">
                        <h5 className="cc-title">{cocktail.name}</h5>
                        <div className="cc-desc">{cocktail.description}</div>
                        <div className="cc-footer">
                          <span className="chip-theme">{cocktail.theme}</span>
                          <span className="open-arrow"><i className="bi bi-arrow-right"></i></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Panel Musiques */}
          <div className="theme-panel">
            <div className="theme-panel-header">
              <h4>
                <i className="bi bi-music-note-beamed"></i>
                Musiques {selectedTheme.name}
              </h4>
              <span className="badge bg-success">{Array.isArray(tracks) ? tracks.length : 0}</span>
            </div>
            <div className="theme-panel-body track-scroll">
              {loadingTracks ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="skel-block" style={{ height: 80, margin: "12px 10px 0" }} />
                ))
              ) : !Array.isArray(tracks) || tracks.length === 0 ? (
                <div className="empty-hint">Aucune musique trouvée pour ce thème</div>
              ) : (
                <div className="track-list">
                  {tracks.map((track) => {
                    const isPlaying = currentTrack?.id === track.id;
                    const hasPreview = !!track.preview_url;
                    const popularity = Math.max(0, Math.min(100, track.popularity || 0));
                    const cover =
                      track?.album?.images?.[2]?.url ||
                      track?.album?.images?.[0]?.url ||
                      "/thumbnail-placeholder.jpg";

                    return (
                      <div
                        key={track.id}
                        className={`track-row ${isPlaying ? "playing" : ""}`}
                        onClick={() => handleTrackSelect(track)}
                        role="button"
                      >
                        <img
                          className="track-cover-sm"
                          src={cover}
                          alt={track.name}
                          onError={(e) => (e.currentTarget.src = "/thumbnail-placeholder.jpg")}
                        />

                        <div className="track-mid">
                          <div className="t-title">{track.name}</div>
                          <div className="t-sub">
                            <span>{track.artists?.map((a) => a.name).join(", ")}</span>
                            {track.explicit ? <span className="badge-priv">EXPL</span> : null}
                            <span className={`preview-chip ${hasPreview ? "good" : "none"}`}>
                              {hasPreview ? "preview" : "no preview"}
                            </span>
                          </div>
                          <div className="pop-line">
                            <div style={{ width: `${popularity}%` }} />
                          </div>
                        </div>

                        <div className="track-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            className={`btn-mini ${isPlaying ? "playing" : ""}`}
                            title={isPlaying ? "Pause" : "Aperçu"}
                            onClick={() => playPreview(track)}
                            disabled={!hasPreview}
                          >
                            <i className={`bi ${isPlaying ? "bi-pause-fill" : "bi-play-fill"}`} />
                          </button>

                          {track.external_urls?.spotify && (
                            <a
                              className="btn-mini spotify"
                              href={track.external_urls.spotify}
                              target="_blank"
                              rel="noreferrer"
                              title="Ouvrir dans Spotify"
                            >
                              <i className="bi bi-spotify" />
                            </a>
                          )}

                          <button
                            className={`btn-mini ${isFavoriteTrack(track.id) ? "active" : ""}`}
                            title={isFavoriteTrack(track.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                            onClick={() => toggleTrackFavorite(track)}
                          >
                            <i className={`bi ${isFavoriteTrack(track.id) ? "bi-heart-fill" : "bi-heart"}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Panel Cocktails suggérés (visible quand on sélectionne un track) */}
      {selectedTheme && suggestedCocktails.length > 0 && (
        <div className="theme-panel" style={{ marginTop: '2rem' }}>
          <div className="theme-panel-header">
            <h4>
              <i className="bi bi-lightbulb"></i>
              Cocktails suggérés (hors thème)
            </h4>
            <span className="badge bg-warning text-dark">{suggestedCocktails.length}</span>
          </div>
          <div className="theme-panel-body">
            <div className="suggested-cocktail-grid">
              {suggestedCocktails.map(cocktail => (
                <div
                  key={cocktail._id}
                  className="cocktail-mini suggested"
                  role="button"
                  onClick={() => navigate(`/cocktails/${cocktail._id}`)}
                >
                  <div className="cocktail-thumb-wrap">
                    <img 
                      src={getUploadUrl(cocktail.thumbnail)} 
                      alt={cocktail.name}
                      onError={(e) => { e.currentTarget.src = placeholder; }}
                    />
                  </div>
                  <div className="cocktail-mini-body">
                    <h5>{cocktail.name}</h5>
                    <div className="desc">{(cocktail.description || "").slice(0, 120)}</div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="theme-chip" style={{ background: '#1db954', color: '#071' }}>
                        {cocktail.theme}
                      </span>
                      <button 
                        className="fav-mini" 
                        title="Voir le cocktail"
                        onClick={(e) => { e.stopPropagation(); navigate(`/cocktails/${cocktail._id}`); }}
                      >
                        <i className="bi bi-arrow-right" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Audio player caché */}
      <audio 
        id="theme-audio" 
        onEnded={() => setCurrentTrack(null)}
        onError={() => setCurrentTrack(null)}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default ThemesPage;