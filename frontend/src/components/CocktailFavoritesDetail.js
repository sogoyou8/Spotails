import React, { useState, useEffect } from 'react';
import axios from '../axiosConfig';
import '../styles/CocktailFavoritesDetail.css';

const CocktailFavoritesDetail = ({ cocktail, selectedUser, onClose }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSelectedUser, setCurrentSelectedUser] = useState(selectedUser); // État local
  const [userCocktails, setUserCocktails] = useState([]);
  const [loadingUserCocktails, setLoadingUserCocktails] = useState(false);
  const [viewMode, setViewMode] = useState('fans'); // 'fans' ou 'user-collection'

  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
  const getUploadUrl = (filename) => {
    if (!filename) return "/thumbnail-placeholder.jpg";
    if (/^https?:\/\//i.test(filename)) return filename;
    return `${API_BASE}/uploads/${filename}`;
  };

  useEffect(() => {
    // Si on a un selectedUser, on affiche sa collection directement
    if (selectedUser) {
      setViewMode('user-collection');
      setCurrentSelectedUser(selectedUser);
      loadUserCocktails(selectedUser._id);
    } else if (cocktail?.cocktailId && cocktail.cocktailId !== 'user-collection') {
      // Sinon, on charge les fans du cocktail
      setViewMode('fans');
      loadUsersWhoLikedCocktail();
    }
  }, [cocktail, selectedUser]);

  const loadUsersWhoLikedCocktail = async () => {
    try {
      const response = await axios.get(`/cocktails/admin/${cocktail.cocktailId}/favorites-detail`);
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserCocktails = async (userId) => {
    setLoadingUserCocktails(true);
    try {
      const response = await axios.get(`/users/admin/${userId}/favorites`);
      setUserCocktails(response.data.favorites || []);
    } catch (error) {
      console.error('Erreur chargement cocktails utilisateur:', error);
      setUserCocktails([]);
    } finally {
      setLoadingUserCocktails(false);
      setLoading(false);
    }
  };

  const handleUserClick = (user) => {
    setCurrentSelectedUser(user); // Utiliser l'état local
    setViewMode('user-collection');
    loadUserCocktails(user._id);
  };

  const handleBackToFans = () => {
    setViewMode('fans');
    setCurrentSelectedUser(null);
    setUserCocktails([]);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getEngagementLevel = (favCount) => {
    if (favCount >= 20) return { level: 'expert', icon: '🎯', color: '#e74c3c' };
    if (favCount >= 10) return { level: 'passionné', icon: '🔥', color: '#f39c12' };
    if (favCount >= 5) return { level: 'amateur', icon: '⭐', color: '#3498db' };
    return { level: 'découvreur', icon: '🌱', color: '#1db954' };
  };

  return (
    <div className="favorites-detail-overlay">
      <div className="favorites-detail-modal">
        {/* Header dynamique selon le mode */}
        <div className="modal-header-enhanced">
          {viewMode === 'user-collection' && currentSelectedUser ? (
            // Header pour collection utilisateur
            <div className="user-collection-preview">
              <div className="user-avatar-large">
                <div className="avatar-circle-large" style={{ backgroundColor: '#1db954' }}>
                  {currentSelectedUser.username.charAt(0).toUpperCase()}
                </div>
                {currentSelectedUser.role === 'admin' && (
                  <div className="admin-crown-large">
                    <i className="bi bi-shield-check-fill"></i>
                  </div>
                )}
              </div>
              <div className="user-collection-info">
                <h2>Collection de {currentSelectedUser.username}</h2>
                <div className="user-collection-meta">
                  <span className="collection-badge">
                    <i className="bi bi-collection"></i>
                    {userCocktails.length} cocktail{userCocktails.length > 1 ? 's' : ''} favoris
                  </span>
                  <span className="member-since">
                    <i className="bi bi-calendar3"></i>
                    Membre depuis {formatDate(currentSelectedUser.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // Header pour fans de cocktail
            <div className="cocktail-preview">
              <img 
                src={getUploadUrl(cocktail.image)} 
                alt={cocktail.name}
                className="cocktail-mini-img"
              />
              <div className="cocktail-info">
                <h2>{cocktail.name}</h2>
                <div className="cocktail-meta">
                  <span className="theme-badge" style={{ backgroundColor: cocktail.color }}>
                    {cocktail.theme}
                  </span>
                  <span className="fans-count">
                    <i className="bi bi-heart-fill"></i>
                    {users.length} fan{users.length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          )}
          <button onClick={onClose} className="close-btn-enhanced">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Contenu principal */}
        <div className="modal-body-enhanced">
          {loading || loadingUserCocktails ? (
            <div className="loading-section">
              <div className="loading-spinner"></div>
              <span>
                {viewMode === 'user-collection' 
                  ? 'Chargement de la collection...' 
                  : 'Chargement des fans...'
                }
              </span>
            </div>
          ) : viewMode === 'user-collection' ? (
            // Affichage collection utilisateur
            <div className="user-collection-container">
              {userCocktails.length === 0 ? (
                <div className="empty-collection">
                  <i className="bi bi-cup"></i>
                  <h3>Collection vide</h3>
                  <p>{currentSelectedUser.username} n'a pas encore de cocktails favoris</p>
                </div>
              ) : (
                <div className="user-cocktails-grid-main">
                  {userCocktails.map((cocktailFav) => (
                    <div key={cocktailFav._id} className="user-cocktail-card-main">
                      <div className="cocktail-image-main">
                        <img 
                          src={getUploadUrl(cocktailFav.thumbnail || cocktailFav.image)} 
                          alt={cocktailFav.name}
                        />
                        <div className="cocktail-overlay">
                          <a 
                            href={`/cocktails/${cocktailFav._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="view-cocktail-btn"
                          >
                            <i className="bi bi-eye"></i>
                            Voir
                          </a>
                        </div>
                      </div>
                      <div className="cocktail-card-info-main">
                        <h5>{cocktailFav.name}</h5>
                        <span 
                          className="theme-badge-main" 
                          style={{ backgroundColor: cocktailFav.color }}
                        >
                          {cocktailFav.theme}
                        </span>
                        <div className="cocktail-meta-main">
                          <span className="added-date">
                            <i className="bi bi-calendar-plus"></i>
                            Ajouté {formatDate(cocktailFav.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Affichage fans de cocktail (mode original)
            users.length === 0 ? (
              <div className="empty-fans">
                <i className="bi bi-heart-half"></i>
                <h3>Aucun fan pour l'instant</h3>
                <p>Ce cocktail attend ses premiers admirateurs !</p>
              </div>
            ) : (
              <div className="fans-container">
                <div className="fans-grid">
                  {users.map((user, index) => {
                    const engagement = getEngagementLevel(user.totalFavorites);
                    
                    return (
                      <div 
                        key={user._id} 
                        className="fan-card"
                        onClick={() => handleUserClick(user)}
                      >
                        <div className="fan-avatar">
                          <div className="avatar-circle" style={{ backgroundColor: engagement.color }}>
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="engagement-badge" title={`Niveau: ${engagement.level}`}>
                            {engagement.icon}
                          </div>
                          {user.role === 'admin' && (
                            <div className="admin-crown">
                              <i className="bi bi-shield-check-fill"></i>
                            </div>
                          )}
                        </div>
                        
                        <div className="fan-details">
                          <h4>{user.username}</h4>
                          <div className="fan-stats">
                            <span className="favorites-stat">
                              <i className="bi bi-heart-fill"></i>
                              {user.totalFavorites} favoris
                            </span>
                            <span className="join-date">
                              <i className="bi bi-calendar3"></i>
                              {formatDate(user.createdAt)}
                            </span>
                          </div>
                          <div className="engagement-info">
                            <span className="engagement-level" style={{ color: engagement.color }}>
                              {engagement.icon} {engagement.level}
                            </span>
                          </div>
                        </div>

                        <div className="fan-actions">
                          <button 
                            className="view-profile-btn"
                            title="Voir la collection de cocktails"
                          >
                            <i className="bi bi-collection"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer avec stats et actions */}
        <div className="modal-footer-enhanced">
          <div className="footer-stats">
            {viewMode === 'user-collection' && currentSelectedUser ? (
              <>
                <div className="stat-item">
                  <i className="bi bi-collection"></i>
                  <span>{userCocktails.length} cocktail{userCocktails.length > 1 ? 's' : ''} favoris</span>
                </div>
                <div className="stat-item">
                  <i className="bi bi-person"></i>
                  <span>Utilisateur {currentSelectedUser.role === 'admin' ? 'Admin' : 'Standard'}</span>
                </div>
              </>
            ) : (
              <>
                <div className="stat-item">
                  <i className="bi bi-people"></i>
                  <span>{users.length} fan{users.length > 1 ? 's' : ''}</span>
                </div>
                <div className="stat-item">
                  <i className="bi bi-graph-up"></i>
                  <span>Engagement moyen: {users.length > 0 ? Math.round(users.reduce((acc, u) => acc + u.totalFavorites, 0) / users.length) : 0}</span>
                </div>
              </>
            )}
          </div>
          <div className="footer-actions">
            {viewMode === 'user-collection' && !selectedUser && (
              <button className="btn-back" onClick={handleBackToFans}>
                <i className="bi bi-arrow-left"></i>
                Retour aux fans
              </button>
            )}
            {viewMode === 'fans' && (
              <button className="btn-promote" title="Promouvoir ce cocktail">
                <i className="bi bi-megaphone"></i>
                Promouvoir
              </button>
            )}
            <button onClick={onClose} className="btn-close-modal">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CocktailFavoritesDetail;