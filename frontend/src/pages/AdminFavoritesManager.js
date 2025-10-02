import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../axiosConfig';
import CocktailFavoritesDetail from '../components/CocktailFavoritesDetail';
import '../styles/AdminFavoritesManager.css';

const AdminFavoritesManager = () => {
  const [topCocktails, setTopCocktails] = useState([]);
  const [underperformers, setUnderperformers] = useState([]);
  const [favoritesByTheme, setFavoritesByTheme] = useState([]);
  const [recentFavorites, setRecentFavorites] = useState([]);
  const [userEngagement, setUserEngagement] = useState([]);
  const [totalFavorites, setTotalFavorites] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [avgFavsPerUser, setAvgFavsPerUser] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCocktail, setSelectedCocktail] = useState(null);
  const [showFavoritesDetail, setShowFavoritesDetail] = useState(false);
  const [viewMode, setViewMode] = useState('overview');
  const [selectedUser, setSelectedUser] = useState(null);

  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
  const getUploadUrl = (filename) => {
    if (!filename) return "/thumbnail-placeholder.jpg";
    if (/^https?:\/\//i.test(filename)) return filename;
    return `${API_BASE}/uploads/${filename}`;
  };

  useEffect(() => {
    loadFavoritesAnalytics();
  }, []);

  const loadFavoritesAnalytics = async () => {
    try {
      const [topRes, underRes, statsRes, themeRes, recentRes, engagementRes] = await Promise.all([
        axios.get('/cocktails/admin/favorites-summary'),
        axios.get('/cocktails/admin/low-engagement'),
        axios.get('/users/admin/favorites-stats'),
        axios.get('/cocktails/admin/favorites-by-theme'),
        axios.get('/cocktails/admin/recent-favorites'),
        axios.get('/users/admin/user-engagement')
      ]);
      
      setTopCocktails(topRes.data.data || []);
      setUnderperformers(underRes.data.data || []);
      setFavoritesByTheme(themeRes.data.data || []);
      setRecentFavorites(recentRes.data.data || []);
      setUserEngagement(engagementRes.data.data || []);
      
      const stats = statsRes.data || {};
      setTotalFavorites(stats.totalFavorites || 0);
      setActiveUsers(stats.activeUsersWithFavorites || 0);
      setAvgFavsPerUser(stats.avgFavoritesPerUser || 0);
    } catch (e) {
      console.error('Erreur analytics favoris:', e);
    } finally {
      setLoading(false);
    }
  };

  const promoteToFeatured = async (cocktailId) => {
    try {
      await axios.patch(`/cocktails/${cocktailId}/featured`, { featured: true });
      alert('✅ Cocktail mis en avant !');
      loadFavoritesAnalytics();
    } catch (e) {
      console.error('Erreur promotion:', e);
      alert('❌ Erreur lors de la mise en avant');
    }
  };

  const deleteCocktail = async (cocktailId) => {
    if (!window.confirm('Supprimer définitivement ce cocktail ?')) return;
    try {
      await axios.delete(`/cocktails/${cocktailId}`);
      alert('✅ Cocktail supprimé');
      loadFavoritesAnalytics();
    } catch (e) {
      console.error('Erreur suppression:', e);
      alert('❌ Erreur lors de la suppression');
    }
  };

  const openFavoritesDetail = (cocktail) => {
    setSelectedCocktail(cocktail);
    setShowFavoritesDetail(true);
  };

  const openUserFavorites = (user) => {
    const userCollectionCocktail = {
      cocktailId: 'user-collection',
      name: `Collection de ${user.username}`,
      image: '/logo.png',
      theme: 'Collection',
      color: '#1db954'
    };
    
    setSelectedCocktail(userCollectionCocktail);
    setSelectedUser(user);
    setShowFavoritesDetail(true);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="admin-favorites-manager">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>Chargement des analytics favoris...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-favorites-manager">
      {/* Header */}
      <div className="admin-header">
        <div className="breadcrumb">
          <Link to="/admin" className="breadcrumb-link">
            <i className="bi bi-house"></i> Dashboard
          </Link>
          <i className="bi bi-chevron-right" />
          <span>Analytics Favoris</span>
        </div>

        <div className="header-main">
          <h1 className="page-title">Analytics Favoris</h1>
          <div className="stats">
            <span className="stat-item loves">
              <i className="bi bi-heart-fill"></i>
              {totalFavorites} favoris
            </span>
            <span className="stat-item users">
              <i className="bi bi-people-fill"></i>
              {activeUsers} utilisateurs actifs
            </span>
            <span className="stat-item average">
              <i className="bi bi-graph-up"></i>
              {avgFavsPerUser.toFixed(1)} moy/utilisateur
            </span>
          </div>
        </div>

        <div className="header-actions">
          <Link to="/admin/cocktails/add" className="btn-primary">
            <i className="bi bi-plus"></i>
            Nouveau cocktail
          </Link>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="view-controls">
        <div className="view-tabs">
          <button 
            className={`tab-btn ${viewMode === 'overview' ? 'active' : ''}`}
            onClick={() => setViewMode('overview')}
          >
            <i className="bi bi-grid-3x3-gap"></i>
            Vue d'ensemble
          </button>
          <button 
            className={`tab-btn ${viewMode === 'top' ? 'active' : ''}`}
            onClick={() => setViewMode('top')}
          >
            <i className="bi bi-trophy"></i>
            Top Cocktails
          </button>
          <button 
            className={`tab-btn ${viewMode === 'boost' ? 'active' : ''}`}
            onClick={() => setViewMode('boost')}
          >
            <i className="bi bi-rocket"></i>
            À Booster ({underperformers.length})
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="admin-container">
        
        {/* Vue d'ensemble */}
        {viewMode === 'overview' && (
          <div className="overview-grid">
            {/* 1. Podium des Stars */}
            <div className="analytics-card podium-card">
              <div className="card-header">
                <h3>
                  <i className="bi bi-trophy-fill"></i>
                  Podium des Stars
                </h3>
                <span className="badge success">{topCocktails.length}</span>
              </div>
              <div className="card-body">
                {topCocktails.length === 0 ? (
                  <div className="empty-hint">
                    <i className="bi bi-heart"></i>
                    <p>Aucun cocktail en favoris pour l'instant</p>
                  </div>
                ) : (
                  topCocktails.slice(0, 3).map((cocktail, index) => (
                    <div key={cocktail.cocktailId} className={`podium-item rank-${index + 1}`}>
                      <div className="podium-rank">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </div>
                      <img 
                        src={getUploadUrl(cocktail.image)} 
                        alt={cocktail.name}
                        className="podium-avatar"
                      />
                      <div className="podium-info">
                        <h5>{cocktail.name}</h5>
                        <div className="podium-meta">
                          <span className="theme-chip" style={{ backgroundColor: cocktail.color }}>
                            {cocktail.theme}
                          </span>
                          <span className="likes-count">
                            <i className="bi bi-heart-fill"></i>
                            {cocktail.count}
                          </span>
                        </div>
                      </div>
                      <div className="podium-actions">
                        <button 
                          onClick={() => openFavoritesDetail(cocktail)}
                          className="action-btn fans-btn"
                          title="Voir qui aime ce cocktail"
                        >
                          <i className="bi bi-people"></i>
                        </button>
                        <button 
                          onClick={() => promoteToFeatured(cocktail.cocktailId)}
                          className="action-btn promote-btn"
                          title="Mettre ce cocktail en avant"
                        >
                          <i className="bi bi-star"></i>
                        </button>
                        <Link
                          to={`/cocktails/${cocktail.cocktailId}`}
                          className="action-btn view-btn"
                          title="Voir la page du cocktail"
                        >
                          <i className="bi bi-eye"></i>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. Performance par Thème */}
            <div className="analytics-card themes-card">
              <div className="card-header">
                <h3>
                  <i className="bi bi-pie-chart-fill"></i>
                  Performance par Thème
                </h3>
                <div className="info-tooltip" title="Thèmes les plus appréciés">
                  <i className="bi bi-info-circle"></i>
                </div>
              </div>
              <div className="card-body">
                <div className="section-explanation">
                  <p>📊 Analyse des <strong>thèmes</strong> qui génèrent le plus d'engagement.</p>
                </div>
                <div className="themes-chart">
                  {favoritesByTheme.length === 0 ? (
                    <div className="empty-hint">
                      <i className="bi bi-pie-chart"></i>
                      <p>Aucune donnée par thème</p>
                    </div>
                  ) : (
                    favoritesByTheme.slice(0, 5).map(theme => {
                      const maxFavorites = Math.max(...favoritesByTheme.map(t => t.totalFavorites));
                      const percentage = (theme.totalFavorites / maxFavorites) * 100;
                      
                      return (
                        <div key={theme._id} className="theme-row">
                          <div className="theme-info">
                            <div 
                              className="theme-dot" 
                              style={{ backgroundColor: theme.color || '#1db954' }}
                            />
                            <div className="theme-details">
                              <span className="theme-name">{theme._id}</span>
                              <span className="theme-subtitle">
                                {theme.cocktailCount} cocktails • {theme.avgFavoritesPerCocktail} favoris/cocktail
                              </span>
                            </div>
                          </div>
                          <div className="theme-stats">
                            <div className="progress-bar">
                              <div 
                                className="progress-fill"
                                style={{ 
                                  width: `${percentage}%`,
                                  backgroundColor: theme.color || '#1db954'
                                }}
                              />
                            </div>
                            <span className="theme-value">{theme.totalFavorites}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* 3. Cocktails à Booster */}
            <div className="analytics-card boost-card">
              <div className="card-header warning">
                <h3>
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  Cocktails à Booster
                </h3>
                <span className="badge warning">{underperformers.length}</span>
              </div>
              <div className="card-body">
                <div className="section-explanation warning">
                  <p>⚠️ Ces cocktails n'ont <strong>aucun favori</strong>. Considérez les améliorer.</p>
                </div>
                {underperformers.length === 0 ? (
                  <div className="empty-hint">
                    <i className="bi bi-check-circle"></i>
                    <p>Tous vos cocktails ont de l'engagement !</p>
                  </div>
                ) : (
                  <>
                    {underperformers.slice(0, 3).map(cocktail => (
                      <div key={cocktail._id} className="boost-item">
                        <img 
                          src={getUploadUrl(cocktail.image || cocktail.thumbnail)} 
                          alt={cocktail.name}
                          className="boost-avatar"
                        />
                        <div className="boost-info">
                          <h6>{cocktail.name}</h6>
                          <div className="boost-meta">
                            <span className="theme-chip" style={{ backgroundColor: cocktail.color }}>
                              {cocktail.theme}
                            </span>
                            <span className="age-info">{cocktail.daysSinceCreated}j • 0 ❤️</span>
                          </div>
                        </div>
                        <div className="boost-actions">
                          <Link 
                            to={`/admin/cocktails/edit/${cocktail._id}`}
                            className="action-btn edit-btn"
                            title="Modifier"
                          >
                            <i className="bi bi-pencil"></i>
                          </Link>
                          <Link
                            to={`/cocktails/${cocktail._id}`}
                            className="action-btn view-btn"
                            title="Voir"
                          >
                            <i className="bi bi-eye"></i>
                          </Link>
                          <button 
                            onClick={() => deleteCocktail(cocktail._id)}
                            className="action-btn delete-btn"
                            title="Supprimer"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                    {underperformers.length > 3 && (
                      <button 
                        className="see-more-btn"
                        onClick={() => setViewMode('boost')}
                      >
                        Voir les {underperformers.length - 3} autres
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 4. Activité Récente */}
            <div className="analytics-card activity-card">
              <div className="card-header">
                <h3>
                  <i className="bi bi-clock-history"></i>
                  Activité Récente
                </h3>
              </div>
              <div className="card-body">
                <div className="section-explanation">
                  <p>⏱️ Derniers cocktails <strong>ajoutés aux favoris</strong> (7 jours).</p>
                </div>
                <div className="activity-list">
                  {recentFavorites.length === 0 ? (
                    <div className="empty-hint">
                      <i className="bi bi-clock"></i>
                      <p>Aucune activité récente</p>
                    </div>
                  ) : (
                    recentFavorites.slice(0, 4).map((item, index) => (
                      <div key={`${item.cocktailId}-${index}`} className="activity-item">
                        <div className="activity-avatar">
                          <img 
                            src={getUploadUrl(item.cocktailImage)} 
                            alt={item.cocktailName}
                          />
                          <div className="activity-badge new">
                            <i className="bi bi-heart-fill"></i>
                          </div>
                        </div>
                        <div className="activity-info">
                          <h6>{item.cocktailName}</h6>
                          <div className="activity-meta">
                            <span className="user-info">
                              <i className="bi bi-person"></i>
                              {item.username}
                            </span>
                            <span className="time-info">
                              {formatDate(item.addedAt)}
                            </span>
                          </div>
                        </div>
                        <div className="activity-actions">
                          <button 
                            onClick={() => openFavoritesDetail({
                              cocktailId: item.cocktailId,
                              name: item.cocktailName,
                              image: item.cocktailImage,
                              theme: item.theme,
                              color: item.color
                            })}
                            className="action-btn view-btn"
                            title="Voir les fans"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 5. Top Utilisateurs */}
            <div className="analytics-card users-card">
              <div className="card-header">
                <h3>
                  <i className="bi bi-people-fill"></i>
                  Top Utilisateurs
                </h3>
                <div className="info-tooltip" title="Cliquez pour voir leur collection">
                  <i className="bi bi-info-circle"></i>
                </div>
              </div>
              <div className="card-body">
                <div className="section-explanation">
                  <p>👥 Utilisateurs les plus <strong>engagés</strong>. <em>Cliquez pour voir leurs favoris.</em></p>
                </div>
                <div className="users-list">
                  {userEngagement.length === 0 ? (
                    <div className="empty-hint">
                      <i className="bi bi-people"></i>
                      <p>Aucun utilisateur avec des favoris</p>
                    </div>
                  ) : (
                    userEngagement.slice(0, 5).map((user, index) => (
                      <div 
                        key={user._id} 
                        className="user-item clickable"
                        onClick={() => openUserFavorites(user)}
                        title={`Voir la collection de ${user.username}`}
                      >
                        <div className="user-rank">
                          {index === 0 ? '👑' : `#${index + 1}`}
                        </div>
                        <div className="user-avatar">
                          <div className="avatar-placeholder" style={{ 
                            backgroundColor: index === 0 ? '#f39c12' : index === 1 ? '#e74c3c' : '#3498db' 
                          }}>
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          {user.role === 'admin' && (
                            <div className="user-badge admin">
                              <i className="bi bi-shield-check-fill"></i>
                            </div>
                          )}
                        </div>
                        <div className="user-info">
                          <h6>{user.username}</h6>
                          <div className="user-meta">
                            <span className="favorites-count">
                              <i className="bi bi-heart-fill"></i>
                              {user.favoritesCount} favoris
                            </span>
                            <span className="join-date">
                              Membre depuis {formatDate(user.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="user-engagement">
                          <div className="engagement-bar">
                            <div 
                              className="engagement-fill"
                              style={{ 
                                width: `${(user.favoritesCount / Math.max(...userEngagement.map(u => u.favoritesCount))) * 100}%`,
                                backgroundColor: index === 0 ? '#f39c12' : index === 1 ? '#e74c3c' : '#3498db'
                              }}
                            />
                          </div>
                        </div>
                        <div className="user-actions">
                          <i className="bi bi-chevron-right"></i>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 6. Insights & Recommandations */}
            <div className="analytics-card insights-card">
              <div className="card-header">
                <h3>
                  <i className="bi bi-lightbulb-fill"></i>
                  Insights & Recommandations
                </h3>
              </div>
              <div className="card-body">
                <div className="insights-list">
                  {/* Meilleur thème */}
                  {favoritesByTheme.length > 0 && (
                    <div className="insight-item success">
                      <div className="insight-icon">
                        <i className="bi bi-trophy"></i>
                      </div>
                      <div className="insight-content">
                        <h6>🎯 Thème le plus populaire</h6>
                        <p><strong>{favoritesByTheme[0]._id}</strong> domine avec {favoritesByTheme[0].totalFavorites} favoris</p>
                        <span className="insight-action">→ Créez plus de cocktails {favoritesByTheme[0]._id}</span>
                      </div>
                    </div>
                  )}

                  {/* Engagement utilisateurs */}
                  <div className="insight-item info">
                    <div className="insight-icon">
                      <i className="bi bi-people"></i>
                    </div>
                    <div className="insight-content">
                      <h6>👥 Engagement utilisateurs</h6>
                      <p>{activeUsers} utilisateurs ont des favoris</p>
                      <span className="insight-action">→ {avgFavsPerUser < 2 ? 'Encouragez plus de favoris' : 'Excellent engagement !'}</span>
                    </div>
                  </div>

                  {/* Tendance récente */}
                  {recentFavorites.length > 0 && (
                    <div className="insight-item creative">
                      <div className="insight-icon">
                        <i className="bi bi-trending-up"></i>
                      </div>
                      <div className="insight-content">
                        <h6>🔥 Tendance récente</h6>
                        <p><strong>{recentFavorites.length}</strong> nouveaux favoris cette semaine</p>
                        <span className="insight-action">→ L'engagement est {recentFavorites.length > 5 ? 'excellent' : 'modéré'}</span>
                      </div>
                    </div>
                  )}

                  {/* Cocktails à problème */}
                  {underperformers.length > 0 && (
                    <div className="insight-item warning">
                      <div className="insight-icon">
                        <i className="bi bi-exclamation-triangle"></i>
                      </div>
                      <div className="insight-content">
                        <h6>⚠️ Cocktails sans engagement</h6>
                        <p>{underperformers.length} cocktails n'ont aucun favori</p>
                        <span className="insight-action">→ Révisez leur présentation</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vue Top Cocktails */}
        {viewMode === 'top' && (
          <div className="content-section">
            <div className="section-header">
              <h2>🏆 Top Cocktails les Plus Aimés</h2>
              <span className="section-count">{topCocktails.length} cocktails</span>
            </div>

            <div className="cocktails-grid-compact">
              {topCocktails.map((cocktail, index) => (
                <div key={cocktail.cocktailId} className="cocktail-card-compact">
                  <div className="card-rank">#{index + 1}</div>
                  <div className="card-image">
                    <img 
                      src={getUploadUrl(cocktail.image)} 
                      alt={cocktail.name}
                    />
                    <div className="image-overlay">
                      <button 
                        onClick={() => openFavoritesDetail(cocktail)}
                        className="overlay-btn"
                      >
                        <i className="bi bi-people"></i>
                        Voir fans
                      </button>
                    </div>
                  </div>
                  <div className="card-content">
                    <h4>{cocktail.name}</h4>
                    <div className="card-meta">
                      <span className="theme-tag" style={{ backgroundColor: cocktail.color }}>
                        {cocktail.theme}
                      </span>
                      <span className="likes-tag">
                        <i className="bi bi-heart-fill"></i>
                        {cocktail.count}
                      </span>
                    </div>
                    <div className="card-actions">
                      <Link 
                        to={`/cocktails/${cocktail.cocktailId}`}
                        className="btn-secondary small"
                      >
                        <i className="bi bi-eye"></i>
                        Voir
                      </Link>
                      <button 
                        onClick={() => promoteToFeatured(cocktail.cocktailId)}
                        className="btn-primary small"
                      >
                        <i className="bi bi-star"></i>
                        Promouvoir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vue Boost */}
        {viewMode === 'boost' && (
          <div className="content-section">
            <div className="section-header warning">
              <h2>🚀 Cocktails à Booster</h2>
              <span className="section-count warning">{underperformers.length} cocktails</span>
            </div>

            <div className="boost-explanation">
              <p><i className="bi bi-info-circle"></i> Ces cocktails n'ont <strong>aucun favori</strong> depuis leur création.</p>
            </div>

            {underperformers.length === 0 ? (
              <div className="empty-state success">
                <i className="bi bi-check-circle-fill"></i>
                <h3>Excellent travail !</h3>
                <p>Tous vos cocktails ont de l'engagement</p>
              </div>
            ) : (
              <div className="cocktails-grid-compact">
                {underperformers.map(cocktail => (
                  <div key={cocktail._id} className="cocktail-card-compact warning">
                    <div className="card-warning">
                      <i className="bi bi-exclamation-triangle-fill"></i>
                    </div>
                    <div className="card-image">
                      <img 
                        src={getUploadUrl(cocktail.image || cocktail.thumbnail)} 
                        alt={cocktail.name}
                      />
                      <div className="image-overlay warning">
                        <span className="overlay-text">0 favoris • {cocktail.daysSinceCreated} jours</span>
                      </div>
                    </div>
                    <div className="card-content">
                      <h4>{cocktail.name}</h4>
                      <div className="card-meta">
                        <span className="theme-tag" style={{ backgroundColor: cocktail.color }}>
                          {cocktail.theme}
                        </span>
                        <span className="age-tag">
                          <i className="bi bi-calendar"></i>
                          {cocktail.daysSinceCreated} jours
                        </span>
                      </div>
                      <div className="card-actions">
                        <Link 
                          to={`/admin/cocktails/edit/${cocktail._id}`}
                          className="btn-warning small"
                        >
                          <i className="bi bi-tools"></i>
                          Améliorer
                        </Link>
                        <button 
                          onClick={() => deleteCocktail(cocktail._id)}
                          className="btn-danger small"
                        >
                          <i className="bi bi-trash"></i>
                          Supprimer
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

      {/* Modal détails favoris */}
      {showFavoritesDetail && selectedCocktail && (
        <CocktailFavoritesDetail
          cocktail={selectedCocktail}
          selectedUser={selectedUser}
          onClose={() => {
            setShowFavoritesDetail(false);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
};

export default AdminFavoritesManager;