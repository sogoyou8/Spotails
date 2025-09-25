import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from '../axiosConfig';
import '../styles/AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    cocktails: { total: 0, published: 0, draft: 0 },
    users: { total: 0, admins: 0, users: 0 },
    favorites: { total: 0 },
    playlists: { total: 0 }
  });
  const [recentCocktails, setRecentCocktails] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Charger les statistiques et données récentes en parallèle
      const [statsResponse, cocktailsResponse, usersResponse] = await Promise.all([
        axios.get('/users/admin/stats'),
        axios.get('/cocktails/admin?limit=5&sortBy=createdAt&sortDir=desc'),
        axios.get('/users?limit=5&sortBy=createdAt&sortDir=desc')
      ]);

      setStats(statsResponse.data);
      setRecentCocktails(cocktailsResponse.data.data || []);
      setRecentUsers(usersResponse.data.data || []);
    } catch (err) {
      console.error('Erreur lors du chargement du dashboard:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getInitials = (username) => {
    return username ? username.slice(0, 2).toUpperCase() : 'U';
  };

  const getImageUrl = (filename) => {
    if (!filename) return '/thumbnail-placeholder.jpg';
    if (/^https?:\/\//.test(filename)) return filename;
    return `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/uploads/${filename}`;
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading">
          <div className="spinner"></div>
          <span>Chargement du tableau de bord...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Tableau de Bord Administrateur</h1>
        <p>Vue d'ensemble de votre plateforme Spotails</p>
      </div>

      {error && (
        <div className="error-message">
          <i className="bi bi-exclamation-triangle"></i>
          {error}
        </div>
      )}

      {/* Statistiques principales */}
      <div className="stats-grid">
        <div className="stat-card cocktails">
          <div className="stat-icon">
            <i className="bi bi-cup-straw"></i>
          </div>
          <div className="stat-content">
            <h3>{stats.cocktails.total}</h3>
            <p>Cocktails Total</p>
            <div className="stat-breakdown">
              <span className="published">{stats.cocktails.published} publiés</span>
              <span className="draft">{stats.cocktails.draft} brouillons</span>
            </div>
          </div>
          <Link to="/admin/cocktails" className="stat-link">
            Gérer <i className="bi bi-arrow-right"></i>
          </Link>
        </div>

        <div className="stat-card users">
          <div className="stat-icon">
            <i className="bi bi-people"></i>
          </div>
          <div className="stat-content">
            <h3>{stats.users.total}</h3>
            <p>Utilisateurs</p>
            <div className="stat-breakdown">
              <span className="admins">{stats.users.admins} admins</span>
              <span className="regular">{stats.users.users} utilisateurs</span>
            </div>
          </div>
          <Link to="/admin/users" className="stat-link">
            Gérer <i className="bi bi-arrow-right"></i>
          </Link>
        </div>

        <div className="stat-card favorites">
          <div className="stat-icon">
            <i className="bi bi-heart"></i>
          </div>
          <div className="stat-content">
            <h3>{stats.favorites.total}</h3>
            <p>Favoris</p>
            <div className="stat-breakdown">
              <span>Cocktails en favoris</span>
            </div>
          </div>
        </div>

        <div className="stat-card playlists">
          <div className="stat-icon">
            <i className="bi bi-music-note-list"></i>
          </div>
          <div className="stat-content">
            <h3>{stats.playlists.total}</h3>
            <p>Playlists</p>
            <div className="stat-breakdown">
              <span>Créées par les utilisateurs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="quick-actions">
        <h2>Actions Rapides</h2>
        <div className="actions-grid">
          <Link to="/admin/cocktails/add" className="action-card create">
            <i className="bi bi-plus-circle"></i>
            <span>Nouveau Cocktail</span>
          </Link>
          
          <Link to="/admin/cocktails" className="action-card manage">
            <i className="bi bi-gear"></i>
            <span>Gérer Cocktails</span>
          </Link>
          
          <Link to="/admin/users" className="action-card users">
            <i className="bi bi-person-gear"></i>
            <span>Gérer Utilisateurs</span>
          </Link>
          
          <button onClick={loadDashboardData} className="action-card refresh">
            <i className="bi bi-arrow-clockwise"></i>
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Contenu récent */}
      <div className="recent-content">
        <div className="recent-section">
          <div className="section-header">
            <h2>Cocktails Récents</h2>
            <Link to="/admin/cocktails" className="see-all">
              Voir tout <i className="bi bi-arrow-right"></i>
            </Link>
          </div>
          
          <div className="recent-items">
            {recentCocktails.length === 0 ? (
              <div className="empty-recent">
                <i className="bi bi-cup-straw"></i>
                <p>Aucun cocktail récent</p>
              </div>
            ) : (
              recentCocktails.map(cocktail => (
                <div key={cocktail._id} className="recent-item">
                  <img 
                    src={getImageUrl(cocktail.thumbnail)} 
                    alt={cocktail.name}
                    onError={(e) => {
                      e.target.src = '/thumbnail-placeholder.jpg';
                    }}
                  />
                  <div className="item-content">
                    <h3>{cocktail.name}</h3>
                    <p>{cocktail.theme}</p>
                    <span className={`status ${cocktail.publish ? 'published' : 'draft'}`}>
                      {cocktail.publish ? 'Publié' : 'Brouillon'}
                    </span>
                  </div>
                  <div className="item-meta">
                    <small>{formatDate(cocktail.createdAt)}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="recent-section">
          <div className="section-header">
            <h2>Utilisateurs Récents</h2>
            <Link to="/admin/users" className="see-all">
              Voir tout <i className="bi bi-arrow-right"></i>
            </Link>
          </div>
          
          <div className="recent-items">
            {recentUsers.length === 0 ? (
              <div className="empty-recent">
                <i className="bi bi-people"></i>
                <p>Aucun utilisateur récent</p>
              </div>
            ) : (
              recentUsers.map(user => (
                <div key={user._id} className="recent-item">
                  <div className="user-avatar">
                    {getInitials(user.username)}
                  </div>
                  <div className="item-content">
                    <h3>{user.username}</h3>
                    <p>{user.email}</p>
                    <span className={`role ${user.role}`}>
                      {user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                    </span>
                  </div>
                  <div className="item-meta">
                    <small>{formatDate(user.createdAt)}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
