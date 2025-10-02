import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from '../axiosConfig';
import PlaylistDetailModal from '../components/PlaylistDetailModal';
import useDebounce from '../hooks/useDebounce';
import '../styles/AdminPlaylistManager.css';

const AdminPlaylistManager = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // === ÉTATS ULTRA-OPTIMISÉS ===
  const [data, setData] = useState({
    flagged: [], top: [], recent: [], creators: [], activity: [],
    all: [], filtered: []
  });
  
  const [stats, setStats] = useState({
    total: 0, totalTracks: 0, avgTracksPerPlaylist: 0, 
    emptyPlaylists: 0, activeCreators: 0, weeklyGrowth: 0,
    topGenres: [], peakHours: [], userEngagement: 0
  });
  
  const [ui, setUi] = useState({
    loading: true, viewMode: 'dashboard', selectedPlaylist: null, 
    showDetail: false, searchQuery: '', sortBy: 'updatedAt', sortDir: 'desc',
    filterTheme: '', filterCreator: '', showFilters: false,
    bulkMode: false, realTimeUpdate: true
  });
  
  const [selectedItems, setSelectedItems] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [analytics, setAnalytics] = useState({
    trends: [], predictions: [], insights: []
  });

  const debouncedQuery = useDebounce(ui.searchQuery, 300);

  // === CHARGEMENT INTELLIGENT AVEC CACHE ===
  const [cache, setCache] = useState({});
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    // Sync avec URL params
    const mode = searchParams.get('view') || 'dashboard';
    const query = searchParams.get('q') || '';
    setUi(prev => ({ ...prev, viewMode: mode, searchQuery: query }));
    
    loadAllData();
    
    // Real-time updates
    if (ui.realTimeUpdate) {
      const interval = setInterval(loadIncrementalData, 30000);
      return () => clearInterval(interval);
    }
  }, [debouncedQuery, ui.sortBy, ui.sortDir, ui.filterTheme, ui.filterCreator]);

  const loadAllData = useCallback(async () => {
    const cacheKey = `playlists-${debouncedQuery}-${ui.sortBy}-${ui.sortDir}`;
    
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < 300000) {
      setData(cache[cacheKey].data);
      setStats(cache[cacheKey].stats);
      setUi(prev => ({ ...prev, loading: false }));
      return;
    }

    setUi(prev => ({ ...prev, loading: true }));
    
    try {
      const endpoints = [
        '/playlists/admin/analytics-enhanced',
        '/playlists/admin/stats-detailed', 
        '/playlists/admin/flagged',
        '/playlists/admin/top-playlists?limit=20',
        '/playlists/admin/recent?days=7&limit=15',
        '/playlists/admin/top-creators?limit=10',
        '/playlists/admin/activity-feed?limit=20'
      ];
      
      const [analyticsRes, statsRes, flaggedRes, topRes, recentRes, creatorsRes, activityRes] = 
        await Promise.all(endpoints.map(endpoint => 
          axios.get(endpoint).catch(err => ({ data: { data: [], error: err.message } }))
        ));

      const newData = {
        flagged: flaggedRes.data?.data || [],
        top: topRes.data?.data || [],
        recent: recentRes.data?.data || [],
        creators: creatorsRes.data?.data || [],
        activity: activityRes.data?.data || [],
        all: [...(topRes.data?.data || []), ...(recentRes.data?.data || [])],
        analytics: analyticsRes.data?.analytics || {}
      };

      const newStats = {
        ...statsRes.data?.stats,
        ...statsRes.data,
        topGenres: analyticsRes.data?.topGenres || [],
        peakHours: analyticsRes.data?.peakHours || [],
        userEngagement: analyticsRes.data?.userEngagement || 0
      };

      // Cache avec timestamp
      setCache(prev => ({
        ...prev,
        [cacheKey]: { data: newData, stats: newStats, timestamp: Date.now() }
      }));

      setData(newData);
      setStats(newStats);
      setAnalytics(analyticsRes.data?.insights || {});
      
    } catch (e) {
      console.error('❌ Erreur loadAllData:', e);
      addNotification('Erreur de chargement des données', 'error');
    } finally {
      setUi(prev => ({ ...prev, loading: false }));
      setLastUpdate(Date.now());
    }
  }, [debouncedQuery, ui.sortBy, ui.sortDir, ui.filterTheme, ui.filterCreator, cache]);

  const loadIncrementalData = useCallback(async () => {
    try {
      const res = await axios.get(`/playlists/admin/updates?since=${lastUpdate}`);
      if (res.data?.updates?.length > 0) {
        setData(prev => ({ ...prev, recent: res.data.updates }));
        addNotification(`${res.data.updates.length} nouvelles mises à jour`, 'info');
      }
    } catch (e) {
      console.log('Mise à jour incrémentale échouée');
    }
  }, [lastUpdate]);

  // === ACTIONS INTELLIGENTES ===
  const executeAction = useCallback(async (action, playlistId, extra = null) => {
    const actions = {
      delete: async () => {
        if (!window.confirm('⚠️ Supprimer définitivement cette playlist ?')) return false;
        await axios.delete(`/playlists/admin/${playlistId}`);
        addNotification('Playlist supprimée avec succès', 'success');
        return true;
      },
      
      rename: async () => {
        if (!extra?.trim()) return false;
        await axios.put(`/playlists/${playlistId}`, { name: extra.trim() });
        addNotification('Playlist renommée avec succès', 'success');
        return true;
      },
      
      cleanup: async () => {
        if (!window.confirm(`⚠️ Supprimer ${stats.emptyPlaylists} playlists vides ?`)) return false;
        const res = await axios.delete('/playlists/admin/cleanup-empty');
        addNotification(`${res.data.deletedCount} playlists supprimées`, 'success');
        return true;
      },
      
      bulkDelete: async () => {
        if (!window.confirm(`Supprimer ${selectedItems.length} playlists sélectionnées ?`)) return false;
        const results = await Promise.allSettled(
          selectedItems.map(id => axios.delete(`/playlists/admin/${id}`))
        );
        const successful = results.filter(r => r.status === 'fulfilled').length;
        addNotification(`${successful}/${selectedItems.length} playlists supprimées`, 'success');
        setSelectedItems([]);
        return true;
      },
      
      bulkTransfer: async () => {
        const newOwner = prompt('Transférer vers quel utilisateur ?');
        if (!newOwner?.trim()) return false;
        
        const results = await Promise.allSettled(
          selectedItems.map(id => axios.patch(`/playlists/admin/${id}/transfer`, { newUsername: newOwner }))
        );
        const successful = results.filter(r => r.status === 'fulfilled').length;
        addNotification(`${successful} playlists transférées à ${newOwner}`, 'success');
        setSelectedItems([]);
        return true;
      },
      
      export: async () => {
        const res = await axios.get('/playlists/admin/export', { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `playlists-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        addNotification('Export téléchargé avec succès', 'success');
        return true;
      }
    };

    try {
      const success = await actions[action]?.();
      if (success) {
        loadAllData();
        
        // Update URL params
        const newParams = new URLSearchParams(searchParams);
        newParams.set('lastAction', action);
        newParams.set('timestamp', Date.now().toString());
        setSearchParams(newParams);
      }
    } catch (e) {
      console.error(`Erreur ${action}:`, e);
      addNotification(`Échec de l'action: ${e.response?.data?.message || e.message}`, 'error');
    }
  }, [selectedItems, stats.emptyPlaylists, searchParams, setSearchParams]);

  // === NOTIFICATIONS SYSTÈME ===
  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now();
    const notification = { id, message, type, timestamp: new Date() };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  // === OUVERTURE DÉTAILS AVANCÉE ===
  const openDetail = useCallback(async (playlistId) => {
    try {
      setUi(prev => ({ ...prev, loading: true }));
      const [playlistRes, analyticsRes] = await Promise.all([
        axios.get(`/playlists/admin/${playlistId}/tracks`),
        axios.get(`/playlists/admin/${playlistId}/analytics`)
      ]);
      
      const enhancedPlaylist = {
        ...playlistRes.data?.playlist,
        analytics: analyticsRes.data?.analytics
      };
      
      setUi(prev => ({ 
        ...prev, 
        selectedPlaylist: enhancedPlaylist, 
        showDetail: true,
        loading: false 
      }));
    } catch (e) {
      addNotification('Impossible de charger la playlist', 'error');
      setUi(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // === HELPERS VISUELS AMÉLIORÉS ===
  const getTrackImage = useCallback((track) => {
    if (!track) return '/thumbnail-placeholder.jpg';
    return track.albumImage || 
           track.album?.images?.[0]?.url || 
           track.album?.images?.[1]?.url || 
           track.album?.images?.[2]?.url ||
           track.image ||
           '/thumbnail-placeholder.jpg';
  }, []);

  const renderAdvancedCover = useCallback((pl, size = 'normal') => {
    const images = (pl?.tracks || [])
      .map(t => getTrackImage(t))
      .filter(img => !img.includes('placeholder'))
      .slice(0, 4);

    const sizeClass = size === 'large' ? 'playlist-cover-large' : 'playlist-cover';
    
    if (!images.length) {
      return (
        <div className={`${sizeClass} empty`}>
          <i className="bi bi-music-note-list" />
          <span className="track-badge">{pl?.tracks?.length || 0}</span>
          <div className="cover-gradient"></div>
        </div>
      );
    }

    if (images.length === 1) {
      return (
        <div className={`${sizeClass} single`}>
          <img src={images[0]} alt={pl.name} onError={e => e.target.src = '/thumbnail-placeholder.jpg'} />
          <span className="track-badge">{pl?.tracks?.length || 0}</span>
          <div className="cover-overlay">
            <i className="bi bi-play-fill"></i>
          </div>
        </div>
      );
    }

    return (
      <div className={`${sizeClass} collage-${Math.min(images.length, 4)}`}>
        {images.map((img, i) => (
          <div key={i} className={`cover-tile tile-${i + 1}`}>
            <img src={img} alt="" onError={e => e.target.style.display = 'none'} />
          </div>
        ))}
        <span className="track-badge">{pl?.tracks?.length || 0}</span>
        <div className="cover-overlay">
          <i className="bi bi-collection-play"></i>
        </div>
      </div>
    );
  }, [getTrackImage]);

  // === FORMATAGE INTELLIGENT ===
  const formatRelative = useCallback((date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}j`;
    if (days < 30) return `${Math.floor(days/7)}sem`;
    return `${Math.floor(days/30)}m`;
  }, []);

  const formatDuration = useCallback((ms) => {
    if (!ms) return '0min';
    const totalMinutes = Math.round(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes}min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h${minutes ? `${minutes}min` : ''}`;
  }, []);

  // === INSIGHTS ULTRA-INTELLIGENTS ===
  const insights = useMemo(() => {
    const insights = [];
    
    // Insight croissance
    if (stats.weeklyGrowth > 0) {
      insights.push({
        type: 'success', icon: 'bi-trending-up',
        title: '📈 Croissance forte',
        text: `+${stats.weeklyGrowth}% de nouvelles playlists cette semaine`,
        action: 'La communauté est très active',
        priority: 1
      });
    }

    // Insight modération
    if (data.flagged.length > 0) {
      insights.push({
        type: 'warning', icon: 'bi-flag',
        title: '⚠️ Modération requise',
        text: `${data.flagged.length} playlists avec des noms suspects`,
        action: 'Vérifiez et renommez si nécessaire',
        priority: 3
      });
    }

    // Insight nettoyage
    if (stats.emptyPlaylists > 0) {
      insights.push({
        type: 'info', icon: 'bi-trash',
        title: '🧹 Nettoyage suggéré',
        text: `${stats.emptyPlaylists} playlists vides trouvées`,
        action: 'Utilisez le nettoyage automatique',
        priority: 2
      });
    }

    // Insight genres populaires
    if (stats.topGenres?.length > 0) {
      insights.push({
        type: 'creative', icon: 'bi-music-note',
        title: '🎵 Tendance musicale',
        text: `"${stats.topGenres[0].name}" domine avec ${stats.topGenres[0].count} playlists`,
        action: 'Encouragez cette tendance',
        priority: 2
      });
    }

    // Insight engagement utilisateurs
    if (stats.userEngagement > 80) {
      insights.push({
        type: 'success', icon: 'bi-people',
        title: '👥 Engagement excellent',
        text: `${stats.userEngagement}% des utilisateurs ont des playlists actives`,
        action: 'Communauté très engagée !',
        priority: 1
      });
    }

    return insights.sort((a, b) => b.priority - a.priority);
  }, [data, stats]);

  // === FILTRES INTELLIGENTS ===
  const filteredData = useMemo(() => {
    let filtered = data.all || [];
    
    if (ui.searchQuery) {
      filtered = filtered.filter(pl => 
        pl.name?.toLowerCase().includes(ui.searchQuery.toLowerCase()) ||
        pl.username?.toLowerCase().includes(ui.searchQuery.toLowerCase())
      );
    }
    
    if (ui.filterTheme) {
      filtered = filtered.filter(pl => 
        pl.tracks?.some(t => t.genre === ui.filterTheme)
      );
    }
    
    if (ui.filterCreator) {
      filtered = filtered.filter(pl => pl.username === ui.filterCreator);
    }
    
    return filtered;
  }, [data.all, ui.searchQuery, ui.filterTheme, ui.filterCreator]);

  // === SÉLECTION INTELLIGENTE ===
  const toggleSelectItem = useCallback((id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  }, []);

  const selectAll = useCallback(() => {
    const currentIds = filteredData.map(pl => pl._id);
    setSelectedItems(prev => 
      prev.length === currentIds.length ? [] : currentIds
    );
  }, [filteredData]);

  // === LOADING STATES ===
  if (ui.loading && !data.top.length) {
    return (
      <div className="admin-playlist-manager">
        <div className="loading-state-modern">
          <div className="loading-animation">
            <div className="loading-spinner-modern"></div>
            <div className="loading-bars">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`loading-bar bar-${i}`}></div>
              ))}
            </div>
          </div>
          <div className="loading-text">
            <h3>Analyse des playlists en cours...</h3>
            <p>Traitement des données musicales</p>
          </div>
        </div>
      </div>
    );
  }

  // === RENDER ULTRA-MODERNE ===
  return (
    <div className="admin-playlist-manager">
      {/* Notifications Toast */}
      <div className="notifications-container">
        {notifications.map(notif => (
          <div key={notif.id} className={`notification toast-${notif.type}`}>
            <div className="notification-icon">
              <i className={`bi bi-${notif.type === 'success' ? 'check-circle' : notif.type === 'error' ? 'x-circle' : 'info-circle'}`}></i>
            </div>
            <div className="notification-content">
              <span className="notification-message">{notif.message}</span>
              <small className="notification-time">{formatRelative(notif.timestamp)}</small>
            </div>
            <button 
              className="notification-close"
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
            >
              <i className="bi bi-x"></i>
            </button>
          </div>
        ))}
      </div>

      {/* Header Ultra-Moderne */}
      <header className="admin-header-ultra">
        <div className="breadcrumb-modern">
          <Link to="/admin" className="breadcrumb-link-modern">
            <i className="bi bi-house"></i>
            <span>Dashboard</span>
          </Link>
          <i className="bi bi-chevron-right"></i>
          <span className="breadcrumb-current">Analytics Playlists</span>
        </div>

        <div className="header-content-modern">
          <div className="header-main-modern">
            <div className="title-section-modern">
              <h1 className="page-title-modern">
                <div className="title-icon-modern">
                  <i className="bi bi-music-note-list"></i>
                </div>
                <div className="title-text-modern">
                  <span className="title-primary">Analytics Playlists</span>
                  <span className="title-secondary">Gestion avancée et insights</span>
                </div>
              </h1>
              
              <div className="stats-pills-modern">
                <div className="stat-pill-modern total">
                  <div className="stat-icon-modern">
                    <i className="bi bi-collection"></i>
                  </div>
                  <div className="stat-content-modern">
                    <span className="stat-value">{stats.total}</span>
                    <span className="stat-label">Playlists</span>
                  </div>
                </div>
                
                <div className="stat-pill-modern tracks">
                  <div className="stat-icon-modern">
                    <i className="bi bi-music-note"></i>
                  </div>
                  <div className="stat-content-modern">
                    <span className="stat-value">{stats.totalTracks}</span>
                    <span className="stat-label">Morceaux</span>
                  </div>
                </div>
                
                <div className="stat-pill-modern creators">
                  <div className="stat-icon-modern">
                    <i className="bi bi-people"></i>
                  </div>
                  <div className="stat-content-modern">
                    <span className="stat-value">{stats.activeCreators}</span>
                    <span className="stat-label">Créateurs</span>
                  </div>
                </div>
                
                <div className="stat-pill-modern average">
                  <div className="stat-icon-modern">
                    <i className="bi bi-graph-up"></i>
                  </div>
                  <div className="stat-content-modern">
                    <span className="stat-value">{stats.avgTracksPerPlaylist?.toFixed(1) || 0}</span>
                    <span className="stat-label">Moy/playlist</span>
                  </div>
                </div>

                {stats.weeklyGrowth > 0 && (
                  <div className="stat-pill-modern growth">
                    <div className="stat-icon-modern">
                      <i className="bi bi-trending-up"></i>
                    </div>
                    <div className="stat-content-modern">
                      <span className="stat-value">+{stats.weeklyGrowth}%</span>
                      <span className="stat-label">Croissance</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="header-actions-modern">
            <button 
              onClick={() => executeAction('export')} 
              className="btn-modern secondary"
              title="Exporter toutes les données"
            >
              <i className="bi bi-download"></i>
              <span>Exporter</span>
            </button>
            
            {stats.emptyPlaylists > 0 && (
              <button 
                onClick={() => executeAction('cleanup')} 
                className="btn-modern warning"
                title={`Nettoyer ${stats.emptyPlaylists} playlists vides`}
              >
                <i className="bi bi-trash"></i>
                <span>Nettoyer ({stats.emptyPlaylists})</span>
              </button>
            )}
            
            <button 
              onClick={() => setUi(prev => ({ ...prev, realTimeUpdate: !prev.realTimeUpdate }))}
              className={`btn-modern ${ui.realTimeUpdate ? 'active' : 'secondary'}`}
              title="Mises à jour en temps réel"
            >
              <i className={`bi bi-${ui.realTimeUpdate ? 'wifi' : 'wifi-off'}`}></i>
              <span>Temps réel</span>
            </button>
          </div>
        </div>

        {/* Barre de mise à jour */}
        <div className="update-bar-modern">
          <div className="update-info">
            <i className="bi bi-clock-history"></i>
            <span>Dernière mise à jour: {formatRelative(lastUpdate)}</span>
          </div>
          {ui.realTimeUpdate && (
            <div className="realtime-indicator">
              <div className="pulse-dot"></div>
              <span>Temps réel actif</span>
            </div>
          )}
        </div>
      </header>

      {/* Navigation Ultra-Moderne */}
      <nav className="navigation-ultra">
        <div className="nav-tabs-ultra">
          {[
            { key: 'dashboard', icon: 'speedometer2', label: 'Dashboard', desc: 'Vue d\'ensemble complète' },
            { key: 'analytics', icon: 'graph-up-arrow', label: 'Analytics', desc: 'Métriques avancées' },
            { key: 'top', icon: 'trophy', label: `Top Playlists`, desc: `${data.top.length} meilleures` },
            { key: 'management', icon: 'gear', label: 'Gestion', desc: 'Actions groupées' },
            { key: 'flagged', icon: 'flag', label: `Signalées`, desc: `${data.flagged.length} à modérer`, warn: data.flagged.length > 0 }
          ].map(tab => (
            <button
              key={tab.key}
              className={`nav-tab-ultra ${ui.viewMode === tab.key ? 'active' : ''} ${tab.warn ? 'warning' : ''}`}
              onClick={() => {
                setUi(prev => ({ ...prev, viewMode: tab.key }));
                const newParams = new URLSearchParams(searchParams);
                newParams.set('view', tab.key);
                setSearchParams(newParams);
              }}
            >
              <div className="tab-icon-ultra">
                <i className={`bi bi-${tab.icon}`}></i>
              </div>
              <div className="tab-content-ultra">
                <span className="tab-label-ultra">{tab.label}</span>
                <small className="tab-desc-ultra">{tab.desc}</small>
              </div>
              {tab.warn && <div className="tab-alert-ultra"></div>}
            </button>
          ))}
        </div>
      </nav>

      {/* Barre d'Actions Intelligentes */}
      {selectedItems.length > 0 && (
        <div className="smart-actions-bar">
          <div className="selection-info-modern">
            <div className="selection-icon">
              <i className="bi bi-check-square"></i>
            </div>
            <div className="selection-text">
              <span className="selection-count">{selectedItems.length}</span>
              <span className="selection-label">playlists sélectionnées</span>
            </div>
          </div>
          
          <div className="smart-actions-modern">
            <button 
              onClick={() => executeAction('bulkDelete')} 
              className="smart-btn danger"
              title="Supprimer les playlists sélectionnées"
            >
              <i className="bi bi-trash"></i>
              <span>Supprimer</span>
            </button>
            
            <button 
              onClick={() => executeAction('bulkTransfer')} 
              className="smart-btn secondary"
              title="Transférer vers un autre utilisateur"
            >
              <i className="bi bi-arrow-right-circle"></i>
              <span>Transférer</span>
            </button>
            
            <button 
              onClick={() => setSelectedItems([])} 
              className="smart-btn cancel"
              title="Annuler la sélection"
            >
              <i className="bi bi-x-circle"></i>
              <span>Annuler</span>
            </button>
          </div>
        </div>
      )}

      {/* Contenu Principal Ultra-Moderne */}
      <main className="main-content-ultra">
        
        {/* DASHBOARD ULTRA-MODERNE */}
        {ui.viewMode === 'dashboard' && (
          <div className="dashboard-ultra">
            
            {/* Insights en Temps Réel */}
            <section className="insights-realtime">
              <div className="section-header-ultra">
                <h2>
                  <i className="bi bi-lightbulb"></i>
                  Insights Temps Réel
                </h2>
              </div>
              
              <div className="insights-grid-ultra">
                {insights.map((insight, i) => (
                  <div key={i} className={`insight-card-ultra ${insight.type}`}>
                    <div className="insight-header-ultra">
                      <div className="insight-icon-ultra">
                        <i className={`bi ${insight.icon}`}></i>
                      </div>
                      <div className="insight-priority">
                        {[...Array(insight.priority)].map((_, j) => (
                          <div key={j} className="priority-dot"></div>
                        ))}
                      </div>
                    </div>
                    <div className="insight-content-ultra">
                      <h4>{insight.title}</h4>
                      <p>{insight.text}</p>
                      <div className="insight-action-ultra">
                        <i className="bi bi-arrow-right"></i>
                        <span>{insight.action}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Métriques Visuelles */}
            <div className="metrics-dashboard">
              
              {/* Top Playlists Interactive */}
              <section className="top-playlists-interactive">
                <div className="section-header-ultra">
                  <h3>
                    <i className="bi bi-trophy"></i>
                    Top Playlists
                  </h3>
                  <div className="section-badge">{data.top.length}</div>
                </div>
                
                <div className="playlists-podium">
                  {data.top.slice(0, 6).map((pl, i) => (
                    <div key={pl._id} className={`podium-card-ultra rank-${i + 1}`} onClick={() => openDetail(pl._id)}>
                      <div className="podium-rank-ultra">
                        {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
                      </div>
                      
                      <div className="podium-cover-ultra">
                        {renderAdvancedCover(pl, 'large')}
                      </div>
                      
                      <div className="podium-info-ultra">
                        <h4 className="playlist-name-ultra">{pl.name}</h4>
                        <div className="playlist-meta-ultra">
                          <span className="creator-ultra">
                            <i className="bi bi-person"></i>
                            {pl.username || 'Anonyme'}
                          </span>
                          <span className="tracks-ultra">
                            <i className="bi bi-music-note"></i>
                            {pl.tracks?.length || 0}
                          </span>
                          <span className="duration-ultra">
                            <i className="bi bi-clock"></i>
                            {formatDuration(pl.tracks?.reduce((s,t) => s + (t.durationMs||0), 0) || 0)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="podium-actions-ultra">
                        <button className="action-ultra view" title="Voir détails">
                          <i className="bi bi-eye"></i>
                        </button>
                        <button 
                          className="action-ultra edit" 
                          title="Renommer"
                          onClick={e => {
                            e.stopPropagation();
                            const name = prompt('Nouveau nom:', pl.name);
                            if (name) executeAction('rename', pl._id, name);
                          }}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button 
                          className="action-ultra delete" 
                          title="Supprimer"
                          onClick={e => { 
                            e.stopPropagation(); 
                            executeAction('delete', pl._id); 
                          }}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                      
                      <div className="podium-stats-ultra">
                        <div className="stat-ultra">
                          <span className="stat-value-ultra">{pl.tracks?.length || 0}</span>
                          <span className="stat-label-ultra">morceaux</span>
                        </div>
                        <div className="stat-ultra">
                          <span className="stat-value-ultra">{formatRelative(pl.updatedAt)}</span>
                          <span className="stat-label-ultra">modifiée</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Créateurs Actifs */}
              <section className="creators-section-ultra">
                <div className="section-header-ultra">
                  <h3>
                    <i className="bi bi-people"></i>
                    Créateurs Actifs
                  </h3>
                  <div className="section-badge">{data.creators.length}</div>
                </div>
                
                <div className="creators-grid-ultra">
                  {data.creators.slice(0, 8).map((creator, i) => (
                    <div key={creator._id} className="creator-card-ultra">
                      <div className="creator-rank-ultra">#{i + 1}</div>
                      
                      <div className="creator-avatar-ultra">
                        <div className="avatar-ultra">
                          {creator.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        {creator.role === 'admin' && (
                          <div className="admin-badge-ultra">
                            <i className="bi bi-shield-check"></i>
                          </div>
                        )}
                      </div>
                      
                      <div className="creator-info-ultra">
                        <h5>{creator.username}</h5>
                        <div className="creator-stats-ultra">
                          <span>{creator.playlistCount} playlists</span>
                          <span>{creator.totalTracks} morceaux</span>
                        </div>
                      </div>
                      
                      <div className="creator-activity-ultra">
                        <div className="activity-bar-ultra">
                          <div 
                            className="activity-fill-ultra"
                            style={{ 
                              width: `${(creator.playlistCount / Math.max(...data.creators.map(c => c.playlistCount))) * 100}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Activité en Temps Réel */}
              <section className="activity-realtime-ultra">
                <div className="section-header-ultra">
                  <h3>
                    <i className="bi bi-activity"></i>
                    Activité Temps Réel
                  </h3>
                  <div className="realtime-indicator-ultra">
                    <div className="pulse-ultra"></div>
                    <span>Live</span>
                  </div>
                </div>
                
                <div className="activity-feed-ultra">
                  {data.activity.slice(0, 10).map((activity, i) => (
                    <div key={i} className="activity-item-ultra">
                      <div className="activity-time-ultra">
                        {formatRelative(activity.timestamp || activity.createdAt)}
                      </div>
                      
                      <div className="activity-content-ultra">
                        <div className="activity-icon-ultra">
                          <i className="bi bi-plus-circle"></i>
                        </div>
                        <div className="activity-text-ultra">
                          <strong>{activity.username}</strong> a créé 
                          <span className="playlist-name-inline">{activity.name}</span>
                        </div>
                      </div>
                      
                      <div className="activity-meta-ultra">
                        <span className="track-count-ultra">
                          {activity.tracks?.length || 0} morceaux
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ANALYTICS AVANCÉES */}
        {ui.viewMode === 'analytics' && (
          <div className="analytics-ultra">
            <div className="analytics-header-ultra">
              <h2>Métriques Avancées</h2>
              <p>Analyse approfondie des tendances et performances</p>
            </div>
            
            {/* Graphiques et métriques avancées ici */}
            <div className="charts-grid-ultra">
              {/* Placeholder pour futurs graphiques */}
              <div className="chart-placeholder-ultra">
                <i className="bi bi-graph-up"></i>
                <p>Graphiques d'analytics en développement</p>
              </div>
            </div>
          </div>
        )}

        {/* TOP PLAYLISTS */}
        {ui.viewMode === 'top' && (
          <section className="top-section-ultra">
            <div className="section-header-ultra">
              <h2>🏆 Top Playlists</h2>
              <div className="section-controls-ultra">
                <select 
                  value={ui.sortBy}
                  onChange={(e) => setUi(prev => ({ ...prev, sortBy: e.target.value }))}
                  className="sort-select-ultra"
                >
                  <option value="tracks">Par nombre de morceaux</option>
                  <option value="updatedAt">Par dernière modification</option>
                  <option value="createdAt">Par date de création</option>
                </select>
              </div>
            </div>
            
            <div className="top-playlists-grid-ultra">
              {data.top.map((pl, i) => (
                <div key={pl._id} className="top-playlist-card-ultra" onClick={() => openDetail(pl._id)}>
                  <div className="card-rank-ultra">#{i + 1}</div>
                  
                  <div className="card-cover-ultra">
                    {renderAdvancedCover(pl)}
                  </div>
                  
                  <div className="card-content-ultra">
                    <h4>{pl.name}</h4>
                    <div className="card-meta-ultra">
                      <span><i className="bi bi-person"></i> {pl.username}</span>
                      <span><i className="bi bi-music-note"></i> {pl.tracks?.length || 0}</span>
                      <span><i className="bi bi-clock"></i> {formatRelative(pl.updatedAt)}</span>
                    </div>
                  </div>
                  
                  <div className="card-actions-ultra">
                    <button className="btn-ultra primary">
                      <i className="bi bi-eye"></i>
                      Détails
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* GESTION AVANCÉE */}
        {ui.viewMode === 'management' && (
          <div className="management-ultra">
            <div className="management-header-ultra">
              <h2>Gestion Avancée</h2>
              <p>Outils d'administration et actions groupées</p>
            </div>
            
            {/* Filtres avancés */}
            <div className="advanced-filters-ultra">
              <div className="filters-grid-ultra">
                <div className="filter-group-ultra">
                  <label>Recherche</label>
                  <input
                    type="text"
                    placeholder="Nom de playlist ou créateur..."
                    value={ui.searchQuery}
                    onChange={(e) => setUi(prev => ({ ...prev, searchQuery: e.target.value }))}
                    className="search-input-ultra"
                  />
                </div>
                
                <div className="filter-group-ultra">
                  <label>Créateur</label>
                  <select
                    value={ui.filterCreator}
                    onChange={(e) => setUi(prev => ({ ...prev, filterCreator: e.target.value }))}
                    className="filter-select-ultra"
                  >
                    <option value="">Tous les créateurs</option>
                    {data.creators.map(creator => (
                      <option key={creator._id} value={creator.username}>
                        {creator.username} ({creator.playlistCount})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="filter-group-ultra">
                  <label>Actions</label>
                  <div className="filter-actions-ultra">
                    <button 
                      onClick={selectAll}
                      className="btn-ultra secondary"
                    >
                      {selectedItems.length === filteredData.length ? 'Désélectionner tout' : 'Sélectionner tout'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Liste de gestion */}
            <div className="management-list-ultra">
              {filteredData.map(pl => (
                <div key={pl._id} className={`management-item-ultra ${selectedItems.includes(pl._id) ? 'selected' : ''}`}>
                  <div className="item-select-ultra">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(pl._id)}
                      onChange={() => toggleSelectItem(pl._id)}
                    />
                  </div>
                  
                  <div className="item-cover-ultra">
                    {renderAdvancedCover(pl, 'small')}
                  </div>
                  
                  <div className="item-info-ultra">
                    <h4>{pl.name}</h4>
                    <div className="item-meta-ultra">
                      <span>Par {pl.username}</span>
                      <span>{pl.tracks?.length || 0} morceaux</span>
                      <span>Modifiée {formatRelative(pl.updatedAt)}</span>
                    </div>
                  </div>
                  
                  <div className="item-actions-ultra">
                    <button onClick={() => openDetail(pl._id)} className="btn-ultra small">
                      <i className="bi bi-eye"></i>
                    </button>
                    <button 
                      onClick={() => {
                        const name = prompt('Nouveau nom:', pl.name);
                        if (name) executeAction('rename', pl._id, name);
                      }}
                      className="btn-ultra small secondary"
                    >
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button 
                      onClick={() => executeAction('delete', pl._id)}
                      className="btn-ultra small danger"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PLAYLISTS SIGNALÉES */}
        {ui.viewMode === 'flagged' && (
          <section className="flagged-section-ultra">
            <div className="section-header-ultra warning">
              <h2>🚩 Playlists Signalées</h2>
              <div className="section-badge warning">{data.flagged.length}</div>
            </div>
            
            {data.flagged.length === 0 ? (
              <div className="empty-state-ultra success">
                <div className="empty-icon-ultra">
                  <i className="bi bi-check-circle"></i>
                </div>
                <h3>Aucune playlist signalée</h3>
                <p>Toutes les playlists ont des noms appropriés</p>
              </div>
            ) : (
              <div className="flagged-grid-ultra">
                {data.flagged.map(pl => (
                  <div key={pl._id} className="flagged-card-ultra">
                    <div className="flagged-warning-ultra">
                      <i className="bi bi-flag"></i>
                    </div>
                    
                    <div className="flagged-cover-ultra">
                      {renderAdvancedCover(pl)}
                    </div>
                    
                    <div className="flagged-content-ultra">
                      <h4>{pl.name}</h4>
                      <div className="flagged-reason-ultra">
                        <i className="bi bi-exclamation-triangle"></i>
                        <span>{pl.flagReason || 'Nom suspect'}</span>
                      </div>
                      <div className="flagged-meta-ultra">
                        <span>Par {pl.username}</span>
                        <span>{formatRelative(pl.createdAt)}</span>
                      </div>
                    </div>
                    
                    <div className="flagged-actions-ultra">
                      <button 
                        onClick={() => {
                          const name = prompt('Nouveau nom:', pl.name);
                          if (name) executeAction('rename', pl._id, name);
                        }}
                        className="btn-ultra warning"
                      >
                        <i className="bi bi-pencil"></i>
                        Corriger
                      </button>
                      <button 
                        onClick={() => executeAction('delete', pl._id)}
                        className="btn-ultra danger"
                      >
                        <i className="bi bi-trash"></i>
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Modal Détails Améliorée */}
      {ui.showDetail && ui.selectedPlaylist && (
        <PlaylistDetailModal
          playlist={ui.selectedPlaylist}
          onClose={() => setUi(prev => ({ ...prev, showDetail: false, selectedPlaylist: null }))}
          onDelete={(id) => { 
            executeAction('delete', id); 
            setUi(prev => ({ ...prev, showDetail: false, selectedPlaylist: null })); 
          }}
          onRename={(id, name) => executeAction('rename', id, name)}
        />
      )}
    </div>
  );
};

export default AdminPlaylistManager;