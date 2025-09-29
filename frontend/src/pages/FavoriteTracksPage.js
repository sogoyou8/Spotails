import React, { useEffect, useState, useRef } from "react";
import axios from "../axiosConfig";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../styles/FavoriteTracks.css";
import "../styles/ThemesPage.css";

// Helpers fiables (images + thèmes)
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
const placeholder = `${process.env.PUBLIC_URL || ""}/thumbnail-placeholder.jpg`;
const getUploadUrl = (filename) => {
  if (!filename) return placeholder;
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${API_BASE}/uploads/${filename}`;
};

const trackThemeColors = {
  jazz: "#8b6f47",
  rock: "#d9534f",
  rap: "#4b4b4b",
  disco: "#d89e00",
  détente: "#1db954",
  tropical: "#f67280",
  moderne: "#7a5af5",
  pop: "#1db954",
};
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
const getCocktailThumb = (c = {}) => getUploadUrl(c.thumbnail || c.image);

const FavoriteTracksPage = () => {
  const [favoriteTracks, setFavoriteTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [suggestedCocktails, setSuggestedCocktails] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [customPlaylist, setCustomPlaylist] = useState([]);
  const [playlistName, setPlaylistName] = useState("");

  const [currentTrack, setCurrentTrack] = useState(null);

  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const [coverPickerFor, setCoverPickerFor] = useState(null);
  const [coverChoice, setCoverChoice] = useState({});
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);

  // --- Helpers d’affichage ---
  const formatDuration = (ms = 0) => {
    if (!ms || isNaN(ms)) return "0:00";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
    return `${m}:${s}`;
  };
  const trackPreviewUrl = (t) => t?.previewUrl || t?.preview_url || null;
  const trackIdOf = (t) => t?.trackId || t?.id;
  const artistText = (t) =>
    t?.artistName || (Array.isArray(t?.artists) ? t.artists.map((a) => a.name || a).join(", ") : "");
  const albumNameOf = (t) => t?.album?.name || t?.albumName || "";
  const popularityOf = (t) => t?.popularity ?? null;
  const explicitOf = (t) => !!t?.explicit;
  const imageOf = (t) =>
    t?.albumImage ||
    t?.album?.images?.[0]?.url ||
    t?.album?.images?.[1]?.url ||
    t?.album?.images?.[2]?.url ||
    "/thumbnail-placeholder.jpg";

  // --- Builder helpers ---
  const addToCustomPlaylist = (track) => {
    setCustomPlaylist((prev) => {
      const id = trackIdOf(track);
      if (prev.some((t) => trackIdOf(t) === id)) return prev;
      return [...prev, track];
    });
  };
  const removeFromCustomPlaylist = (trackId) => {
    setCustomPlaylist((prev) => prev.filter((t) => trackIdOf(t) !== trackId));
  };
  const removeFromFavorites = async (trackId) => {
    try {
      await axios.delete(`/spotify/favorite-tracks/${trackId}`);
    } catch {}
    setFavoriteTracks((prev) => prev.filter((t) => trackIdOf(t) !== trackId));
    setCustomPlaylist((prev) => prev.filter((t) => trackIdOf(t) !== trackId));
  };

  // Charger playlists + coverIndex
  // loadPlaylists est défini plus bas (version complète). Supprimer ce doublon.

  // --- Cocktails suggérés - CORRECTION de l'URL + parsing robuste ---
  const fetchCocktailSuggestions = async (terms = []) => {
    const q = terms.filter(Boolean).join(" ");
    if (!q.trim()) { setSuggestedCocktails([]); return; }
    try {
      console.log("🔍 Recherche cocktails avec termes:", terms, "→ query:", q);
      const res = await axios.get("/cocktails", { params: { q: q.trim(), limit: 8 } });
      const payload = res.data;
      // backend /api/cocktails renvoie { data: [...], total, ... } ou parfois directement []
      const items = Array.isArray(payload) ? payload : (payload.data || []);
      setSuggestedCocktails(items);
      console.log(`✅ Cocktails suggérés pour "${q}":`, items.length, "résultats");
    } catch (e) {
      console.error("❌ Erreur suggestions cocktails:", e.response?.status, e.response?.data || e.message);
      setSuggestedCocktails([]);
    }
  };

  const handleTrackSelect = async (track) => {
    setSelectedTrack(track);
    const theme = inferTrackTheme(track);
    const artist = artistText(track);
    const trackName = track?.trackName || track?.name;
    console.log("🎵 Track sélectionné:", { theme, artist, trackName });
    // SIMPLIFICATION: ne garder que le thème pour avoir plus de résultats
    await fetchCocktailSuggestions([theme]);
  };
  const handlePlaylistSelect = async (pl) => {
    const isSame = (selectedPlaylist?._id || selectedPlaylist?.id) === (pl?._id || pl?.id);
    const next = isSame ? null : pl;
    setSelectedPlaylist(next);
    if (next?.tracks?.length) {
      const firstTracks = next.tracks.slice(0, 6);
      const themes = firstTracks.map(inferTrackTheme);
      const topTheme = themes.sort((a,b)=> themes.filter(t=>t===a).length - themes.filter(t=>t===b).length).pop();
      const firstArtist = artistText(firstTracks[0]);
      console.log("🎵 Playlist sélectionnée:", { topTheme, firstArtist, playlistName: next.name });
      // SIMPLIFICATION: ne garder que le thème dominant
      await fetchCocktailSuggestions([topTheme]);
    } else {
      setSuggestedCocktails([]);
    }
  };

  // Persiste le cover
  const savePlaylistCover = async (pl, index) => {
    try {
      const id = pl._id || pl.id;
      setCoverChoice((prev) => ({ ...prev, [id]: index }));
      await axios.patch(`/playlists/${id}/cover`, { coverIndex: index });
    } catch {}
  };

  // Doublons de nom
  const nameExists = (name) =>
    playlists.some((p) => (p.name || p.title || "").trim().toLowerCase() === name.trim().toLowerCase());

  // Mode édition
  const editPlaylistInBuilder = (pl) => {
    setEditingPlaylistId(pl._id || pl.id);
    setPlaylistName(pl.name || pl.title || "");
    setCustomPlaylist(pl.tracks || []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const saveBuilderEdits = async () => {
    if (!editingPlaylistId) return;
    try {
      const body = {
        name: (playlistName || "").trim(),
        tracks: (customPlaylist || []).map((t) => ({
          id: t.id || t.trackId,
          trackId: t.trackId || t.id,
          name: t.name || t.trackName,
          trackName: t.trackName || t.name,
          artistName: t.artistName || (Array.isArray(t.artists) ? t.artists.map((a) => a.name || a).join(", ") : ""),
          albumImage: t.albumImage || t?.album?.images?.[0]?.url || "",
          previewUrl: t.preview_url || t.previewUrl || "",
          spotifyUrl: t.external_urls?.spotify || t.spotifyUrl || "",
        })),
      };
      const name = body.name;
      if (!name) return alert("Nom requis");
      const original = playlists.find((p) => (p._id || p.id) === editingPlaylistId);
      if (nameExists(name) && (original?.name || "").toLowerCase() !== name.toLowerCase()) {
        return alert("Une playlist du même nom existe déjà.");
      }
      await axios.put(`/playlists/${editingPlaylistId}`, body);
      await loadPlaylists();
      setEditingPlaylistId(null);
      setCustomPlaylist([]);
      setPlaylistName("");
      alert("Playlist mise à jour avec succès !");
    } catch (e) {
      console.error("Erreur mise à jour:", e);
      alert(`Échec de la mise à jour: ${e.response?.data?.message || e.message}`);
    }
  };

  // --- Audio preview ---
  const audioRef = useRef(null);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack) {
      audio.pause();
      audio.src = "";
      return;
    }

    const url = trackPreviewUrl(currentTrack);
    if (!url) return;

    audio.src = url;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // autoplay bloqué
    });

    const onEnded = () => setCurrentTrack(null);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [currentTrack]);

  const playPreview = (track) => {
    if (!trackPreviewUrl(track)) return;
    if (currentTrack && trackIdOf(currentTrack) === trackIdOf(track)) {
      setCurrentTrack(null);
      return;
    }
    setCurrentTrack(track);
  };

  useEffect(() => {
    loadFavoriteTracks();
  }, []);

  // Charger playlists + recharger les covers persistés
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    loadPlaylists();
  }, []);

  const loadFavoriteTracks = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setIsLoading(false);
        return;
      }

      const res = await axios.get("/spotify/favorite-tracks");
      setFavoriteTracks(res.data);
    } catch (error) {
      console.error("Erreur chargement favoris:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlaylists = async () => {
    setLoadingPlaylists(true);
    try {
      const res = await axios.get("/playlists");
      const pls = res.data || [];
      setPlaylists(pls);
      const mapping = {};
      pls.forEach(p => {
        const id = p._id || p.id;
        if (typeof p.coverIndex === "number") mapping[id] = p.coverIndex;
      });
      setCoverChoice(mapping);
    } catch {
      setPlaylists([]);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  // Normalisation d’un track pour stockage local
  const toTrackPayload = (t = {}) => ({
    id: t.id || t.trackId,
    trackId: t.trackId || t.id,
    name: t.name || t.trackName,
    trackName: t.trackName || t.name,
    artistName:
      t.artistName ||
      (Array.isArray(t.artists) ? t.artists.map((a) => a.name || a).join(", ") : ""),
    albumImage: t.albumImage || t?.album?.images?.[0]?.url || "",
    previewUrl: t.preview_url || t.previewUrl || "",
    spotifyUrl: t.external_urls?.spotify || t.spotifyUrl || (t.id || t.trackId ? `https://open.spotify.com/track/${t.id || t.trackId}` : "")
  });

  // URI Spotify pour export
  const toSpotifyUri = (t = {}) => {
    const id = t.id || t.trackId;
    if (!id) return null;
    return id.startsWith("spotify:track:") ? id : `spotify:track:${id}`;
  };

  // Créer une playlist locale (BDD) — empêche les doublons
  const createLocalPlaylist = async () => {
    const name = (playlistName || "").trim();
    if (!name || !customPlaylist.length) return;
    if (nameExists(name)) { alert("Une playlist du même nom existe déjà."); return; }
    try {
      const body = {
        name,
        tracks: customPlaylist.map(toTrackPayload)
      };
      await axios.post("/playlists", body);
      await loadPlaylists();
      setCustomPlaylist([]);
      setPlaylistName("");
      alert("Playlist créée.");
    } catch (e) {
      alert(e?.response?.data?.message || "Échec de la création.");
    }
  };

  // Créer une playlist sur Spotify à partir du builder
  const createSpotifyPlaylist = async () => {
    const name = (playlistName || "").trim();
    if (!name || !customPlaylist.length) return;
    if (nameExists(name)) { alert("Une playlist du même nom existe déjà (localement)."); return; }
    try {
      const uris = customPlaylist.map(toSpotifyUri).filter(Boolean);
      if (!uris.length) return alert("Aucun ID Spotify valide.");
      await axios.post("/spotify/create-custom-playlist", {
        name,
        description: "Créée avec Spotails",
        tracks: uris
      });
      alert("Playlist Spotify créée.");
    } catch (e) {
      alert(e?.response?.data?.message || "Échec de la création Spotify.");
    }
  };

  // Exporter une playlist locale vers Spotify
  const exportPlaylistToSpotify = async (pl) => {
    try {
      const uris = (pl.tracks || []).map(toSpotifyUri).filter(Boolean);
      if (!uris.length) return alert("Cette playlist ne contient pas d’IDs Spotify valides.");
      await axios.post("/spotify/create-custom-playlist", {
        name: pl.name || pl.title || "Ma playlist Spotails",
        description: "Exportée depuis Spotails",
        tracks: uris
      });
      alert("Export Spotify réussi.");
    } catch (e) {
      alert(e?.response?.data?.message || "Échec de l’export Spotify.");
    }
  };

  // Supprimer une playlist locale
  const deletePlaylist = async (id) => {
    if (!id) return;
    if (!window.confirm("Supprimer cette playlist ?")) return;
    try {
      await axios.delete(`/playlists/${id}`);
      await loadPlaylists();
      if (selectedPlaylist && (selectedPlaylist._id === id || selectedPlaylist.id === id)) {
        setSelectedPlaylist(null);
      }
    } catch (e) {
      alert(e?.response?.data?.message || "Échec de la suppression.");
    }
  };

  // Retirer un titre d'une playlist locale
  const removeTrackFromPlaylist = async (pl, track) => {
    try {
      const pid = pl._id || pl.id;
      const tid = trackIdOf(track);
      const updated = (pl.tracks || []).filter((t) => (t.id || t.trackId) !== tid);
      await axios.put(`/playlists/${pid}`, { name: pl.name || pl.title, tracks: updated });
      await loadPlaylists();
      // si on édite cette playlist dans le builder, sync aussi
      if (editingPlaylistId === pid) {
        setCustomPlaylist((prev) => prev.filter((t) => trackIdOf(t) !== tid));
      }
    } catch (e) {
      alert(e?.response?.data?.message || "Échec du retrait du titre.");
    }
  };

  // Renommer une playlist locale
  const renamePlaylist = async (pl) => {
    const name = (newPlaylistName || "").trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    const pid = pl._id || pl.id;
    const original = playlists.find(p => (p._id || p.id) === pid);
    if (nameExists(name) && (original?.name || "").toLowerCase() !== name.toLowerCase()) {
      alert("Une playlist du même nom existe déjà.");
      return;
    }
    try {
      await axios.put(`/playlists/${pid}`, { 
        name, 
        tracks: pl.tracks || [] 
      });
      await loadPlaylists();
      setRenamingId(null);
      setNewPlaylistName("");
    } catch (e) {
      alert(e?.response?.data?.message || "Échec du renommage.");
    }
  };

  // Ajouter un track aux favoris (pour utiliser dans les playlists)
  const addTrackToFavorites = async (track) => {
    try {
      const payload = {
        trackId: track.trackId || track.id,
        trackName: track.trackName || track.name,
        artistName: track.artistName || (Array.isArray(track.artists) ? track.artists.map(a => a.name || a).join(", ") : ""),
        albumImage: track.albumImage || track?.album?.images?.[0]?.url || "",
        previewUrl: track.preview_url || track.previewUrl || "",
        spotifyUrl: track.external_urls?.spotify || track.spotifyUrl || ""
      };
      await axios.post("/spotify/favorite-tracks", payload);
      // recharger les favoris pour mettre à jour l'UI
      if (typeof loadFavoriteTracks === "function") await loadFavoriteTracks();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("addTrackToFavorites failed", err?.response?.data || err?.message || err);
    }
  };

  // Remplacements UI principaux:
  // - favoris: cover plus grande + aucune icône Spotify d’action
  // - playlists: toolbar d’actions visible seulement quand la ligne est ouverte

  if (isLoading) {
    return (
      <div className="themes-page">
        <div className="themes-hero">
          <h1>Mes sons</h1>
          <p>Chargement de vos morceaux favoris…</p>
        </div>
        <div className="theme-detail-layout">
          <div className="theme-panel">
            <div className="theme-panel-header">
              <h4>
                <i className="bi bi-music-note-beamed" /> Favoris
              </h4>
            </div>
            <div className="theme-panel-body track-scroll">
              <div className="skel-block" style={{ height: 60, margin: "12px 10px 0" }} />
              <div className="skel-block" style={{ height: 60, margin: "12px 10px 0" }} />
              <div className="skel-block" style={{ height: 60, margin: "12px 10px 0" }} />
            </div>
          </div>
          <div className="theme-panel">
            <div className="theme-panel-header">
              <h4>
                <i className="bi bi-list-check" /> Playlist builder
              </h4>
            </div>
            <div className="theme-panel-body">
              <div className="skel-block" style={{ height: 160, margin: "12px 10px 0" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!localStorage.getItem("token")) {
    return (
      <div className="themes-page">
        <div className="themes-hero">
          <h1>Mes sons</h1>
          <p>Connectez-vous pour gérer vos morceaux et playlists.</p>
        </div>
      </div>
    );
  }

  const inBuilder = (id) => customPlaylist.some((t) => trackIdOf(t) === id);

  return (
    <div className="themes-page fade-in-soft">
      {/* HERO */}
      <div className="themes-hero fav-hero">
        <h1>Mes sons</h1>
        <p>Retrouvez vos favoris, construisez une playlist et (optionnel) envoyez-la vers Spotify.</p>
      </div>

      <div className="theme-detail-layout">
        {/* Favoris */}
        <section className="theme-panel">
          <header className="theme-panel-header">
            <h4>
              <i className="bi bi-heart-fill text-success"></i>
              Mes morceaux favoris
            </h4>
            <div className="select-tools">
              <button
                type="button"
                onClick={() => setCustomPlaylist([])}
                disabled={customPlaylist.length === 0}
                title="Vider la sélection"
                className="ghost-mini"
              >
                <i className="bi bi-trash"></i>
              </button>
            </div>
          </header>

          <div className="theme-panel-body track-scroll">
            {favoriteTracks.length === 0 ? (
              <div className="empty-hint">Aucun favori pour l'instant.</div>
            ) : (
              <div className="track-list">
                {favoriteTracks.map((t) => {
                  const isPlaying = currentTrack && trackIdOf(currentTrack) === trackIdOf(t);
                  const preview = !!trackPreviewUrl(t);
                  const duration = t?.duration_ms || t?.durationMs;
                  const pop = popularityOf(t);
                  const theme = inferTrackTheme(t);
                  const themeColor = trackThemeColors[theme] || "#1db954";

                  return (
                    <div
                      key={trackIdOf(t)}
                      className={`favorite-track-item ${isPlaying ? "playing" : ""} ${selectedTrack && trackIdOf(selectedTrack) === trackIdOf(t) ? "selected" : ""}`}
                      role="button"
                      onClick={() => handleTrackSelect(t)}
                    >
                      {/* Cover avec bouton play */}
                      <div className="track-cover-container">
                        <img 
                          className="track-cover-image" 
                          src={imageOf(t)} 
                          alt={t.trackName || t.name}
                          onError={(e) => { e.currentTarget.src = "/thumbnail-placeholder.jpg"; }}
                        />
                        {preview && (
                          <button
                            className={`track-play-btn ${isPlaying ? "playing" : ""}`}
                            onClick={(e) => { e.stopPropagation(); playPreview(t); }}
                            title={isPlaying ? "Pause" : "Écouter l'aperçu"}
                          >
                            <i className={`bi ${isPlaying ? "bi-pause-fill" : "bi-play-fill"}`} />
                          </button>
                        )}
                      </div>

                      {/* Informations principales */}
                      <div className="track-main-info">
                        <div className="track-title-line">
                          <h6 className="track-title-text">{t.trackName || t.name}</h6>
                          <div className="track-badges">
                            {!preview && <span className="status-badge no-preview">No preview</span>}
                            <span className="genre-badge" style={{ 
                              backgroundColor: `${themeColor}22`, 
                              color: themeColor 
                            }}>
                              {theme}
                            </span>
                          </div>
                        </div>
                        
                        <div className="track-subtitle">
                          <span className="artist-name">{artistText(t)}</span>
                          {albumNameOf(t) && (
                            <span className="album-separator"> • {albumNameOf(t)}</span>
                          )}
                        </div>

                        <div className="track-metadata">
                          {typeof pop === "number" && (
                            <span className="meta-item">Popularité: {pop}%</span>
                          )}
                          {duration && (
                            <span className="meta-item">{formatDuration(duration)}</span>
                          )}
                          {t.spotifyUrl && (
                            <a 
                              href={t.spotifyUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="spotify-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Ouvrir dans Spotify ↗
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="track-actions-column">
                        <button
                          className={`action-button add-button ${inBuilder(trackIdOf(t)) ? "active" : ""}`}
                          title={inBuilder(trackIdOf(t)) ? "Retirer du builder" : "Ajouter au builder"}
                          onClick={(e) => {
                            e.stopPropagation();
                            inBuilder(trackIdOf(t)) ? removeFromCustomPlaylist(trackIdOf(t)) : addToCustomPlaylist(t);
                          }}
                        >
                          <i className={`bi ${inBuilder(trackIdOf(t)) ? "bi-check-lg" : "bi-plus-lg"}`} />
                        </button>
                        
                        <button
                          className="action-button remove-button"
                          title="Retirer des favoris"
                          onClick={(e) => { e.stopPropagation(); removeFromFavorites(trackIdOf(t)); }}
                        >
                          <i className="bi bi-heart-fill" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Builder */}
        <aside className="theme-panel">
          <header className="theme-panel-header">
            <h4>
              <i className="bi bi-list-check"></i>
              Playlist builder
            </h4>
          </header>
          <div className="theme-panel-body">
            <div className="playlist-builder-sticky">
              <div className="row-line">
                <input
                  type="text"
                  placeholder="Nom de la playlist"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                />
                {editingPlaylistId ? (
                  <button className="btn-green" disabled={!customPlaylist.length || !playlistName} onClick={saveBuilderEdits} title="Enregistrer les modifications">
                    <i className="bi bi-check2-circle" /> Enregistrer
                  </button>
                ) : (
                  <>
                    <button className="btn-green" disabled={!customPlaylist.length || !playlistName} onClick={createLocalPlaylist} title="Créer une playlist locale">
                      <i className="bi bi-folder-plus" /> Locale
                    </button>
                    <button className="btn-green" disabled={!customPlaylist.length || !playlistName} onClick={createSpotifyPlaylist} title="Créer sur Spotify">
                      <i className="bi bi-spotify" /> Spotify
                    </button>
                  </>
                )}
              </div>
              <div className="builder-meta">
                <span className="sel-counter">{customPlaylist.length} sélection(s)</span>
                <button
                  className="btn-mini ghost-mini"
                  onClick={() => { setCustomPlaylist([]); setEditingPlaylistId(null); }}
                  disabled={!customPlaylist.length}
                  title="Vider"
                >
                  <i className="bi bi-trash" />
                </button>
              </div>
            </div>

            {customPlaylist.length === 0 ? (
              <div className="empty-hint">Sélectionnez des morceaux dans vos favoris pour construire votre playlist.</div>
            ) : (
              <div className="track-list">
                {customPlaylist.map((t) => (
                  <div key={trackIdOf(t)} className="track-row">
                    <img className="track-cover-sm" src={imageOf(t)} alt={t.trackName || t.name} />
                    <div className="track-mid">
                      <div className="t-title">{t.trackName || t.name}</div>
                      <div className="t-meta">
                        <span className="artist-strong">{artistText(t)}</span>
                      </div>
                    </div>
                    <div className="track-actions">
                      <button className="btn-mini" title="Retirer de la playlist" onClick={() => removeFromCustomPlaylist(trackIdOf(t))}>
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Playlists + Cocktails */}
      <div className="theme-detail-layout" style={{ marginTop: 34 }}>
        {/* Mes playlists */}
        <section className="theme-panel">
          <header className="theme-panel-header">
            <h4>
              <i className="bi bi-collection" /> Mes playlists
            </h4>
          </header>
          <div className="theme-panel-body">
            {loadingPlaylists ? (
              <div className="skel-block" style={{ height: 60, margin: "12px 10px 0" }} />
            ) : playlists.length === 0 ? (
              <div className="empty-hint">Aucune playlist enregistrée.</div>
            ) : (
              <div className="playlist-list">
                {playlists.map((pl) => {
                  const pid = pl._id || pl.id;
                  const imgs = (pl.tracks || []).map((t) => imageOf(t)).filter(Boolean);
                  const chosenIndex = coverChoice[pid] ?? 0;
                  const coverSrc = imgs[chosenIndex] || imgs[0] || placeholder;
                  const isOpen = selectedPlaylist && ((selectedPlaylist._id || selectedPlaylist.id) === pid);

                  return (
                    <div key={pid} className={`playlist-item ${isOpen ? "open" : ""}`}>
                      <div
                        className="playlist-header"
                        role="button"
                        onClick={() => handlePlaylistSelect(pl)}
                      >
                        <img className="playlist-cover-small" src={coverSrc} alt={pl.name || pl.title} />
                        <div className="playlist-info">
                          <div className="playlist-title">{pl.name || pl.title}</div>
                          <div className="playlist-count">{(pl.tracks?.length || 0) + " titres"}</div>
                        </div>

                        <div className="playlist-actions-compact" onClick={(e)=>e.stopPropagation()}>
                          <button className="icon-btn" title="Modifier dans le builder" onClick={() => editPlaylistInBuilder(pl)}>
                            <i className="bi bi-pencil-square"></i>
                          </button>
                          <button className="icon-btn spotify" title="Exporter vers Spotify" onClick={() => exportPlaylistToSpotify(pl)} disabled={!pl.tracks?.length}>
                            <i className="bi bi-spotify"></i>
                          </button>
                          <button className="icon-btn" title="Renommer" onClick={() => { setRenamingId(pid); setNewPlaylistName(pl.name || pl.title || ""); }}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="icon-btn danger" title="Supprimer" onClick={() => deletePlaylist(pid)}>
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="playlist-body">
                          {(pl.tracks || []).map((t) => {
                            const tid = trackIdOf(t);
                            const isFav = favoriteTracks.some(f => (f.trackId || f.id) === tid);
                            return (
                              <div
                                key={tid}
                                className="playlist-track-row"
                                role="button"
                                onClick={() => handleTrackSelect(t)}          // <-- clic propose cocktails
                              >
                                <img src={imageOf(t)} alt={t.trackName || t.name} className="track-thumb" />
                                <div className="track-meta-mini">
                                  <div className="track-name-mini">{t.trackName || t.name}</div>
                                  <div className="track-artist-mini">{artistText(t)}</div>
                                </div>

                                <div className="track-row-actions" onClick={(e)=>e.stopPropagation()}>
                                  <button
                                    className={`btn-mini-fav ${isFav ? "active" : ""}`}
                                    title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                                    onClick={async () => {
                                      // stopPropagation déjà géré, toggle simple
                                      if (isFav) {
                                        await removeFromFavorites(tid);
                                      } else {
                                        await addTrackToFavorites(t);
                                      }
                                    }}
                                  >
                                    <i className={`bi ${isFav ? "bi-heart-fill" : "bi-heart"}`} />
                                  </button>

                                  <button
                                    className="btn-remove"
                                    title="Retirer de la playlist"
                                    onClick={() => removeTrackFromPlaylist(pl, t)}
                                  >
                                    <i className="bi bi-x-lg" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {coverPickerFor === pid && imgs.length > 0 && (
                        <div className="cover-picker" onClick={(e) => e.stopPropagation()}>
                          <div className="cp-grid">
                            {imgs.map((src, idx) => (
                              <button key={idx} className={`cp-item ${idx === (coverChoice[pid] ?? 0) ? "active" : ""}`} onClick={() => { savePlaylistCover(pl, idx); setCoverPickerFor(null); }}>
                                <img src={src} alt="" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Cocktails suggérés */}
        <aside className="theme-panel">
          <header className="theme-panel-header">
            <h4>
              <i className="bi bi-cup-straw" /> Cocktails suggérés
            </h4>
          </header>
          <div className="theme-panel-body">
            {suggestedCocktails.length === 0 ? (
              <div className="empty-hint">Sélectionnez un morceau ou une playlist pour obtenir des idées.</div>
            ) : (
              <div className="suggested-cocktail-grid">
                {suggestedCocktails.map(c => (
                  <div key={c._id || c.id} className="cocktail-mini suggested" role="button" onClick={() => { window.location.href = `/cocktails/${c._id || c.id}`; }}>
                    <div className="cocktail-thumb-wrap">
                      <img src={getUploadUrl(c.thumbnail || c.image) || placeholder} alt={c.name} onError={(e)=>{e.currentTarget.src=placeholder}} />
                    </div>
                    <div className="cocktail-mini-body">
                      <h5>{c.name}</h5>
                      <div className="desc">{(c.description || "").slice(0, 120)}</div>
                      <div style={{marginTop:8, display:"flex", gap:8, alignItems:"center"}}>
                        <span className="theme-chip" style={{background:'#1db954', color:'#071'}}>{c.theme || ""}</span>
                        <button className="fav-mini" title="Ouvrir" onClick={(e)=>{ e.stopPropagation(); window.location.href = `/cocktails/${c._id || c.id}`; }}>
                          <i className="bi bi-box-arrow-up-right" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* lecteur preview + audio */}
      <audio ref={audioRef} style={{ display: "none" }} />
      {currentTrack && (
        <div className="mini-preview-bar">
          <div className="mp-left">
            <img src={imageOf(currentTrack)} alt="" />
            <div className="mp-text">
              <div className="mp-title">{currentTrack.trackName || currentTrack.name}</div>
              <div className="mp-artist">{artistText(currentTrack)}</div>
            </div>
          </div>
          <div className="mp-actions">
            <button className="mini" onClick={() => setCurrentTrack(null)} title="Pause">
              <i className="bi bi-pause-fill" />
            </button>
            {currentTrack?.external_urls?.spotify && (
              <a
                className="mini spotify"
                href={currentTrack.external_urls.spotify}
                target="_blank"
                rel="noreferrer"
                title="Spotify"
              >
                <i className="bi bi-spotify" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FavoriteTracksPage;