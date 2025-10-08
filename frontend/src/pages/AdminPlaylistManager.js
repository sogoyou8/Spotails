import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../axiosConfig';
import PlaylistDetailModal from '../components/PlaylistDetailModal';
import '../styles/AdminPlaylistManager.css';

const AdminPlaylistManager = () => {
  const navigate = useNavigate();
  
  // États analytics
  const [topPlaylists, setTopPlaylists] = useState([]);
  const [emptyPlaylists, setEmptyPlaylists] = useState([]);
  const [topCreators, setTopCreators] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [popularTracks, setPopularTracks] = useState([]);
  const [playlistGrowth, setPlaylistGrowth] = useState([]);
  
  // État pour le drill-down des créateurs
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [creatorPlaylists, setCreatorPlaylists] = useState([]);
  const [loadingCreator, setLoadingCreator] = useState(false);
  
  // Stats globales
  const [stats, setStats] = useState({
    total: 0,
    empty: 0,
    filled: 0,
    totalTracks: 0,
    avgTracksPerPlaylist: 0,
    activeCreators: 0
  });
  
  // États UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('overview');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // États pour le détail des morceaux
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [trackPlaylists, setTrackPlaylists] = useState([]);
  const [showTrackDetail, setShowTrackDetail] = useState(false);

  // États pour les filtres et l'export
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [viewStyle, setViewStyle] = useState('grid');
  const [selectedPlaylists, setSelectedPlaylists] = useState([]);

  // UI toggles / hover state
  const [showFilters, setShowFilters] = useState(false);
  const [hoveredPlaylist, setHoveredPlaylist] = useState(null);

  // === HELPERS (DÉCLARÉS EN PREMIER) ===
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return String(dateString);
    }
  };

  const formatDuration = (ms) => {
    if (!ms || isNaN(ms)) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const getPlaylistCover = (playlist) => {
    if (!playlist || !Array.isArray(playlist.tracks)) return null;
    const images = playlist.tracks
      .map(t => t.albumImage || t.album?.images?.[0]?.url)
      .filter(Boolean)
      .slice(0, 4);
    return images;
  };

  const PlaylistCover = ({ playlist, size = 'normal' }) => {
    const images = getPlaylistCover(playlist);
    const sizeClass = size === 'small' ? 'small' : '';
    
    if (!images || images.length === 0) {
      return (
        <div className={`playlist-cover empty ${sizeClass}`}>
          <i className="bi bi-music-note-list"></i>
        </div>
      );
    }
    
    if (images.length === 1) {
      return (
        <div className={`playlist-cover single ${sizeClass}`}>
          <img src={images[0]} alt={playlist.name} />
        </div>
      );
    }
    
    return (
      <div className={`playlist-cover collage-${images.length} ${sizeClass}`}>
        {images.map((img, i) => (
          <div key={i} className="cover-tile">
            <img src={img} alt="" />
          </div>
        ))}
      </div>
    );
  };

  // Normalisation d'un track
  const normalizeTrack = useCallback((track) => {
    if (!track) return null;
    
    const trackId = track.id || track.trackId || track._id;
    const trackName = track.name || track.trackName || 'Titre inconnu';
    const artistName = track.artistName || 
                       (Array.isArray(track.artists) ? track.artists.map(a => a.name || a).join(', ') : null) ||
                       track.artist?.name || 
                       'Artiste inconnu';
    
    const albumImage = track.albumImage || 
                       track.album?.images?.[0]?.url ||
                       track.album?.images?.[1]?.url ||
                       track.album?.images?.[2]?.url ||
                       '/thumbnail-placeholder.jpg';
    
    const previewUrl = track.previewUrl || track.preview_url || null;
    const spotifyUrl = track.spotifyUrl || 
                       track.external_urls?.spotify || 
                       (trackId ? `https://open.spotify.com/track/${trackId}` : null);
    
    const duration_ms = track.duration_ms || track.durationMs || 0;
    
    return {
      id: trackId,
      trackId: trackId,
      name: trackName,
      trackName: trackName,
      artistName: artistName,
      albumImage: albumImage,
      previewUrl: previewUrl,
      spotifyUrl: spotifyUrl,
      duration_ms: duration_ms,
      album: track.album || { name: 'Album inconnu', images: [] },
      count: track.count || 0 // IMPORTANT : garder le count
    };
  }, []);

  // Nettoyer les tracks d'une playlist
  const sanitizePlaylistTracks = useCallback((playlist) => {
    if (!playlist || !Array.isArray(playlist.tracks)) {
      return { ...playlist, tracks: [] };
    }
    
    const validTracks = playlist.tracks
      .map(normalizeTrack)
      .filter(t => t !== null && t.trackId);
    
    return {
      ...playlist,
      tracks: validTracks,
      trackCount: validTracks.length
    };
  }, [normalizeTrack]);

  // Détecter si une playlist a des données corrompues
  const isPlaylistCorrupted = useCallback((playlist) => {
    if (!playlist || !Array.isArray(playlist.tracks)) return false;
    
    const corruptedTracks = playlist.tracks.filter(t => 
      !t || 
      !t.trackId && !t.id && !t._id ||
      !t.trackName && !t.name ||
      !t.artistName && !Array.isArray(t.artists)
    );
    
    return corruptedTracks.length > 0;
  }, []);

  // === FILTRAGE ===
  const filteredPlaylists = useMemo(() => {
    let result = [...topPlaylists].map(sanitizePlaylistTracks);
    
    if (playlistSearch) {
      result = result.filter(p =>
        (p.name || '').toLowerCase().includes(playlistSearch.toLowerCase())
      );
    }
    
    if (creatorFilter) {
      result = result.filter(p => (p.username || '').toLowerCase() === creatorFilter.toLowerCase());
    }
    
    if (stateFilter === 'filled') {
      result = result.filter(p => p.tracks && p.tracks.length > 0);
    } else if (stateFilter === 'empty') {
      result = result.filter(p => !p.tracks || p.tracks.length === 0);
    } else if (stateFilter === 'corrupted') {
      result = result.filter(isPlaylistCorrupted);
    }
    
    result.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'trackCount') return (b.tracks?.length || 0) - (a.tracks?.length || 0);
      if (sortBy === 'createdAt') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'corruption') {
        const aCorrupted = isPlaylistCorrupted(a) ? 1 : 0;
        const bCorrupted = isPlaylistCorrupted(b) ? 1 : 0;
        return bCorrupted - aCorrupted;
      }
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    
    return result;
  }, [topPlaylists, playlistSearch, creatorFilter, stateFilter, sortBy, sanitizePlaylistTracks, isPlaylistCorrupted]);

  const uniqueCreators = useMemo(() => {
    return [...new Set(topPlaylists.map(p => p.username || 'Anonyme'))].sort();
  }, [topPlaylists]);

  // === CHARGEMENT DES DONNÉES ===
  useEffect(() => {
    loadPlaylistsAnalytics();
  }, []);

  const loadPlaylistsAnalytics = async () => {
    setLoading(true);
    setError('');
    
    const normalize = (res) => {
      return res.data?.data ?? res.data?.playlists ?? res.data ?? (Array.isArray(res) ? res : []);
    };

    try {
      const [
        topRes,
        emptyRes,
        creatorsRes,
        activityRes,
        statsRes,
        tracksRes,
        growthRes
      ] = await Promise.all([
        axios.get('/playlists/admin/top'),
        axios.get('/playlists/admin/empty'),
        axios.get('/playlists/admin/by-creator'),
        axios.get('/playlists/admin/recent-activity'),
        axios.get('/playlists/admin/stats'),
        axios.get('/playlists/admin/popular-tracks'),
        axios.get('/playlists/admin/growth')
      ]);

      setTopPlaylists(normalize(topRes).map(sanitizePlaylistTracks));
      setEmptyPlaylists(normalize(emptyRes).map(sanitizePlaylistTracks));
      setTopCreators(normalize(creatorsRes));
      setRecentActivity(normalize(activityRes).map(sanitizePlaylistTracks));
      
      // ✅ CORRECTION : Normaliser les tracks populaires SANS perdre le count
      const rawTracks = normalize(tracksRes);
      const normalizedTracks = rawTracks.map(t => {
        const normalized = normalizeTrack(t);
        return normalized ? { ...normalized, count: t.count || 0 } : null;
      }).filter(Boolean);
      setPopularTracks(normalizedTracks);
      
      setPlaylistGrowth(normalize(growthRes));

      const s = statsRes?.data ?? statsRes;
      setStats({
        total: s?.total ?? 0,
        empty: s?.empty ?? (Array.isArray(emptyRes?.data) ? emptyRes.data.length : (emptyRes?.data?.length ?? 0)),
        filled: s?.filled ?? (s?.total ? s.total - (s?.empty ?? 0) : 0),
        totalTracks: s?.totalTracks ?? 0,
        avgTracksPerPlaylist: s?.avgTracksPerPlaylist ?? (s?.avg || 0),
        activeCreators: s?.activeCreators ?? (Array.isArray(creatorsRes?.data) ? creatorsRes.data.length : 0)
      });

    } catch (err) {
      console.error('Erreur chargement analytics:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Charger les playlists d'un créateur
  const loadCreatorPlaylists = async (creator) => {
    setLoadingCreator(true);
    setSelectedCreator(creator);
    
    try {
      const res = await axios.get(`/playlists/admin/user/${creator._id || creator.userId}`);
      const playlists = (res.data?.data || res.data?.playlists || res.data || []).map(sanitizePlaylistTracks);
      setCreatorPlaylists(playlists);
    } catch (err) {
      console.error('Erreur chargement playlists créateur:', err);
      setError('Erreur lors du chargement des playlists du créateur');
      setCreatorPlaylists([]);
    } finally {
      setLoadingCreator(false);
    }
  };

  // === ACTIONS ===
  const handleDeletePlaylist = async (playlistId) => {
    if (!window.confirm('Supprimer cette playlist ?')) return;
    
    try {
      await axios.delete(`/playlists/${playlistId}`);
      loadPlaylistsAnalytics();
      if (selectedCreator) {
        loadCreatorPlaylists(selectedCreator);
      }
    } catch (err) {
      console.error('Erreur suppression:', err);
      alert('Erreur lors de la suppression');
    }
  };

  const handleCleanupEmpty = async () => {
    if (!window.confirm('Supprimer toutes les playlists vides ?')) return;
    
    try {
      const res = await axios.delete('/playlists/admin/cleanup-empty');
      alert(`${res.data.deletedCount} playlist(s) supprimée(s)`);
      loadPlaylistsAnalytics();
    } catch (err) {
      console.error('Erreur nettoyage:', err);
      alert('Erreur lors du nettoyage');
    }
  };

  const openPlaylistDetail = async (playlist) => {
    try {
      const res = await axios.get(`/playlists/admin/${playlist._id}/tracks`);
      setSelectedPlaylist(res.data.playlist);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Erreur détails:', err);
      alert('Impossible de charger les détails');
    }
  };

  // Voir les playlists contenant un morceau
  const handleViewTrackPlaylists = async (track) => {
    try {
      const trackId = track.trackId || track.id || track._id;
      const res = await axios.get(`/playlists/admin/track/${trackId}`);
      setTrackPlaylists(res.data.playlists || []);
      setSelectedTrack(track);
      setShowTrackDetail(true);
    } catch (err) {
      console.error('Erreur chargement playlists du track:', err);
      alert('Impossible de charger les playlists contenant ce morceau');
    }
  };

  const togglePlaylistSelection = (id) => {
    setSelectedPlaylists(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const resetFilters = () => {
    setPlaylistSearch('');
    setCreatorFilter('');
    setStateFilter('all');
    setSortBy('updatedAt');
  };

  const handleBulkDelete = async () => {
    if (selectedPlaylists.length === 0) return;
    if (!window.confirm(`Supprimer ${selectedPlaylists.length} playlists ?`)) return;
    
    try {
      await Promise.all(selectedPlaylists.map(id => axios.delete(`/playlists/${id}`)));
      setSelectedPlaylists([]);
      loadPlaylistsAnalytics();
    } catch (err) {
      console.error('Erreur suppression groupée:', err);
      alert('Erreur lors de la suppression');
    }
  };

  const handleDuplicatePlaylist = async (playlist) => {
    const newName = prompt('Nom de la nouvelle playlist:', `${playlist.name} (copie)`);
    if (!newName) return;
    
    try {
      await axios.post('/playlists', {
        name: newName,
        tracks: playlist.tracks || []
      });
      loadPlaylistsAnalytics();
      alert('Playlist dupliquée avec succès !');
    } catch (err) {
      console.error('Erreur duplication:', err);
      alert('Erreur lors de la duplication');
    }
  };

  const handleRepairPlaylist = async (playlist) => {
    const corruptedCount = playlist.tracks.filter(t => !t.trackName || !t.artistName).length;
    
    if (!window.confirm(
      `Cette playlist contient ${corruptedCount} track(s) avec des données manquantes.\n\n` +
      `Voulez-vous supprimer les tracks corrompus ?`
    )) return;
    
    try {
      const validTracks = playlist.tracks
        .map(normalizeTrack)
        .filter(t => t && t.trackId);
      
      await axios.put(`/playlists/${playlist._id}`, {
        tracks: validTracks
      });
      
      alert(`Playlist réparée ! ${validTracks.length} tracks conservés, ${corruptedCount} supprimés.`);
      loadPlaylistsAnalytics();
      
      if (selectedCreator) {
        loadCreatorPlaylists(selectedCreator);
      }
    } catch (err) {
      console.error('Erreur réparation:', err);
      alert('Erreur lors de la réparation');
    }
  };

  const handleBulkExport = () => {
    if (!selectedPlaylists || selectedPlaylists.length === 0) {
      return alert('Aucune playlist sélectionnée pour l\'export.');
    }

    const data = topPlaylists
      .filter(p => selectedPlaylists.includes(p._id))
      .map(p => sanitizePlaylistTracks(p));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playlists_selection_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkRepair = async () => {
    const corruptedIds = selectedPlaylists.filter(id => {
      const pl = topPlaylists.find(p => p._id === id);
      return isPlaylistCorrupted(pl);
    });

    if (corruptedIds.length === 0) {
      alert('Aucune playlist corrompue sélectionnée.');
      return;
    }

    if (!window.confirm(`Réparer ${corruptedIds.length} playlist(s) corrompue(s) ?`)) return;

    try {
      for (const id of corruptedIds) {
        const pl = topPlaylists.find(p => p._id === id);
        if (!pl) continue;
        const validTracks = (pl.tracks || []).map(normalizeTrack).filter(t => t && t.trackId);
        await axios.put(`/playlists/${id}`, { tracks: validTracks });
      }
      setSelectedPlaylists([]);
      await loadPlaylistsAnalytics();
      alert(`${corruptedIds.length} playlist(s) réparée(s).`);
    } catch (err) {
      console.error('Erreur lors de la réparation groupée :', err);
      alert('Erreur lors de la réparation groupée.');
    }
  };

  const handleExportAll = () => {
    const data = filteredPlaylists.map(p => sanitizePlaylistTracks(p));
    const payload = {
      exportedAt: new Date().toISOString(),
      total: data.length,
      playlists: data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playlists_export_all_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render continues...
  if (loading) {
    return (
      <div className="admin-playlist-manager">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Chargement des analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-playlist-manager">
      {/* HEADER */}
      <div className="admin-header">
        <div className="breadcrumb">
          <Link to="/admin" className="breadcrumb-link">
            <i className="bi bi-house"></i> Dashboard
          </Link>
          <i className="bi bi-chevron-right" />
          <span>Gestion des playlists</span>
        </div>

        <div className="header-main">
          <h1 className="page-title">Gestion des Playlists</h1>
          <div className="stats">
            <span className="stat-item">
              <i className="bi bi-collection"></i>
              {stats.total} playlists
            </span>
            <span className="stat-item filled">
              <i className="bi bi-music-note-beamed"></i>
              {stats.filled} avec morceaux
            </span>
            <span className="stat-item empty">
              <i className="bi bi-exclamation-triangle"></i>
              {stats.empty} vides
            </span>
            <span className="stat-item tracks">
              <i className="bi bi-disc"></i>
              {stats.totalTracks} morceaux
            </span>
          </div>
        </div>

        <div className="header-actions">
          <button onClick={loadPlaylistsAnalytics} className="btn-primary">
            <i className="bi bi-arrow-clockwise"></i>
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <i className="bi bi-exclamation-triangle"></i>
          {error}
        </div>
      )}

      {/* VIEW TABS */}
      <div className="view-controls">
        <div className="view-tabs">
          <button 
            className={`tab-btn ${viewMode === 'overview' ? 'active' : ''}`}
            onClick={() => { setViewMode('overview'); setSelectedCreator(null); }}
          >
            <i className="bi bi-speedometer2"></i>
            Vue d'ensemble
          </button>
          <button 
            className={`tab-btn ${viewMode === 'playlists' ? 'active' : ''}`}
            onClick={() => { setViewMode('playlists'); setSelectedCreator(null); }}
          >
            <i className="bi bi-list-ul"></i>
            Toutes les playlists
          </button>
        </div>
      </div>

      <div className="admin-container">
        {/* === OVERVIEW === */}
        {viewMode === 'overview' && !selectedCreator && (
          <div className="overview-grid">
            {/* 1️⃣ TOP PLAYLISTS - ✅ CORRECTION COVERS */}
            <div className="analytics-card">
              <div className="card-header">
                <h3>
                  <i className="bi bi-trophy"></i>
                  Top Playlists
                </h3>
                <span className="badge success">{Math.min(topPlaylists.length, 5)}</span>
              </div>
              <div className="card-body">
                <div className="section-explanation">
                  <p>Les 5 playlists avec le plus de morceaux</p>
                </div>
                {topPlaylists.length === 0 ? (
                  <div className="empty-hint">
                    <i className="bi bi-music-note-list"></i>
                    <p>Aucune playlist</p>
                  </div>
                ) : (
                  topPlaylists.slice(0, 5).map((playlist, index) => (
                    <div key={playlist._id} className="podium-item">
                      <div className="podium-rank">#{index + 1}</div>
                      
                      <div className="podium-avatar">
                        <PlaylistCover playlist={playlist} size="small" />
                      </div>
                      
                      <div className="podium-info">
                        <h5>{playlist.name}</h5>
                        <div className="podium-meta">
                          <span className="creator-chip">
                            <i className="bi bi-person"></i>
                            {playlist.username || 'Anonyme'}
                          </span>
                          <span className="tracks-count">
                            <i className="bi bi-music-note"></i>
                            {playlist.tracks?.length || 0}
                          </span>
                        </div>
                      </div>
                      
                      <div className="podium-actions">
                        <button
                          onClick={() => openPlaylistDetail(playlist)}
                          className="action-btn view-btn"
                          title="Voir"
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2️⃣ TOP CRÉATEURS */}
            <div className="analytics-card">
              <div className="card-header">
                <h3>
                  <i className="bi bi-people"></i>
                  Top Créateurs
                </h3>
                <span className="badge success">{Math.min(topCreators.length, 5)}</span>
              </div>
              <div className="card-body">
                <div className="section-explanation">
                  <p>Les 5 utilisateurs les plus actifs (cliquez pour voir leurs playlists)</p>
                </div>
                {topCreators.length === 0 ? (
                  <div className="empty-hint">
                    <i className="bi bi-people"></i>
                    <p>Aucun créateur</p>
                  </div>
                ) : (
                  topCreators.slice(0, 5).map((creator, index) => {
                    const initial = (creator.username || 'U')[0].toUpperCase();
                    const colors = ['#1db954', '#3b82f6', '#8b5cf6', '#f39c12', '#e74c3c'];
                    const bgColor = colors[index % colors.length];
                    
                    return (
                      <div 
                        key={creator._id || creator.userId} 
                        className="user-item clickable"
                        onClick={() => loadCreatorPlaylists(creator)}
                      >
                        <div className="user-rank">{index + 1}</div>
                        <div className="user-avatar">
                          <div className="avatar-placeholder" style={{ background: bgColor }}>
                            {initial}
                          </div>
                        </div>
                        <div className="user-info">
                          <h6>{creator.username}</h6>
                          <div className="user-meta">
                            <div className="favorites-count">
                              <i className="bi bi-music-note-list"></i>
                              {creator.playlistCount} playlists
                            </div>
                            <div className="tracks-total">
                              <i className="bi bi-disc"></i>
                              {creator.totalTracks} morceaux
                            </div>
                          </div>
                        </div>
                        
                        <div className="user-actions">
                          <i className="bi bi-chevron-right"></i>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3️⃣ ACTIVITÉ RÉCENTE - ✅ AMÉLIORÉE */}
            <div className="analytics-card">
              <div className="card-header">
                <h3>
                  <i className="bi bi-clock-history"></i>
                  Activité Récente
                </h3>
                <span className="badge success">{Math.min(recentActivity.length, 5)}</span>
              </div>
              <div className="card-body">
                <div className="section-explanation">
                  <p>5 dernières modifications de playlists</p>
                </div>
                {recentActivity.length === 0 ? (
                  <div className="empty-hint">
                    <i className="bi bi-clock"></i>
                    <p>Aucune activité récente</p>
                  </div>
                ) : (
                  recentActivity.slice(0, 5).map((activity) => {
                    const isEmpty = !activity.tracks || activity.tracks.length === 0;
                    const totalDuration = (activity.tracks || []).reduce(
                      (sum, t) => sum + (t.duration_ms || 0), 0
                    );
                    
                    return (
                      <div key={activity._id} className="podium-item">
                        <div className="podium-avatar">
                          <PlaylistCover playlist={activity} size="small" />
                        </div>
                        
                        <div className="podium-info">
                          <h5>{activity.name}</h5>
                          <div className="podium-meta">
                            <span className="creator-chip">
                              <i className="bi bi-person"></i>
                              {activity.username || 'Anonyme'}
                            </span>
                            <span className={`tracks-count ${isEmpty ? 'empty' : ''}`}>
                              <i className="bi bi-music-note"></i>
                              {isEmpty ? 'Vide' : `${activity.tracks.length} morceaux`}
                            </span>
                            {!isEmpty && (
                              <span className="duration-info">
                                <i className="bi bi-clock"></i>
                                {formatDuration(totalDuration)}
                              </span>
                            )}
                          </div>
                          <div className="activity-time">
                            <i className="bi bi-calendar-check"></i>
                            Modifiée {formatDate(activity.updatedAt)}
                          </div>
                        </div>
                        
                        <div className="podium-actions">
                          <button
                            onClick={() => openPlaylistDetail(activity)}
                            className="action-btn view-btn"
                            title="Voir"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 4️⃣ MORCEAUX POPULAIRES - ✅ CORRECTION COMPLÈTE */}
            <div className="analytics-card">
              <div className="card-header">
                <h3>
                  <i className="bi bi-fire"></i>
                  Morceaux Populaires
                </h3>
                <span className="badge success">{Math.min(popularTracks.length, 10)}</span>
              </div>
              <div className="card-body">
                <div className="section-explanation">
                  <p>Top 10 des morceaux les plus ajoutés aux playlists</p>
                </div>
                {popularTracks.length === 0 ? (
                  <div className="empty-hint">
                    <i className="bi bi-music-note"></i>
                    <p>Aucun morceau populaire</p>
                  </div>
                ) : (
                  <div className="popular-tracks-list">
                    {popularTracks.slice(0, 10).map((track, index) => {
                      const imageUrl = track.albumImage || '/thumbnail-placeholder.jpg';
                      const trackName = track.trackName || track.name || 'Titre inconnu';
                      const artistName = track.artistName || 'Artiste inconnu';
                      const playlistCount = track.count || 0;
                      
                      return (
                        <div 
                          key={track.trackId || track._id || index} 
                          className="popular-track-item"
                          onClick={() => handleViewTrackPlaylists(track)}
                          role="button"
                          tabIndex={0}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="track-rank-badge">#{index + 1}</div>
                          
                          <div className="track-cover-wrapper">
                            <img 
                              src={imageUrl}
                              alt={trackName}
                              className="track-cover-img"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = '<div class="track-cover-fallback"><i class="bi bi-music-note"></i></div>';
                              }}
                            />
                          </div>
                          
                          <div className="track-info-column">
                            <div className="track-name-line">
                              <div className="track-name" title={trackName}>{trackName}</div>
                              {index < 3 && (
                                <span className="trending-badge">
                                  <i className="bi bi-fire"></i> Trending
                                </span>
                              )}
                            </div>
                            <div className="track-meta-line">
                              <span className="artist-name">{artistName}</span>
                              {track.album?.name && (
                                <>
                                  <span> • </span>
                                  <span className="album-name">{track.album.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="track-stats-column">
                            <div className="playlist-count-badge">
                              <i className="bi bi-collection"></i>
                              <strong>{playlistCount}</strong>
                              <span className="count-label">playlist{playlistCount > 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          
                          <div className="track-actions-column">
                            {track.spotifyUrl && (
                              <a
                                href={track.spotifyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="action-btn spotify-btn"
                                title="Ouvrir dans Spotify"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <i className="bi bi-spotify"></i>
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 5️⃣ CROISSANCE - ✅ DESIGN AMÉLIORÉ */}
            <div className="analytics-card">
              <div className="card-header">
                <h3>
                  <i className="bi bi-graph-up"></i>
                  Croissance
                </h3>
              </div>
              <div className="card-body">
                <div className="section-explanation">
                  <p>Nouvelles playlists sur les 7 derniers jours</p>
                </div>
                {playlistGrowth.length === 0 ? (
                  <div className="empty-hint">
                    <i className="bi bi-graph-up"></i>
                    <p>Pas de données</p>
                  </div>
                ) : (
                  <div className="growth-chart">
                    {playlistGrowth.map((day, index) => {
                      const maxCount = Math.max(...playlistGrowth.map(d => d.count || 0), 1);
                      const percentage = (day.count / maxCount) * 100;
                      const isToday = index === playlistGrowth.length - 1;
                      
                      return (
                        <div key={day.date || index} className="growth-day">
                          <div className="day-label">{day.label || formatDate(day.date)}</div>
                          <div className="growth-bar-container">
                            <div 
                              className={`growth-bar ${isToday ? 'today' : ''}`}
                              style={{
                                width: `${percentage}%`,
                                background: day.count > 0 
                                  ? (isToday ? '#1ed760' : '#1db954') 
                                  : '#333'
                              }}
                            />
                          </div>
                          <div className="growth-count">
                            {day.count}
                            {isToday && day.count > 0 && (
                              <i className="bi bi-arrow-up-short" style={{ color: '#1ed760' }}></i>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 6️⃣ INSIGHTS */}
            <div className="analytics-card">
              <div className="card-header">
                <h3>
                  <i className="bi bi-lightbulb"></i>
                  Insights
                </h3>
              </div>
              <div className="card-body">
                <div className="insights-list">
                  <div className="insight-item success">
                    <div className="insight-icon">
                      <i className="bi bi-check-circle"></i>
                    </div>
                    <div className="insight-content">
                      <h6>Excellente adoption</h6>
                      <p>
                        {stats.filled} playlists avec morceaux
                        ({Math.round((stats.filled / (stats.total || 1)) * 100)}%)
                      </p>
                      <span className="insight-action">
                        Engagement fort !
                      </span>
                    </div>
                  </div>

                  <div className="insight-item info">
                    <div className="insight-icon">
                      <i className="bi bi-graph-up"></i>
                    </div>
                    <div className="insight-content">
                      <h6>Moyenne par playlist</h6>
                      <p>
                        {stats.avgTracksPerPlaylist.toFixed(1)} morceaux
                      </p>
                      <span className="insight-action">
                        Performance stable
                      </span>
                    </div>
                  </div>

                  {stats.empty > 0 && (
                    <div className="insight-item warning">
                      <div className="insight-icon">
                        <i className="bi bi-exclamation-triangle"></i>
                      </div>
                      <div className="insight-content">
                        <h6>Playlists vides</h6>
                        <p>{stats.empty} sans contenu</p>
                        <span className="insight-action">
                          <button 
                            onClick={handleCleanupEmpty}
                            className="cleanup-btn"
                          >
                            Nettoyer maintenant
                          </button>
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="insight-item creative">
                    <div className="insight-icon">
                      <i className="bi bi-stars"></i>
                    </div>
                    <div className="insight-content">
                      <h6>Créateurs actifs</h6>
                      <p>
                        {stats.activeCreators} utilisateurs
                      </p>
                      <span className="insight-action">
                        Communauté dynamique !
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VUE DRILL-DOWN - PLAYLISTS D'UN CRÉATEUR */}
        {selectedCreator && (
          <div className="creator-detail-view">
            {/* === HEADER MAGNIFIÉE === */}
            <div className="creator-detail-header-premium">
              <button 
                onClick={() => { setSelectedCreator(null); setCreatorPlaylists([]); }}
                className="btn-back-premium"
              >
                <i className="bi bi-arrow-left"></i>
                <span>Retour</span>
              </button>

              <div className="creator-hero">
                <div className="creator-avatar-xl">
                  {(selectedCreator.username || 'U')[0].toUpperCase()}
                </div>

                <div className="creator-info-xl">
                  <div className="creator-badge">
                    <i className="bi bi-shield-check"></i>
                    Créateur
                  </div>
                  <h1 className="creator-name">{selectedCreator.username}</h1>
                  
                  <div className="creator-stats-grid">
                    <div className="stat-pill-xl">
                      <i className="bi bi-collection"></i>
                      <div className="stat-content">
                        <strong>{creatorPlaylists.length}</strong>
                        <span>playlists</span>
                      </div>
                    </div>
                    
                    <div className="stat-pill-xl">
                      <i className="bi bi-music-note-list"></i>
                      <div className="stat-content">
                        <strong>{selectedCreator.totalTracks ?? creatorPlaylists.reduce((s, p) => s + (p.tracks?.length || 0), 0)}</strong>
                        <span>morceaux</span>
                      </div>
                    </div>
                    
                    <div className="stat-pill-xl success">
                      <i className="bi bi-check-circle"></i>
                      <div className="stat-content">
                        <strong>{creatorPlaylists.filter(p => p.tracks && p.tracks.length > 0).length}</strong>
                        <span>avec morceaux</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {loadingCreator ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Chargement des playlists...</p>
              </div>
            ) : creatorPlaylists.length === 0 ? (
              <div className="empty-state">
                <i className="bi bi-music-note-list"></i>
                <h3>Aucune playlist</h3>
                <p>Cet utilisateur n'a pas encore créé de playlist</p>
              </div>
            ) : (
              <>
                {/* === BARRE DE CONTRÔLES PREMIUM === */}
                <div className="creator-controls-bar">
                  <div className="search-filter-group">
                    <div className="search-box-premium">
                      <i className="bi bi-search"></i>
                      <input
                        type="text"
                        placeholder="Rechercher dans les playlists..."
                        onChange={(e) => {
                          const query = e.target.value.toLowerCase();
                          if (!query) {
                            loadCreatorPlaylists(selectedCreator);
                            return;
                          }
                          const filtered = creatorPlaylists.filter(p => 
                            (p.name || '').toLowerCase().includes(query)
                          );
                          setCreatorPlaylists(filtered);
                        }}
                        className="search-input-premium"
                      />
                    </div>

                    <select 
                      className="filter-select-premium"
                      onChange={(e) => {
                        const filter = e.target.value;
                        let filtered = [...creatorPlaylists];
                        
                        if (filter === 'filled') {
                          filtered = filtered.filter(p => p.tracks && p.tracks.length > 0);
                        } else if (filter === 'empty') {
                          filtered = filtered.filter(p => !p.tracks || p.tracks.length === 0);
                        } else if (filter === 'corrupted') {
                          filtered = filtered.filter(p => isPlaylistCorrupted(p));
                        }
                        
                        setCreatorPlaylists(filtered);
                      }}
                    >
                      <option value="all">Toutes</option>
                      <option value="filled">Avec morceaux</option>
                      <option value="empty">Vides</option>
                      <option value="corrupted">Corrompues</option>
                    </select>

                    <select 
                      className="sort-select-premium"
                      onChange={(e) => {
                        const sort = e.target.value;
                        const sorted = [...creatorPlaylists].sort((a, b) => {
                          if (sort === 'name') return (a.name || '').localeCompare(b.name || '');
                          if (sort === 'trackCount') return (b.tracks?.length || 0) - (a.tracks?.length || 0);
                          if (sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
                          return new Date(b.createdAt) - new Date(a.createdAt);
                        });
                        setCreatorPlaylists(sorted);
                      }}
                    >
                      <option value="newest">Plus récentes</option>
                      <option value="oldest">Plus anciennes</option>
                      <option value="name">Nom (A-Z)</option>
                      <option value="trackCount">Nombre de morceaux</option>
                    </select>
                  </div>

                  <div className="actions-group-premium">
                    <button 
                      className="btn-refresh-premium"
                      onClick={() => loadCreatorPlaylists(selectedCreator)}
                      title="Actualiser"
                    >
                      <i className="bi bi-arrow-clockwise"></i>
                      Actualiser
                    </button>
                  </div>
                </div>

                {/* === GRILLE PLAYLISTS PREMIUM === */}
                <div className="playlists-grid-spotify">
                  {creatorPlaylists.map((playlist, index) => {
                    const isEmpty = !playlist.tracks || playlist.tracks.length === 0;
                    const totalDuration = (playlist.tracks || []).reduce(
                      (sum, t) => sum + (t.duration_ms || 0), 0
                    );
                    const isCorrupted = isPlaylistCorrupted(playlist);
                    const corruptedCount = (playlist.tracks || []).filter(t => 
                      !t.trackName || !t.artistName
                    ).length;
                    
                    return (
                      <div 
                        key={playlist._id} 
                        className={`playlist-card-spotify ${isEmpty ? 'empty' : ''} ${isCorrupted ? 'corrupted' : ''}`}
                      >
                        {/* Badge rang */}
                        <div className="rank-badge-spotify">#{index + 1}</div>

                        {/* Status indicators */}
                        {isEmpty && (
                          <div className="status-badge-spotify empty">
                            <i className="bi bi-exclamation-triangle"></i>
                            Vide
                          </div>
                        )}
                        
                        {isCorrupted && (
                          <div className="status-badge-spotify corrupted">
                            <i className="bi bi-tools"></i>
                            {corruptedCount} corrompus
                          </div>
                        )}

                        {/* Cover avec hover premium */}
                        <div 
                          className="cover-container-spotify"
                          onClick={() => openPlaylistDetail(playlist)}
                        >
                          <PlaylistCover playlist={playlist} />
                          
                          <div className="cover-overlay-spotify">
                            <button className="play-button-spotify">
                              <i className="bi bi-play-fill"></i>
                            </button>
                            
                            {!isEmpty && (
                              <div className="quick-preview-spotify">
                                <div className="preview-tracks-count">
                                  <i className="bi bi-music-note-beamed"></i>
                                  {playlist.tracks.length} morceaux
                                </div>
                                <div className="preview-duration">
                                  <i className="bi bi-clock"></i>
                                  {formatDuration(totalDuration)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Informations */}
                        <div className="info-section-spotify">
                          <h3 className="playlist-name-spotify">{playlist.name}</h3>
                          
                          <div className="metadata-spotify">
                            <span className="date-spotify">
                              <i className="bi bi-calendar3"></i>
                              {formatDate(playlist.createdAt)}
                            </span>
                            
                            {!isEmpty && (
                              <>
                                <span className="separator-spotify">•</span>
                                <span className="tracks-spotify">
                                  {playlist.tracks.length} morceaux
                                </span>
                              </>
                            )}
                            
                            {isCorrupted && (
                              <>
                                <span className="separator-spotify">•</span>
                                <span className="corrupted-spotify">
                                  <i className="bi bi-exclamation-circle"></i>
                                  À réparer
                                </span>
                              </>
                            )}
                          </div>

                          {/* Actions toolbar */}
                          <div className="actions-toolbar-spotify">
                            <button
                              onClick={() => openPlaylistDetail(playlist)}
                              className="action-spotify view"
                              title="Voir détails"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            
                            {isCorrupted && (
                              <button
                                onClick={() => handleRepairPlaylist(playlist)}
                                className="action-spotify repair"
                                title="Réparer"
                              >
                                <i className="bi bi-tools"></i>
                              </button>
                            )}
                            
                            <button
                              onClick={() => handleDuplicatePlaylist(playlist)}
                              className="action-spotify duplicate"
                              title="Dupliquer"
                            >
                              <i className="bi bi-files"></i>
                            </button>
                            
                            <button
                              onClick={() => handleDeletePlaylist(playlist._id)}
                              className="action-spotify delete"
                              title="Supprimer"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ALL MODE - VERSION PRO AMÉLIORÉE */}
        {viewMode === 'playlists' && !selectedCreator && (
          <div className="content-section">
            {/* === HEADER PREMIUM === */}
            <div className="playlists-header-premium">
              <div className="header-left">
                <h2>
                  <i className="bi bi-collection-fill"></i>
                  Toutes les Playlists
                </h2>
                <p className="header-subtitle">
                  Gérez, filtrez et explorez toutes les playlists créées
                </p>
                
                <div className="header-stats-inline">
                  <div className="stat-pill-inline">
                    <i className="bi bi-collection"></i>
                    <div>
                      <strong>{filteredPlaylists.length}</strong>
                      <span>affichées</span>
                    </div>
                  </div>
                  
                  <div className="stat-pill-inline success">
                    <i className="bi bi-check-circle-fill"></i>
                    <div>
                      <strong>{filteredPlaylists.filter(p => (p.tracks?.length || 0) > 0).length}</strong>
                      <span>remplies</span>
                    </div>
                  </div>
                  
                  <div className="stat-pill-inline warning">
                    <i className="bi bi-exclamation-triangle-fill"></i>
                    <div>
                      <strong>{filteredPlaylists.filter(p => (p.tracks?.length || 0) === 0).length}</strong>
                      <span>vides</span>
                    </div>
                  </div>
                  
                  <div className="stat-pill-inline error">
                    <i className="bi bi-x-circle-fill"></i>
                    <div>
                      <strong>{filteredPlaylists.filter(isPlaylistCorrupted).length}</strong>
                      <span>corrompues</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* === BARRE DE CONTRÔLES PREMIUM === */}
            <div className="playlists-controls-premium">
              <div className="controls-row">
                {/* Recherche */}
                <div className="search-container-premium">
                  <i className="bi bi-search"></i>
                  <input
                    type="text"
                    placeholder="Rechercher une playlist..."
                    value={playlistSearch}
                    onChange={(e) => setPlaylistSearch(e.target.value)}
                    className="search-input-premium"
                  />
                  {playlistSearch && (
                    <button 
                      onClick={() => setPlaylistSearch('')} 
                      className="clear-btn-premium"
                    >
                      <i className="bi bi-x"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* Filtres sous forme de chips */}
              <div className="filters-chips-row">
                <div className="filter-chip-group">
                  <label>État</label>
                  <select 
                    value={stateFilter} 
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="filter-select-modern"
                  >
                    <option value="all">Tous</option>
                    <option value="filled">Avec morceaux</option>
                    <option value="empty">Vides</option>
                    <option value="corrupted">Corrompues</option>
                  </select>
                </div>

                <div className="filter-chip-group">
                  <label>Créateur</label>
                  <select 
                    value={creatorFilter} 
                    onChange={(e) => setCreatorFilter(e.target.value)}
                    className="filter-select-modern"
                  >
                    <option value="">Tous</option>
                    {uniqueCreators.map(creator => (
                      <option key={creator} value={creator}>{creator}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-chip-group">
                  <label>Trier par</label>
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    className="filter-select-modern"
                  >
                    <option value="updatedAt">Date modification</option>
                    <option value="createdAt">Date création</option>
                    <option value="name">Nom (A-Z)</option>
                    <option value="trackCount">Nombre de morceaux</option>
                    <option value="corruption">Corruption</option>
                  </select>
                </div>
              </div>

              {/* Actions globales */}
              <div className="actions-row-premium">
                <button
                  onClick={() => setViewStyle(viewStyle === 'grid' ? 'list' : 'grid')}
                  className="btn-action-modern"
                  title={viewStyle === 'grid' ? 'Vue liste' : 'Vue grille'}
                >
                  <i className={`bi ${viewStyle === 'grid' ? 'bi-list-ul' : 'bi-grid-3x3-gap'}`}></i>
                  {viewStyle === 'grid' ? 'Liste' : 'Grille'}
                </button>

                <button
                  onClick={resetFilters}
                  className="btn-action-modern reset"
                  disabled={!playlistSearch && !creatorFilter && stateFilter === 'all' && sortBy === 'updatedAt'}
                >
                  <i className="bi bi-arrow-counterclockwise"></i>
                  Réinitialiser
                </button>

                <button
                  onClick={handleExportAll}
                  className="btn-action-modern export"
                  disabled={filteredPlaylists.length === 0}
                >
                  <i className="bi bi-download"></i>
                  Exporter tout
                </button>
              </div>

              {/* Indicateur de résultats */}
              <div className="results-indicator-row">
                <span className="results-count">
                  <i className="bi bi-info-circle"></i>
                  {filteredPlaylists.length} résultat{filteredPlaylists.length > 1 ? 's' : ''}
                  {(playlistSearch || creatorFilter || stateFilter !== 'all') && (
                    <span className="filters-active-badge">
                      Filtres actifs
                    </span>
                  )}
                </span>
              </div>
            </div>
            
            {/* Sélection multiple moderne */}
            {selectedPlaylists.length > 0 && (
              <div className="bulk-actions-modern">
                <div className="bulk-info-modern">
                  <i className="bi bi-check-square-fill"></i>
                  <strong>{selectedPlaylists.length}</strong> sélectionnée(s)
                </div>
                
                <div className="bulk-buttons-modern">
                  <button
                    onClick={() => handleBulkRepair()}
                    className="bulk-btn-modern repair"
                    disabled={!selectedPlaylists.some(id => {
                      const pl = topPlaylists.find(p => p._id === id);
                      return isPlaylistCorrupted(pl);
                    })}
                  >
                    <i className="bi bi-tools"></i>
                    Réparer ({selectedPlaylists.filter(id => {
                      const pl = topPlaylists.find(p => p._id === id);
                      return isPlaylistCorrupted(pl);
                    }).length})
                  </button>
                  
                  <button
                    onClick={() => handleBulkExport()}
                    className="bulk-btn-modern export"
                  >
                    <i className="bi bi-download"></i>
                    Exporter
                  </button>
                  
                  <button
                    onClick={() => handleBulkDelete()}
                    className="bulk-btn-modern delete"
                  >
                    <i className="bi bi-trash"></i>
                    Supprimer
                  </button>
                  
                  <button
                    onClick={() => setSelectedPlaylists([])}
                    className="bulk-btn-modern cancel"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
            
            {filteredPlaylists.length === 0 ? (
              <div className="empty-state-modern">
                <div className="empty-icon-modern">
                  <i className="bi bi-collection"></i>
                </div>
                <h3>Aucune playlist trouvée</h3>
                <p>
                  {playlistSearch || creatorFilter || stateFilter !== 'all' 
                    ? 'Essayez de modifier vos critères de recherche'
                    : 'Aucune playlist créée pour le moment'
                  }
                </p>
                {(playlistSearch || creatorFilter || stateFilter !== 'all') && (
                  <button onClick={resetFilters} className="btn-action-modern reset">
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            ) : (
              <>
                {viewStyle === 'grid' ? (
                  <div className="playlists-grid-modern">
                    {filteredPlaylists.map((playlist, index) => {
                      const isEmpty = !playlist.tracks || playlist.tracks.length === 0;
                      const totalDuration = (playlist.tracks || []).reduce(
                        (sum, t) => sum + (t.duration_ms || 0), 0
                      );
                      const isCorrupted = isPlaylistCorrupted(playlist);
                      const isSelected = selectedPlaylists.includes(playlist._id);
                      
                      return (
                        <div 
                          key={playlist._id} 
                          className={`playlist-card-modern ${isSelected ? 'selected' : ''} ${isCorrupted ? 'corrupted' : ''}`}
                        >
                          {/* Checkbox */}
                          <div className="card-checkbox-modern">
                            <input
                              type="checkbox"
                              id={`check-${playlist._id}`}
                              checked={isSelected}
                              onChange={() => togglePlaylistSelection(playlist._id)}
                            />
                            <label htmlFor={`check-${playlist._id}`}></label>
                          </div>
                          
                          {/* Badge rang */}
                          <div className="card-rank-modern">#{index + 1}</div>
                          
                          {/* Cover avec preview */}
                          <div 
                            className="card-cover-modern"
                            onClick={() => openPlaylistDetail(playlist)}
                          >
                            <PlaylistCover playlist={playlist} />
                            
                            <div className="cover-overlay-modern">
                              {isEmpty ? (
                                <div className="empty-badge-overlay">
                                  <i className="bi bi-exclamation-triangle"></i>
                                  Vide
                                </div>
                              ) : (
                                <>
                                  <button className="play-btn-overlay">
                                    <i className="bi bi-eye-fill"></i>
                                  </button>
                                  
                                  <div className="quick-stats-overlay">
                                    <span>
                                      <i className="bi bi-music-note-beamed"></i>
                                      {playlist.tracks.length}
                                    </span>
                                    <span>
                                      <i className="bi bi-clock"></i>
                                      {formatDuration(totalDuration)}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Info */}
                          <div className="card-info-modern">
                            <h4 className="playlist-name-modern">{playlist.name}</h4>
                            
                            <div className="playlist-meta-modern">
                              <span className="creator-badge-modern">
                                <i className="bi bi-person"></i>
                                {playlist.username || 'Anonyme'}
                              </span>
                              
                              {isCorrupted && (
                                <span className="corruption-badge-modern">
                                  <i className="bi bi-exclamation-circle"></i>
                                  Corrompue
                                </span>
                              )}
                            </div>
                            
                            <div className="playlist-dates-modern">
                              <span>
                                <i className="bi bi-calendar-plus"></i>
                                {formatDate(playlist.createdAt)}
                              </span>
                              <span>
                                <i className="bi bi-calendar-check"></i>
                                {formatDate(playlist.updatedAt)}
                              </span>
                            </div>
                            
                            {/* Actions rapides */}
                            <div className="card-actions-modern">
                              <button
                                onClick={() => openPlaylistDetail(playlist)}
                                className="action-btn-modern view"
                                title="Voir"
                              >
                                <i className="bi bi-eye"></i>
                              </button>
                              
                              {isCorrupted && (
                                <button
                                  onClick={() => handleRepairPlaylist(playlist)}
                                  className="action-btn-modern repair"
                                  title="Réparer"
                                >
                                  <i className="bi bi-tools"></i>
                                </button>
                              )}
                              
                              <button
                                onClick={() => handleDuplicatePlaylist(playlist)}
                                className="action-btn-modern duplicate"
                                title="Dupliquer"
                              >
                                <i className="bi bi-files"></i>
                              </button>
                              
                              <button
                                onClick={() => handleDeletePlaylist(playlist._id)}
                                className="action-btn-modern delete"
                                title="Supprimer"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="playlists-list-modern">
                    <div className="list-header-modern">
                      <div className="row-cell check">
                        <input
                          type="checkbox"
                          id="select-all"
                          checked={selectedPlaylists.length === filteredPlaylists.length && filteredPlaylists.length > 0}
                          onChange={() => {
                            if (selectedPlaylists.length === filteredPlaylists.length) {
                              setSelectedPlaylists([]);
                            } else {
                              setSelectedPlaylists(filteredPlaylists.map(p => p._id));
                            }
                          }}
                        />
                        <label htmlFor="select-all"></label>
                      </div>
                      <div className="row-cell rank">#</div>
                      <div className="row-cell name">Nom</div>
                      <div className="row-cell creator">Créateur</div>
                      <div className="row-cell tracks">Morceaux</div>
                      <div className="row-cell date">Modifiée</div>
                      <div className="row-cell actions">Actions</div>
                    </div>
                    
                    {filteredPlaylists.map((playlist, index) => {
                      const isEmpty = !playlist.tracks || playlist.tracks.length === 0;
                      const isCorrupted = isPlaylistCorrupted(playlist);
                      const isSelected = selectedPlaylists.includes(playlist._id);
                      
                      return (
                        <div 
                          key={playlist._id} 
                          className={`list-row-modern ${isSelected ? 'selected' : ''} ${isCorrupted ? 'corrupted' : ''}`}
                        >
                          <div className="row-cell check">
                            <input
                              type="checkbox"
                              id={`row-${playlist._id}`}
                              checked={isSelected}
                              onChange={() => togglePlaylistSelection(playlist._id)}
                            />
                            <label htmlFor={`row-${playlist._id}`}></label>
                          </div>
                          
                          <div className="row-cell rank">
                            <span className="rank-number">#{index + 1}</span>
                          </div>
                          
                          <div className="row-cell name">
                            <div className="name-cell-content">
                              <div className="playlist-cover-tiny">
                                <PlaylistCover playlist={playlist} size="small" />
                              </div>
                              <div className="name-text">
                                <div className="playlist-name-text">{playlist.name}</div>
                                {isCorrupted && (
                                  <span className="corruption-badge-tiny">
                                    <i className="bi bi-exclamation-circle"></i> Corrompue
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="row-cell creator">
                            {playlist.username || 'Anonyme'}
                          </div>
                          
                          <div className="row-cell tracks">
                            <span className={`tracks-count-list ${isEmpty ? 'empty' : ''}`}>
                              {isEmpty ? 'Vide' : `${playlist.tracks.length} morceaux`}
                            </span>
                          </div>
                          
                          <div className="row-cell date">
                            {formatDate(playlist.updatedAt)}
                          </div>
                          
                          <div className="row-cell actions">
                            <div className="actions-list-row">
                              <button
                                onClick={() => openPlaylistDetail(playlist)}
                                className="action-btn-list view"
                                title="Voir"
                              >
                                <i className="bi bi-eye"></i>
                              </button>
                              
                              {isCorrupted && (
                                <button
                                  onClick={() => handleRepairPlaylist(playlist)}
                                  className="action-btn-list repair"
                                  title="Réparer"
                                >
                                  <i className="bi bi-tools"></i>
                                </button>
                              )}
                              
                              <button
                                onClick={() => handleDuplicatePlaylist(playlist)}
                                className="action-btn-list duplicate"
                                title="Dupliquer"
                              >
                                <i className="bi bi-files"></i>
                              </button>
                              
                              <button
                                onClick={() => handleDeletePlaylist(playlist._id)}
                                className="action-btn-list delete"
                                title="Supprimer"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {viewMode === 'empty' && !selectedCreator && (
          <div className="content-section">
            <div className="section-header warning">
              <h2>Playlists Vides</h2>
              <span className="section-count warning">{emptyPlaylists.length}</span>
            </div>

            {stats.empty > 0 && (
              <div className="boost-explanation">
                <p>
                  <i className="bi bi-exclamation-triangle"></i>
                  <strong> {stats.empty} playlists vides</strong> - 
                  Peuvent être supprimées pour optimiser la base.
                </p>
                <button onClick={handleCleanupEmpty} className="btn-warning" style={{ marginTop: 12 }}>
                  <i className="bi bi-trash"></i>
                  Nettoyer ({stats.empty})
                </button>
              </div>
            )}
            
            {emptyPlaylists.length === 0 ? (
              <div className="empty-state success">
                <i className="bi bi-check-circle"></i>
                <h3>Aucune playlist vide !</h3>
                <p>Toutes vos playlists contiennent des morceaux 🎉</p>
              </div>
            ) : (
              <div className="cocktails-grid-compact">
                {emptyPlaylists.map((playlist) => (
                  <div key={playlist._id} className="cocktail-card-compact warning">
                    <div className="card-warning">
                      <i className="bi bi-exclamation-triangle"></i>
                    </div>
                    
                    <div className="card-image">
                      <PlaylistCover playlist={playlist} />
                      <div className="image-overlay warning">
                        <div className="overlay-text">
                          Playlist vide
                        </div>
                      </div>
                    </div>
                    
                    <div className="card-content">
                      <h4>{playlist.name}</h4>
                      <div className="card-meta">
                        <span className="creator-tag">
                          <i className="bi bi-person"></i>
                          {playlist.username || 'Anonyme'}
                        </span>
                        <span className="age-tag">
                          <i className="bi bi-calendar"></i>
                          {formatDate(playlist.createdAt)}
                        </span>
                      </div>
                      
                      <div className="card-actions">
                        <button
                          onClick={() => openPlaylistDetail(playlist)}
                          className="btn-warning small"
                        >
                          <i className="bi bi-eye"></i>
                          Inspecter
                        </button>
                        <button
                          onClick={() => handleDeletePlaylist(playlist._id)}
                          className="btn-danger small"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL DÉTAIL TRACK */}
      {showTrackDetail && selectedTrack && (
        <div className="playlist-detail-overlay" onClick={() => setShowTrackDetail(false)}>
          <div className="playlist-detail-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <div className="playlist-header-info">
                <div className="playlist-cover-large" style={{ width: '80px', height: '80px' }}>
                  <img 
                    src={selectedTrack.albumImage || '/thumbnail-placeholder.jpg'} 
                    alt={selectedTrack.trackName || selectedTrack.name}
                    onError={(e) => {
                      e.target.src = '/thumbnail-placeholder.jpg';
                    }}
                  />
                </div>

                <div className="playlist-metadata">
                  <h2>{selectedTrack.trackName || selectedTrack.name || 'Titre inconnu'}</h2>
                  <div className="playlist-info-row">
                    <span className="playlist-owner">
                      <i className="bi bi-person"></i>
                      {selectedTrack.artistName || 'Artiste inconnu'}
                    </span>
                    <span className="playlist-stats">
                      <i className="bi bi-collection"></i>
                      {trackPlaylists.length} playlist{trackPlaylists.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="playlist-dates">
                    <span>Dans {trackPlaylists.length} playlists différentes</span>
                  </div>
                </div>
              </div>

              <div className="modal-actions-header">
                {selectedTrack.spotifyUrl && (
                  <a
                    href={selectedTrack.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-modal-action"
                    title="Ouvrir dans Spotify"
                  >
                    <i className="bi bi-spotify"></i>
                  </a>
                )}
                <button 
                  className="btn-modal-close"
                  onClick={() => setShowTrackDetail(false)}
                  title="Fermer"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>

            <div className="modal-body">
              {trackPlaylists.length === 0 ? (
                <div className="empty-playlist">
                  <i className="bi bi-collection"></i>
                  <h3>Aucune playlist</h3>
                  <p>Ce morceau n'est dans aucune playlist</p>
                </div>
              ) : (
                <div className="tracks-list">
                  <h3 style={{ padding: '20px 36px 10px', margin: 0, fontSize: '1.1rem', color: '#1db954' }}>
                    <i className="bi bi-collection"></i> Playlists contenant ce morceau:
                  </h3>
                  {trackPlaylists.map((playlist, index) => (
                    <div 
                      key={playlist._id || index} 
                      className="track-item"
                      style={{ 
                        gridTemplateColumns: '48px 56px 1fr 140px 100px',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setShowTrackDetail(false);
                        openPlaylistDetail(playlist);
                      }}
                    >
                      <div className="track-number">
                        <span>{index + 1}</span>
                      </div>

                      <div className="track-cover">
                        <PlaylistCover playlist={playlist} size="small" />
                      </div>

                      <div className="track-info">
                        <div className="track-name">{playlist.name || 'Sans nom'}</div>
                        <div className="track-artist">
                          Par {playlist.username || 'Anonyme'}
                          {' • '}
                          {playlist.tracks?.length || 0} morceau{(playlist.tracks?.length || 0) > 1 ? 's' : ''}
                        </div>
                      </div>

                      <div className="track-album" style={{ textAlign: 'right' }}>
                        {formatDate(playlist.createdAt)}
                      </div>

                      <div className="track-actions">
                        <button 
                          className="track-action-btn"
                          title="Voir la playlist"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowTrackDetail(false);
                            openPlaylistDetail(playlist);
                          }}
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal détail playlist existante */}
      {showDetailModal && selectedPlaylist && (
        <PlaylistDetailModal
          playlist={selectedPlaylist}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPlaylist(null);
          }}
          onDelete={handleDeletePlaylist}
        />
      )}
    </div>
  );
};

export default AdminPlaylistManager;