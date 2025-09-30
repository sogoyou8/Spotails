import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from '../axiosConfig';
import useDebounce from '../hooks/useDebounce';
import '../styles/AdminCocktailManager.css';

const AdminCocktailManager = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // États principaux
  const [cocktails, setCocktails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Pagination et filtres
  const [query, setQuery] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');
  const [publishStatus, setPublishStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Tri
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Vue (grille ou liste)
  const [viewMode, setViewMode] = useState('grid');
  
  // Sélection multiple
  const [selectedItems, setSelectedItems] = useState([]);
  
  // Données pour les filtres
  const [availableThemes, setAvailableThemes] = useState([]);
  const [stats, setStats] = useState({ published: 0, draft: 0 });
  
  const debouncedQuery = useDebounce(query, 300);

  // Charger les données
  const fetchCocktails = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = {
        q: debouncedQuery,
        theme: selectedTheme,
        publish: publishStatus,
        page: currentPage,
        limit: itemsPerPage,
        sortBy,
        sortDir: sortDirection
      };
      
      const response = await axios.get('/cocktails/admin', { params });
      
      setCocktails(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
      setTotalItems(response.data.total || 0);
      
      if (response.data.facets) {
        setAvailableThemes(response.data.facets.themes || []);
        setStats(response.data.facets.publish || { published: 0, draft: 0 });
      }
    } catch (err) {
      console.error('Erreur lors du chargement:', err);
      setError('Erreur lors du chargement des cocktails');
      setCocktails([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, selectedTheme, publishStatus, currentPage, itemsPerPage, sortBy, sortDirection]);

  // Charger au démarrage et quand les filtres changent
  useEffect(() => {
    fetchCocktails();
  }, [fetchCocktails]);

  // Réinitialiser la page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, selectedTheme, publishStatus, sortBy, sortDirection]);

  // Actions
  const handlePublishToggle = async (cocktailId, newStatus) => {
    try {
      await axios.patch(`/cocktails/${cocktailId}/publish`, { publish: newStatus });
      fetchCocktails();
    } catch (err) {
      console.error('Erreur publish:', err);
      alert('Erreur lors de la modification du statut');
    }
  };

  const handleDelete = async (cocktailId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce cocktail ?')) {
      return;
    }
    
    try {
      await axios.delete(`/cocktails/${cocktailId}`);
      fetchCocktails();
    } catch (err) {
      console.error('Erreur suppression:', err);
      alert('Erreur lors de la suppression');
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedItems.length === 0) return;
    
    const confirmMessage = action === 'delete' 
      ? `Supprimer ${selectedItems.length} cocktail(s) ?`
      : `${action === 'publish' ? 'Publier' : 'Dépublier'} ${selectedItems.length} cocktail(s) ?`;
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      if (action === 'delete') {
        await Promise.all(selectedItems.map(id => axios.delete(`/cocktails/${id}`)));
      } else {
        const publishValue = action === 'publish';
        await Promise.all(selectedItems.map(id => 
          axios.patch(`/cocktails/${id}/publish`, { publish: publishValue })
        ));
      }
      setSelectedItems([]);
      fetchCocktails();
    } catch (err) {
      console.error('Erreur action groupée:', err);
      alert('Erreur lors de l\'action groupée');
    }
  };

  const toggleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedItems.length === cocktails.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(cocktails.map(c => c._id));
    }
  };

  const resetFilters = () => {
    setQuery('');
    setSelectedTheme('');
    setPublishStatus('all');
    setSortBy('updatedAt');
    setSortDirection('desc');
    setCurrentPage(1);
  };

  // Helpers pour l'affichage
  const getImageUrl = (filename) => {
    if (!filename) return '/thumbnail-placeholder.jpg';
    if (/^https?:\/\//.test(filename)) return filename;
    return `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/uploads/${filename}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Composants
  const Header = () => (
    <div className="admin-header">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/admin" className="breadcrumb-link">
          <i className="bi bi-house"></i> Dashboard
        </Link>
        <i className="bi bi-chevron-right" />
        <span>Gestion des cocktails</span>
      </div>

      <div className="header-main">
        <h1>Gestion des Cocktails</h1>
        <div className="stats">
          <span className="stat-item">
            {totalItems} cocktails total
          </span>
          <span className="stat-item published">
            {stats.published} publiés
          </span>
          <span className="stat-item draft">
            {stats.draft} brouillons
          </span>
        </div>
      </div>
      <Link to="/admin/cocktails/add" className="btn-primary">
        <i className="bi bi-plus"></i>
        Nouveau cocktail
      </Link>
    </div>
  );

  const Filters = () => (
    <div className="filters-section">
      <div className="search-box">
        <i className="bi bi-search"></i>
        <input
          type="text"
          placeholder="Rechercher un cocktail..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button onClick={() => setQuery('')} className="clear-btn">
            <i className="bi bi-x"></i>
          </button>
        )}
      </div>
      
      <div className="filter-controls">
        <select 
          value={publishStatus} 
          onChange={(e) => setPublishStatus(e.target.value)}
          className="filter-select"
        >
          <option value="all">Tous les statuts</option>
          <option value="published">Publiés uniquement</option>
          <option value="draft">Brouillons uniquement</option>
        </select>
        
        <select 
          value={selectedTheme} 
          onChange={(e) => setSelectedTheme(e.target.value)}
          className="filter-select"
        >
          <option value="">Tous les thèmes</option>
          {availableThemes.map(theme => (
            <option key={theme.name} value={theme.name}>
              {theme.name} ({theme.count})
            </option>
          ))}
        </select>
        
        <select 
          value={sortBy} 
          onChange={(e) => setSortBy(e.target.value)}
          className="filter-select"
        >
          <option value="updatedAt">Dernière modification</option>
          <option value="createdAt">Date de création</option>
          <option value="name">Nom</option>
          <option value="theme">Thème</option>
        </select>
        
        <button 
          onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
          className="sort-btn"
          title={`Tri ${sortDirection === 'asc' ? 'croissant' : 'décroissant'}`}
        >
          <i className={`bi bi-sort-${sortDirection === 'asc' ? 'up' : 'down'}`}></i>
        </button>
      </div>
      
      <div className="view-controls">
        <button 
          onClick={resetFilters}
          className="btn-secondary"
          disabled={!query && !selectedTheme && publishStatus === 'all' && sortBy === 'updatedAt' && sortDirection === 'desc'}
        >
          Réinitialiser
        </button>
        
        <div className="view-toggle">
          <button
            onClick={() => setViewMode('grid')}
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
          >
            <i className="bi bi-grid-3x3-gap"></i>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
          >
            <i className="bi bi-list"></i>
          </button>
        </div>
      </div>
    </div>
  );

  const BulkActions = () => (
    selectedItems.length > 0 && (
      <div className="bulk-actions">
        <span>{selectedItems.length} élément(s) sélectionné(s)</span>
        <div className="bulk-buttons">
          <button onClick={() => handleBulkAction('publish')} className="btn-success">
            Publier
          </button>
          <button onClick={() => handleBulkAction('unpublish')} className="btn-warning">
            Dépublier
          </button>
          <button onClick={() => handleBulkAction('delete')} className="btn-danger">
            Supprimer
          </button>
          <button onClick={() => setSelectedItems([])} className="btn-secondary">
            Annuler
          </button>
        </div>
      </div>
    )
  );

  const GridView = () => (
    <div className="cocktails-grid">
      {cocktails.map(cocktail => (
        <div key={cocktail._id} className="cocktail-card">
          <div className="card-header">
            <input
              type="checkbox"
              checked={selectedItems.includes(cocktail._id)}
              onChange={() => toggleSelectItem(cocktail._id)}
            />
            <span className={`status-badge ${cocktail.publish ? 'published' : 'draft'}`}>
              {cocktail.publish ? 'Publié' : 'Brouillon'}
            </span>
          </div>
          
          <div className="card-image">
            <img 
              src={getImageUrl(cocktail.thumbnail)} 
              alt={cocktail.name}
              onError={(e) => {
                e.target.src = '/thumbnail-placeholder.jpg';
              }}
            />
          </div>
          
          <div className="card-content">
            <h3>{cocktail.name}</h3>
            <p className="theme">{cocktail.theme}</p>
            <p className="description">{cocktail.description?.slice(0, 100)}...</p>
            <div className="card-meta">
              <small>Modifié le {formatDate(cocktail.updatedAt)}</small>
            </div>
          </div>
          
          <div className="card-actions">
            <Link to={`/cocktails/${cocktail._id}`} className="btn-icon" title="Voir">
              <i className="bi bi-eye"></i>
            </Link>
            <Link to={`/admin/cocktails/edit/${cocktail._id}`} className="btn-icon" title="Modifier">
              <i className="bi bi-pencil"></i>
            </Link>
            <button
              onClick={() => handlePublishToggle(cocktail._id, !cocktail.publish)}
              className="btn-icon"
              title={cocktail.publish ? 'Dépublier' : 'Publier'}
            >
              <i className={`bi ${cocktail.publish ? 'bi-eye-slash' : 'bi-eye'}`}></i>
            </button>
            <button
              onClick={() => handleDelete(cocktail._id)}
              className="btn-icon danger"
              title="Supprimer"
            >
              <i className="bi bi-trash"></i>
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const ListView = () => (
    <div className="cocktails-list">
      <div className="list-header">
        <input
          type="checkbox"
          checked={selectedItems.length === cocktails.length && cocktails.length > 0}
          onChange={selectAll}
        />
        <span>Nom</span>
        <span>Thème</span>
        <span>Statut</span>
        <span>Modifié</span>
        <span>Actions</span>
      </div>
      
      {cocktails.map(cocktail => (
        <div key={cocktail._id} className="list-item">
          <input
            type="checkbox"
            checked={selectedItems.includes(cocktail._id)}
            onChange={() => toggleSelectItem(cocktail._id)}
          />
          
          <div className="item-name">
            <img 
              src={getImageUrl(cocktail.thumbnail)} 
              alt={cocktail.name}
              onError={(e) => {
                e.target.src = '/thumbnail-placeholder.jpg';
              }}
            />
            <div>
              <strong>{cocktail.name}</strong>
              <small>{cocktail.description?.slice(0, 50)}...</small>
            </div>
          </div>
          
          <span className="item-theme">{cocktail.theme}</span>
          
          <span className={`item-status ${cocktail.publish ? 'published' : 'draft'}`}>
            {cocktail.publish ? 'Publié' : 'Brouillon'}
          </span>
          
          <span className="item-date">{formatDate(cocktail.updatedAt)}</span>
          
          <div className="item-actions">
            <Link to={`/cocktails/${cocktail._id}`} className="btn-icon" title="Voir">
              <i className="bi bi-eye"></i>
            </Link>
            <Link to={`/admin/cocktails/edit/${cocktail._id}`} className="btn-icon" title="Modifier">
              <i className="bi bi-pencil"></i>
            </Link>
            <button
              onClick={() => handlePublishToggle(cocktail._id, !cocktail.publish)}
              className="btn-icon"
              title={cocktail.publish ? 'Dépublier' : 'Publier'}
            >
              <i className={`bi ${cocktail.publish ? 'bi-eye-slash' : 'bi-eye'}`}></i>
            </button>
            <button
              onClick={() => handleDelete(cocktail._id)}
              className="btn-icon danger"
              title="Supprimer"
            >
              <i className="bi bi-trash"></i>
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const Pagination = () => (
    <div className="pagination-section">
      <div className="pagination-info">
        <span>
          {cocktails.length === 0 ? 'Aucun' : 
           `${((currentPage - 1) * itemsPerPage) + 1}-${Math.min(currentPage * itemsPerPage, totalItems)}`
          } sur {totalItems} cocktails
        </span>
        
        <select 
          value={itemsPerPage} 
          onChange={(e) => setItemsPerPage(Number(e.target.value))}
        >
          <option value={6}>6 par page</option>
          <option value={12}>12 par page</option>
          <option value={24}>24 par page</option>
          <option value={48}>48 par page</option>
        </select>
      </div>
      
      <div className="pagination-buttons">
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage <= 1}
          className="btn-secondary"
        >
          <i className="bi bi-chevron-left"></i>
          Précédent
        </button>
        
        <span className="page-info">
          Page {currentPage} sur {totalPages}
        </span>
        
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage >= totalPages}
          className="btn-secondary"
        >
          Suivant
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  );

  if (loading && cocktails.length === 0) {
    return (
      <div className="admin-cocktail-manager">
        <div className="loading">
          <div className="spinner"></div>
          <span>Chargement des cocktails...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-cocktail-manager">
      <Header />
      <Filters />
      <BulkActions />
      
      {error && (
        <div className="error-message">
          <i className="bi bi-exclamation-triangle"></i>
          {error}
        </div>
      )}
      
      {cocktails.length === 0 && !loading ? (
        <div className="empty-state">
          <i className="bi bi-cup-straw"></i>
          <h3>Aucun cocktail trouvé</h3>
          <p>
            {query || selectedTheme || publishStatus !== 'all' 
              ? 'Essayez de modifier vos critères de recherche'
              : 'Commencez par ajouter votre premier cocktail'
            }
          </p>
          {(!query && !selectedTheme && publishStatus === 'all') && (
            <Link to="/admin/cocktails/add" className="btn-primary">
              <i className="bi bi-plus"></i>
              Ajouter un cocktail
            </Link>
          )}
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? <GridView /> : <ListView />}
          <Pagination />
        </>
      )}
    </div>
  );
};

export default AdminCocktailManager;
