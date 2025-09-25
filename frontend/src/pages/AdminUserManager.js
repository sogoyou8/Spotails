import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../axiosConfig';
import useDebounce from '../hooks/useDebounce';
import '../styles/AdminUserManager.css';

const AdminUserManager = () => {
  const navigate = useNavigate();

  // États principaux
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtres et recherche
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Vue et sélection
  const [viewMode, setViewMode] = useState('list');
  const [selectedItems, setSelectedItems] = useState([]);

  // Stats
  const [stats, setStats] = useState({ total: 0, admins: 0, users: 0 });

  const debouncedQuery = useDebounce(query, 300);

  // Charger les utilisateurs
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        q: debouncedQuery || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        page: currentPage,
        limit: itemsPerPage,
        sortBy,
        sortDir: sortDirection
      };

      const res = await axios.get('/users', { params });
      const payload = res.data;

      // compatibilité: backend peut renvoyer { data, total, totalPages } ou un tableau simple
      const list = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : payload.data || []);
      const total = payload.total ?? (Array.isArray(payload) ? payload.length : list.length);
      const totalPages = payload.totalPages ?? Math.max(1, Math.ceil(total / itemsPerPage));

      setUsers(list);
      setTotalItems(total);
      setTotalPages(totalPages);

      // si le backend retourne des stats
      if (payload.stats) {
        setStats(payload.stats);
      } else {
        const adminsCount = list.filter(u => u.role === 'admin').length;
        const usersCount = list.filter(u => u.role === 'user').length;
        setStats({ total, admins: adminsCount, users: usersCount });
      }
    } catch (err) {
      console.error('Erreur fetchUsers', err);
      setError(err.response?.data?.message || 'Erreur lors du chargement des utilisateurs');
      setUsers([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, roleFilter, currentPage, itemsPerPage, sortBy, sortDirection]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Réinitialiser la page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, roleFilter, sortBy, sortDirection]);

  // Actions
  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`Changer le rôle vers "${newRole}" ?`)) return;
    try {
      await axios.put(`/users/${userId}/role`, { role: newRole });
      fetchUsers();
    } catch (err) {
      console.error('handleRoleChange', err);
      alert('Erreur lors du changement de rôle');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Supprimer cet utilisateur ?')) return;
    try {
      await axios.delete(`/users/${userId}`);
      setSelectedItems(prev => prev.filter(id => id !== userId));
      fetchUsers();
    } catch (err) {
      console.error('handleDelete', err);
      alert('Erreur lors de la suppression');
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedItems.length === 0) return;
    let confirmMessage = '';
    if (action === 'delete') confirmMessage = `Supprimer ${selectedItems.length} utilisateur(s) ?`;
    if (action === 'promote') confirmMessage = `Promouvoir ${selectedItems.length} utilisateur(s) en admin ?`;
    if (action === 'demote') confirmMessage = `Rétrograder ${selectedItems.length} admin(s) en user ?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      if (action === 'delete') {
        await Promise.all(selectedItems.map(id => axios.delete(`/users/${id}`)));
      } else {
        const role = action === 'promote' ? 'admin' : 'user';
        await Promise.all(selectedItems.map(id => axios.put(`/users/${id}/role`, { role })));
      }
      setSelectedItems([]);
      fetchUsers();
    } catch (err) {
      console.error('handleBulkAction', err);
      alert('Erreur lors de l\'action groupée');
    }
  };

  const toggleSelectItem = (id) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedItems.length === users.length) setSelectedItems([]);
    else setSelectedItems(users.map(u => u._id));
  };

  const resetFilters = () => {
    setQuery('');
    setRoleFilter('all');
    setSortBy('createdAt');
    setSortDirection('desc');
    setCurrentPage(1);
  };

  // Helpers
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getInitials = (username) => {
    if (!username) return 'U';
    return username.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  };

  // Pagination helpers
  const goToPage = (p) => {
    const page = Math.max(1, Math.min(totalPages, p));
    setCurrentPage(page);
  };

  const visibleUsers = useMemo(() => users, [users]);

  // Render
  return (
    <div className="admin-user-manager">
      <div className="user-manager-header">
        <div className="breadcrumb">
          <Link to="/admin" className="breadcrumb-link"><i className="bi bi-house"></i> Dashboard</Link>
          <i className="bi bi-chevron-right" />
          <span>Gestion des utilisateurs</span>
        </div>

        <div className="header-content">
          <h1>Gestion des Utilisateurs</h1>
          <div className="stats-overview">
            <div className="stat-card total">
              <div className="stat-number">{stats.total}</div>
              <div className="stat-label">Total</div>
            </div>
            <div className="stat-card admins">
              <div className="stat-number">{stats.admins}</div>
              <div className="stat-label">Admins</div>
            </div>
            <div className="stat-card users">
              <div className="stat-number">{stats.users}</div>
              <div className="stat-label">Users</div>
            </div>
          </div>
        </div>
      </div>

      <div className="user-toolbar">
        <div className="toolbar-section">
          <div className="search-container">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Rechercher un utilisateur..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
            />
            {query && <button onClick={() => setQuery('')} className="clear-search"><i className="bi bi-x" /></button>}
          </div>

          <div className="filters">
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="filter-select">
              <option value="all">Tous les rôles</option>
              <option value="admin">Administrateurs</option>
              <option value="user">Utilisateurs</option>
            </select>

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
              <option value="createdAt">Date d'inscription</option>
              <option value="username">Nom d'utilisateur</option>
              <option value="email">Email</option>
              <option value="role">Rôle</option>
            </select>

            <button onClick={() => setSortDirection(s => s === 'asc' ? 'desc' : 'asc')} className="sort-direction-btn" title="Changer le sens du tri">
              <i className={`bi bi-sort-${sortDirection === 'asc' ? 'up' : 'down'}`} />
            </button>
          </div>
        </div>

        <div className="toolbar-actions">
          <button onClick={resetFilters} className="reset-btn" disabled={!query && roleFilter === 'all' && sortBy === 'createdAt' && sortDirection === 'desc'}>
            <i className="bi bi-arrow-clockwise" /> Reset
          </button>

          <div className="view-switcher">
            <button onClick={() => setViewMode('grid')} className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} title="Vue grille"><i className="bi bi-grid-3x3-gap" /></button>
            <button onClick={() => setViewMode('list')} className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} title="Vue liste"><i className="bi bi-list" /></button>
          </div>
        </div>
      </div>

      <div style={{ margin: '1rem 1rem' }}>
        {selectedItems.length > 0 && (
          <div className="bulk-actions">
            <div className="bulk-info"><i className="bi bi-check-square" /> {selectedItems.length} sélectionné(s)</div>
            <div className="bulk-buttons">
              <button onClick={() => handleBulkAction('promote')} className="bulk-btn promote">Promouvoir</button>
              <button onClick={() => handleBulkAction('demote')} className="bulk-btn demote">Rétrograder</button>
              <button onClick={() => handleBulkAction('delete')} className="bulk-btn delete">Supprimer</button>
              <button onClick={() => setSelectedItems([])} className="bulk-btn cancel">Annuler</button>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-banner"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      <div className="users-content">
        {loading && users.length === 0 ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            Chargement...
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-people" />
            <h3>Aucun utilisateur</h3>
            <p>{query || roleFilter !== 'all' ? 'Ajustez vos filtres.' : 'Aucun utilisateur enregistré.'}</p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="users-grid">
                {visibleUsers.map(user => (
                  <div key={user._id} className="user-card">
                    <div className="card-select">
                      <input type="checkbox" id={`select-${user._id}`} checked={selectedItems.includes(user._id)} onChange={() => toggleSelectItem(user._id)} />
                      <label htmlFor={`select-${user._id}`} className="select-label"><i className="bi bi-check" /></label>
                    </div>

                    <div className="user-avatar">
                      <div className="avatar-circle">{getInitials(user.username)}</div>
                      <div className={`role-indicator ${user.role}`}><i className={`bi ${user.role === 'admin' ? 'bi-shield-check' : 'bi-person'}`} /></div>
                    </div>

                    <div className="user-info">
                      <h3 className="username">{user.username}</h3>
                      <p className="email">{user.email}</p>
                      <div className="role-badge"><span className={`badge ${user.role}`}>{user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}</span></div>
                      <div className="join-date">Inscrit le {formatDate(user.createdAt)}</div>
                    </div>

                    <div className="card-actions">
                      <button onClick={() => handleRoleChange(user._id, user.role === 'admin' ? 'user' : 'admin')} className="action-btn role" title="Changer rôle">
                        <i className={`bi ${user.role === 'admin' ? 'bi-shield-minus' : 'bi-shield-plus'}`} />
                      </button>
                      <button onClick={() => navigate(`/admin/users/${user._id}`)} className="action-btn" title="Voir">
                        <i className="bi bi-eye" />
                      </button>
                      <button onClick={() => handleDelete(user._id)} className="action-btn delete" title="Supprimer">
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="users-table">
                <div className="table-header">
                  <div className="header-cell select">
                    <input type="checkbox" id="select-all" checked={selectedItems.length === users.length && users.length > 0} onChange={selectAll} />
                    <label htmlFor="select-all" className="select-all-label"><i className="bi bi-check" /></label>
                  </div>
                  <div className="header-cell user">Utilisateur</div>
                  <div className="header-cell email">Email</div>
                  <div className="header-cell role">Rôle</div>
                  <div className="header-cell date">Inscription</div>
                  <div className="header-cell actions">Actions</div>
                </div>

                <div className="table-body">
                  {visibleUsers.map(user => (
                    <div key={user._id} className="table-row">
                      <div className="table-cell select">
                        <input type="checkbox" id={`row-select-${user._id}`} checked={selectedItems.includes(user._id)} onChange={() => toggleSelectItem(user._id)} />
                        <label htmlFor={`row-select-${user._id}`} className="select-label"><i className="bi bi-check" /></label>
                      </div>

                      <div className="table-cell user">
                        <div className="user-profile">
                          <div className="avatar-small">{getInitials(user.username)}</div>
                          <div className="user-details">
                            <div className="username">{user.username}</div>
                            <div className="user-id">ID: {String(user._id).slice(-8)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="table-cell email">{user.email}</div>

                      <div className="table-cell role">
                        <span className={`role-badge ${user.role}`}>
                          <i className={`bi ${user.role === 'admin' ? 'bi-shield-check' : 'bi-person'}`} /> {user.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </div>

                      <div className="table-cell date">{formatDate(user.createdAt)}</div>

                      <div className="table-cell actions">
                        <div className="action-buttons">
                          <button onClick={() => handleRoleChange(user._id, user.role === 'admin' ? 'user' : 'admin')} className="action-btn role" title="Changer rôle">
                            <i className={`bi ${user.role === 'admin' ? 'bi-shield-minus' : 'bi-shield-plus'}`} />
                          </button>
                          <button onClick={() => handleDelete(user._id)} className="action-btn delete" title="Supprimer">
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pagination-container">
              <div className="pagination-info">
                <span className="results-text">
                  {users.length === 0 ? 'Aucun résultat' : `${((currentPage - 1) * itemsPerPage) + 1}-${Math.min(currentPage * itemsPerPage, totalItems)} sur ${totalItems}`}
                </span>

                <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="per-page-select">
                  <option value={10}>10 / page</option>
                  <option value={15}>15 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>

              <div className="pagination-controls">
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className="pagination-btn"><i className="bi bi-chevron-left" /></button>
                <span className="page-display">Page {currentPage} / {totalPages}</span>
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} className="pagination-btn"><i className="bi bi-chevron-right" /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminUserManager;
