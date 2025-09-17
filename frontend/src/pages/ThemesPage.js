import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../axiosConfig"; // ← pour header token auto
import "../styles/ThemesPage.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
const placeholder = `${process.env.PUBLIC_URL || ""}/thumbnail-placeholder.jpg`;

// Correction getUploadUrl
const getUploadUrl = (filename) => {
  if (!filename) return placeholder;
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${API_BASE}/uploads/${filename}`;
};

// Alias recherche Spotify
const themeSearchAliases = {
  "variété française": "french pop chanson",
  "variete francaise": "french pop chanson",
  "conçu spécialement pour vous": "chill mix discovery",
  "concu specialement pour vous": "chill mix discovery",
  "dernières sorties": "new releases",
  "dernieres sorties": "new releases",
  "détente": "chill relax ambient",
  "detente": "chill relax ambient",
  "dormir": "sleep calm ambient",
  "ambiance": "lounge chill"
};

// Petite util
const normKey = (s="") => s.toLowerCase().trim();

const trackThemeColors = {
    rock: "#d9534f",
    metal: "#b52d2a",
    rap: "#4b4b4b",
    hiphop: "#4b4b4b",
    trap: "#4b4b4b",
    jazz: "#8b6f47",
    blues: "#4e3a2a",
    swing: "#9b7a52",
    funk: "#d89e00",
    disco: "#d89e00",
    chill: "#44b4a8",
    lofi: "#3d7e75",
    ambient: "#3d7e75",
    electro: "#7a5af5",
    edm: "#7a5af5",
    house: "#7a5af5",
    dance: "#7a5af5",
    pop: "#1db954"
};

const ThemesPage = () => {
  const [themes, setThemes] = useState([]);
  const [loadingThemes, setLoadingThemes] = useState(true);

  const [selectedTheme, setSelectedTheme] = useState(null);
  const [cocktailsForTheme, setCocktailsForTheme] = useState([]);
  const [tracksForTheme, setTracksForTheme] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [currentTrack, setCurrentTrack] = useState(null);
  const audioRef = useRef(null);

  const [selectedTracks, setSelectedTracks] = useState([]);
  const [playlistName, setPlaylistName] = useState("");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [onlyWithPreview, setOnlyWithPreview] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderError, setBuilderError] = useState("");
  const [builderSuccess, setBuilderSuccess] = useState("");

  const [favoriteCocktailIds, setFavoriteCocktailIds] = useState([]);
  const [favoriteTrackIds, setFavoriteTrackIds] = useState([]);

  const navigate = useNavigate();

  // --- NOUVEAU: coversMap + file d’attente + abort
  const [coversMap, setCoversMap] = useState({}); // { normName: [url,url,url] }
  const fetchQueueRef = useRef([]);
  const fetchingRef = useRef(false);
  const abortRef = useRef(null);

  // Chargement des thèmes (inchangé ou ton code dans loadThemes)
  useEffect(() => { loadThemes(); }, []);
  const loadThemes = async () => {
    setLoadingThemes(true);
    try {
      const res = await axios.get("/cocktails?limit=400");
      const list = res.data?.data || [];
      const grouped = list.reduce((acc, c) => {
        const th = (c.theme || "Divers").trim();
        acc[th] = acc[th] || { name: th, cocktails: [], color: c.color };
        acc[th].cocktails.push(c);
        return acc;
      }, {});
      const arr = Object.values(grouped)
        .map(t => ({ ...t, cocktailCount: t.cocktails.length }))
        .sort((a,b)=>a.name.localeCompare(b.name));
      setThemes(arr);
    } catch(e){
      console.warn("Erreur thèmes", e);
    } finally {
      setLoadingThemes(false);
    }
  };

  const loadThemeContent = async (themeObj) => {
    setSelectedTheme(themeObj);
    setCocktailsForTheme(themeObj.cocktails || []);
    setTracksForTheme([]);
    setSelectedTracks([]);
    setPlaylistName(`${themeObj.name} Playlist`);
    setLoadingDetails(true);
    try {
      const res = await axios.get(`/spotify/search/${encodeURIComponent(themeObj.name)}`, { params:{ limit:30 } });
      const tracks = res.data?.items || [];
      setTracksForTheme(tracks.filter(t=>t && t.id));
    } catch(e){
      console.warn("Erreur pistes", e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleBack = () => {
    try { audioRef.current?.pause(); } catch {}
    setSelectedTheme(null);
    setTracksForTheme([]);
    setSelectedTracks([]);
    setShowBuilder(false);
  };

  // --- Inférence simple du "sous-thème" track
  const inferTrackTheme = (track) => {
    const text = `${track?.name} ${(track?.artists||[]).map(a=>a.name).join(" ")}`.toLowerCase();
    if (/rock|metal|punk|guitar/.test(text)) return "rock";
    if (/hip.?hop|rap|trap/.test(text)) return "rap";
    if (/jazz|sax|swing|blues/.test(text)) return "jazz";
    if (/disco|funk|groove/.test(text)) return "disco";
    if (/chill|ambient|lofi|relax/.test(text)) return "chill";
    if (/electro|edm|house|dance/.test(text)) return "electro";
    return "pop";
  };

  const playPreview = (track) => {
    if (!track?.preview_url) return;
    if (currentTrack?.id === track.id) {
      audioRef.current?.pause();
      setCurrentTrack(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = track.preview_url;
    audioRef.current.play().catch(()=>{});
    setCurrentTrack(track);
    audioRef.current.onended = () => setCurrentTrack(null);
    audioRef.current.onerror = () => setCurrentTrack(null);
  };

  // Sélection
  const toggleSelectTrack = (track) =>
    setSelectedTracks(prev => prev.includes(track.id) ? prev.filter(i=>i!==track.id) : [...prev, track.id]);
  const selectAll = () => setSelectedTracks(visibleTracks().map(t=>t.id));
  const clearSelection = () => setSelectedTracks([]);
  const visibleTracks = () => tracksForTheme.filter(t => !onlyWithPreview || t.preview_url);

  // Création playlist locale (déjà implémentée plus tôt)
  const createThemePlaylist = async () => {
    if (selectedTracks.length === 0) {
      setBuilderError("Aucune piste sélectionnée.");
      return;
    }
    setCreatingPlaylist(true);
    setBuilderError("");
    setBuilderSuccess("");
    try {
      const chosen = tracksForTheme.filter(t => selectedTracks.includes(t.id));
      await axios.post("/playlists", {
        name: playlistName || selectedTheme.name,
        source: "theme",
        themeName: selectedTheme.name,
        tracks: chosen.map(t => ({
          id: t.id,
          trackId: t.id,
          name: t.name,
          artists: t.artists.map(a=>a.name),
          duration_ms: t.duration_ms,
          preview_url: t.preview_url,
          external_urls: t.external_urls,
          album: t.album,
          explicit: t.explicit,
          popularity: t.popularity,
          inferredTheme: inferTrackTheme(t)
        }))
      });
      setBuilderSuccess("Playlist sauvegardée.");
      setSelectedTracks([]);
      setTimeout(()=> setShowBuilder(false), 900);
    } catch(e){
      setBuilderError(e.response?.data?.message || "Erreur sauvegarde");
    } finally {
      setCreatingPlaylist(false);
    }
  };

  // --- FILE DE TÉLÉCHARGEMENT DES POCHETTES ---
  const enqueueMissingCovers = () => {
    if (selectedTheme) return; // ne charge pas pendant détail
    const unknown = themes
      .filter(t => !coversMap[normKey(t.name)])
      .slice(0, 24)
      .map(t => t.name);
    if (unknown.length === 0) return;
    fetchQueueRef.current.push(...unknown);
    processQueue();
  };

  const processQueue = async () => {
    if (fetchingRef.current || fetchQueueRef.current.length === 0) return;
    fetchingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      while (fetchQueueRef.current.length > 0 && !controller.signal.aborted) {
        const batch = fetchQueueRef.current.splice(0, 4);
        await Promise.all(batch.map(async (themeName) => {
          const key = normKey(themeName);
            if (coversMap[key]) return;
            try {
              const alias = themeSearchAliases[key] || themeName;
              const res = await axios.get(`/spotify/search/${encodeURIComponent(alias)}`, {
                params:{ limit:3 },
                signal: controller.signal
              });
              const items = res.data?.items || [];
              const covers = items.map(i =>
                i.album?.images?.[1]?.url || i.album?.images?.[0]?.url
              ).filter(Boolean).slice(0,3);
              setCoversMap(prev => prev[key] ? prev : { ...prev, [key]: covers });
            } catch {
              setCoversMap(prev => prev[key] ? prev : { ...prev, [key]: [] });
            }
        }));
        await new Promise(r => setTimeout(r, 140));
      }
    } finally {
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (!loadingThemes && themes.length) enqueueMissingCovers();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingThemes, themes.length, selectedTheme]);

  // Charger favoris cocktails + tracks quand on entre dans un thème
  useEffect(() => {
    if (selectedTheme) {
      loadCocktailFavorites();
      loadTrackFavorites();
    }
  }, [selectedTheme]);

  const loadCocktailFavorites = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await axios.get("/favorites");
      const ids = (res.data || []).map(c => c._id);
      setFavoriteCocktailIds(ids);
    } catch {}
  };

  const toggleCocktailFavorite = async (cocktailId) => {
    const token = localStorage.getItem("token");
    if (!token) return alert("Connecte-toi pour ajouter aux favoris.");
    try {
      if (favoriteCocktailIds.includes(cocktailId)) {
        await axios.delete(`/favorites/remove/${cocktailId}`);
        setFavoriteCocktailIds(prev => prev.filter(id => id !== cocktailId));
      } else {
        await axios.post(`/favorites/add/${cocktailId}`);
        setFavoriteCocktailIds(prev => [...prev, cocktailId]);
      }
    } catch (e) {
      console.warn("Fav cocktail error", e.response?.data || e.message);
    }
  };
  const isCocktailFavorite = (id) => favoriteCocktailIds.includes(id);

  const loadTrackFavorites = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await axios.get("/spotify/favorite-tracks");
      setFavoriteTrackIds((res.data || []).map(t => t.trackId));
    } catch {}
  };

  const toggleTrackFavorite = async (track) => {
    const token = localStorage.getItem("token");
    if (!token) return alert("Connecte-toi pour gérer tes favoris musique.");
    try {
      if (favoriteTrackIds.includes(track.id)) {
        await axios.delete(`/spotify/favorite-tracks/${track.id}`);
        setFavoriteTrackIds(prev => prev.filter(t => t !== track.id));
      } else {
        await axios.post("/spotify/favorite-tracks", {
          trackId: track.id,
          trackName: track.name,
          artistName: track.artists?.map(a=>a.name).join(", ") || "Inconnu",
          previewUrl: track.preview_url,
          spotifyUrl: track.external_urls?.spotify,
          albumImage: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url
        });
        setFavoriteTrackIds(prev => [...prev, track.id]);
      }
    } catch (e) {
      console.warn("Fav track error", e.response?.data || e.message);
    }
  };
  const isTrackFavorite = (id) => favoriteTrackIds.includes(id);

  // --- Rendu cartes thèmes (remplacer le map original) ---
  const renderThemeCards = () => (
    <div className="themes-grid" role="list" aria-label="Liste des thèmes">
      {loadingThemes && Array.from({ length: 8 }).map((_,i) =>
        <div key={i} className="theme-card skel-block" style={{height:170}} aria-hidden="true" />
      )}
      {!loadingThemes && themes.map(t => {
        const key = normKey(t.name);
        const covers = coversMap[key] || [];
        return (
          <div
            key={t.name}
            className="theme-card"
            role="listitem"
            tabIndex={0}
            aria-label={`Thème ${t.name} (${t.cocktailCount} cocktails)`}
            onClick={() => loadThemeContent(t)}
            onKeyDown={(e)=> e.key==="Enter" && loadThemeContent(t)}
          >
            <div className="theme-card-media">
              {covers.length > 0 ? (
                <div className={`cover-collage collage-${covers.length}`}>
                  {covers.map((c,i)=>(
                    <div key={i} className="ccell" style={{ backgroundImage:`url(${c})` }} />
                  ))}
                </div>
              ) : (
                <div className="cover-fallback">
                  <i className="bi bi-music-note-beamed" />
                </div>
              )}
              <div className="theme-overlay-gradient" />
            </div>
            <div className="theme-card-body">
              <h3>{t.name}</h3>
              <span className="count">{t.cocktailCount} cocktails</span>
              {(!coversMap[key] || covers.length === 0) && (
                <span style={{fontSize:'.55rem',opacity:.7,display:'block',marginTop:6}}>
                  Suggestion en cours…
                </span>
              )}
            </div>
            <span className="enter-icon"><i className="bi bi-arrow-right" /></span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="themes-page fade-in-soft">
      {!selectedTheme && (
        <>
          <div className="themes-hero">
            <h1>Exploration par Thèmes</h1>
            <p>Découvrez nos univers cocktails & ambiances musicales organisés par mood, style ou inspiration.</p>
          </div>
          {renderThemeCards()}
        </>
      )}
      {selectedTheme && (
        <>
          {/* Bouton retour */}
          <button className="theme-back" onClick={handleBack}>
            <i className="bi bi-arrow-left"></i> Retour
          </button>
          <div className="theme-detail-layout">
            {/* Cocktails */}
            <section
                className="theme-panel"
                aria-labelledby="cocktails-heading"
            >
                <div className="theme-panel-header">
                    <h4 id="cocktails-heading">
                        <i className="bi bi-cup-straw" /> Cocktails ({cocktailsForTheme.length})
                    </h4>
                </div>
                <div className="theme-panel-body no-pad">
                    {loadingDetails && cocktailsForTheme.length === 0 && (
                        <div className="cocktail-grid">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="cocktail-card skel-block" style={{ minHeight: 230 }} />
                            ))}
                        </div>
                    )}
                    {!loadingDetails && cocktailsForTheme.length === 0 && (
                        <div className="empty-hint">Aucun cocktail pour ce thème</div>
                    )}
                    <div className="cocktail-grid">
                        {cocktailsForTheme.map(c => (
                            <div
                                key={c._id}
                                className="cocktail-card"
                                onClick={() => navigate(`/cocktails/${c._id}`)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") navigate(`/cocktails/${c._id}`);
                                }}
                                tabIndex={0}
                                role="button"
                                aria-label={`Voir cocktail ${c.name}`}
                            >
                                <div
                                    className="bg-thumb"
                                    style={{
                                        backgroundImage: `url('${getUploadUrl(c.thumbnail)}')`
                                    }}
                                />
                                <div className="grad-overlay" />
                                <h5>{c.name}</h5>
                                <div className="desc">{c.description}</div>
                                <div
                                    className="chip-theme"
                                    style={{
                                        background: c.color || "#1db954",
                                        color: c.textColor === "white" ? "#fff" : "#111"
                                    }}
                                >
                                    {c.theme}
                                </div>
                                <div className="open-arrow">
                                    <i className="bi bi-arrow-right" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Tracks */}
            <section
                className="theme-panel"
                aria-labelledby="tracks-heading"
            >
                <div className="theme-panel-header">
                    <h4 id="tracks-heading">
                        <i className="bi bi-music-note-beamed" /> Ambiance Musicale ({visibleTracks().length})
                    </h4>
                    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                        {selectedTracks.length > 0 && (
                            <div className="sel-counter">{selectedTracks.length} sélectionnée(s)</div>
                        )}
                        {visibleTracks().length > 0 && (
                            <button
                                className="btn-green-sm"
                                onClick={() => setShowBuilder(true)}
                                disabled={selectedTracks.length === 0}
                                title="Créer une playlist Spotify"
                            >
                                Créer Playlist ({selectedTracks.length})
                            </button>
                        )}
                    </div>
                </div>
                <div className="theme-panel-body track-scroll">
                    {/* Outils sélection / filtres */}
                    <div className="select-tools">
                        <button onClick={selectAll} disabled={visibleTracks().length === 0}>
                            Tout sélectionner
                        </button>
                        <button onClick={clearSelection} disabled={selectedTracks.length === 0}>
                            Vider sélection
                        </button>
                        <button
                            onClick={() => setOnlyWithPreview(p => !p)}
                            className={onlyWithPreview ? "active" : ""}
                        >
                            {onlyWithPreview ? "Tous les titres" : "Avec aperçu"}
                        </button>
                    </div>

                    {loadingDetails && tracksForTheme.length === 0 && (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="track-row skel-block" style={{ height: 72 }} />
                        ))
                    )}

                    {!loadingDetails && visibleTracks().length === 0 && (
                        <div className="empty-hint">
                            Aucune piste trouvée pour ce thème
                        </div>
                    )}

                    <div className="track-list">
                        {visibleTracks().map(t => {
                            const themeLabel = inferTrackTheme(t);
                            const color = trackThemeColors[themeLabel] || "#1db954";
                            const playing = currentTrack?.id === t.id;
                            const selected = selectedTracks.includes(t.id);
                            return (
                                <div
                                    key={t.id}
                                    className={`track-row ${currentTrack?.id === t.id ? "playing" : ""} ${selectedTracks.includes(t.id) ? "selected" : ""}`}
                                    onClick={(e)=> {
                                       if (e.target.closest(".btn-mini, .fav-track-btn")) return;
                                       toggleSelectTrack(t);
                                    }}
                                >
                                  <img
                                    src={t.album?.images?.[2]?.url || t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || placeholder}
                                    className="track-cover-sm"
                                    alt={t.name}
                                    onError={(e)=>e.currentTarget.style.visibility="hidden"}
                                  />
                                  <div className="track-mid">
                                    <div className="t-title">
                                      {t.name}
                                      {t.explicit && <span className="badge-priv">E</span>}
                                      <button
                                        type="button"
                                        className={`fav-track-btn ${isTrackFavorite(t.id) ? "active" : ""}`}
                                        aria-label={isTrackFavorite(t.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                                        onClick={(e)=> { e.stopPropagation(); toggleTrackFavorite(t); }}
                                      >
                                        <i className={`bi ${isTrackFavorite(t.id) ? "bi-heart-fill" : "bi-heart"}`} />
                                      </button>
                                    </div>
                                    <div className="t-meta">
                                      {t.artists?.map(a=>a.name).join(", ")}
                                      {t.preview_url
                                        ? <span className="preview-chip good">Preview</span>
                                        : <span className="preview-chip none">—</span>}
                                    </div>
                                    <div className="t-sub">
                                      <span>{Math.round((t.duration_ms || 0)/1000)}s</span>
                                      {t.external_urls?.spotify && (
                                        <span
                                          className="open-link"
                                          onClick={(e)=> { e.stopPropagation(); window.open(t.external_urls.spotify,"_blank"); }}
                                        >Spotify ↗</span>
                                      )}
                                    </div>
                                    <div className="pop-line"><div style={{ width: `${(t.popularity||0)}%` }} /></div>
                                  </div>
                                  <div className="track-actions">
                                    <button
                                      type="button"
                                      className={`btn-mini ${currentTrack?.id === t.id ? "playing" : ""}`}
                                      onClick={(e)=> { e.stopPropagation(); playPreview(t); }}
                                      disabled={!t.preview_url}
                                      title={t.preview_url ? "Lecture aperçu" : "Pas d'aperçu"}
                                    >
                                      <i className={`bi ${currentTrack?.id === t.id ? "bi-pause-fill" : "bi-play-fill"}`} />
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn-mini sel ${selectedTracks.includes(t.id) ? "active" : ""}`}
                                      onClick={(e)=> { e.stopPropagation(); toggleSelectTrack(t); }}
                                      title="Sélectionner"
                                    >
                                      <i className="bi bi-check2" />
                                    </button>
                                  </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
          </div>
        </>
      )}

      {/* Modal playlist builder */}
      {showBuilder && (
        <div className="playlist-modal-backdrop" onClick={() => setShowBuilder(false)}>
          <div
            className="playlist-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="pm-head">
              <h5>Créer une playlist</h5>
              <button className="pm-close" onClick={() => setShowBuilder(false)}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="pm-body">
              <label className="pm-label">Nom</label>
              <input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="Nom de la playlist"
              />
              <div className="pm-stats">
                {selectedTracks.length} titres sélectionnés – {visibleTracks().filter(t => t.preview_url).length} aperçus audio
              </div>
              <div className="pm-actions">
                <button
                  className="btn-cancel"
                  onClick={() => setShowBuilder(false)}
                >Annuler</button>
                <button
                  className="btn-green"
                  disabled={creatingPlaylist || selectedTracks.length === 0}
                  onClick={createThemePlaylist}
                >
                  {creatingPlaylist ? "Création..." : "Créer"}
                </button>
              </div>
              {builderError && <div className="pm-alert error">{builderError}</div>}
              {builderSuccess && <div className="pm-alert success">{builderSuccess}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemesPage;