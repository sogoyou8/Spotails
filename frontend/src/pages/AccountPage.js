import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../axiosConfig';
import '../styles/AccountPage.css';

const AccountPage = () => {
    const [userInfo, setUserInfo] = useState(null);
    const [activeTab, setActiveTab] = useState("profile");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [spotifyConnected, setSpotifyConnected] = useState(false);
    const [stats, setStats] = useState({
        favoriteTracks: 0,
        playlists: 0,
        joinDate: null
    });
    
    // Forms states
    const [profileForm, setProfileForm] = useState({
        username: '',
        email: ''
    });
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    
    const navigate = useNavigate();

    useEffect(() => {
        fetchUserData();
        fetchUserStats();
    }, []);

    const fetchUserData = async () => {
        try {
            const response = await axios.get('/users/me');
            const userData = response.data;
            setUserInfo(userData);
            setProfileForm({
                username: userData.username || '',
                email: userData.email || ''
            });
            setSpotifyConnected(!!userData.spotifyId);
        } catch (err) {
            setError("Erreur lors du chargement des données utilisateur");
            if (err.response?.status === 401) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchUserStats = async () => {
        try {
            const [tracksRes, playlistsRes] = await Promise.all([
                axios.get('/spotify/favorite-tracks'),
                axios.get('/playlists')
            ]);
            
            setStats({
                favoriteTracks: tracksRes.data.length || 0,
                playlists: playlistsRes.data.length || 0,
                joinDate: userInfo?.createdAt
            });
        } catch (err) {
            console.error('Erreur stats:', err);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        try {
            await axios.put('/users/profile', profileForm);
            setSuccessMessage('Profil mis à jour avec succès');
            localStorage.setItem('username', profileForm.username);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Erreur lors de la mise à jour');
        }
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères');
            return;
        }

        try {
            await axios.put('/users/password', {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            setSuccessMessage('Mot de passe mis à jour avec succès');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Erreur lors de la mise à jour');
        }
    };

    const connectSpotify = async () => {
        try {
            const response = await axios.get('/spotify/auth');
            window.location.href = response.data.authURL;
        } catch (err) {
            setError('Erreur lors de la connexion Spotify');
        }
    };

    const disconnectSpotify = async () => {
        if (!window.confirm('Êtes-vous sûr de vouloir déconnecter Spotify ?')) return;
        
        try {
            await axios.delete('/spotify/disconnect');
            setSpotifyConnected(false);
            setSuccessMessage('Spotify déconnecté avec succès');
        } catch (err) {
            setError('Erreur lors de la déconnexion Spotify');
        }
    };

    const handleDeleteAccount = async () => {
        const confirmation = window.prompt(
            'Pour supprimer votre compte, tapez "SUPPRIMER" en majuscules:'
        );
        
        if (confirmation !== 'SUPPRIMER') return;
        
        try {
            await axios.delete('/users/me');
            localStorage.clear();
            navigate('/');
        } catch (err) {
            setError('Erreur lors de la suppression du compte');
        }
    };

    const getInitials = (name) => {
        if (!name) return 'U';
        return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Non disponible';
        return new Date(dateString).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="account-page">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <span>Chargement de votre compte...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="account-page">
            <div className="account-container">
                {/* Header avec avatar et infos principales */}
                <div className="account-header">
                    <div className="profile-card">
                        <div className="profile-avatar">
                            <span className="avatar-text">{getInitials(userInfo?.username)}</span>
                        </div>
                        <div className="profile-info">
                            <h1 className="profile-name">{userInfo?.username}</h1>
                            <p className="profile-email">{userInfo?.email}</p>
                            <div className="profile-badges">
                                <span className={`role-badge ${userInfo?.role}`}>
                                    <i className={`bi ${userInfo?.role === 'admin' ? 'bi-shield-check' : 'bi-person'}`}></i>
                                    {userInfo?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                                </span>
                                {spotifyConnected && (
                                    <span className="spotify-badge">
                                        <i className="bi bi-spotify"></i>
                                        Spotify connecté
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Stats rapides */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-number">{stats.favoriteTracks}</div>
                            <div className="stat-label">Morceaux favoris</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-number">{stats.playlists}</div>
                            <div className="stat-label">Playlists créées</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-number">{formatDate(userInfo?.createdAt)}</div>
                            <div className="stat-label">Membre depuis</div>
                        </div>
                    </div>
                </div>

                {/* Navigation par onglets */}
                <div className="account-nav">
                    <button
                        className={`nav-tab ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        <i className="bi bi-person-gear"></i>
                        Profil
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'security' ? 'active' : ''}`}
                        onClick={() => setActiveTab('security')}
                    >
                        <i className="bi bi-shield-lock"></i>
                        Sécurité
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'integrations' ? 'active' : ''}`}
                        onClick={() => setActiveTab('integrations')}
                    >
                        <i className="bi bi-plug"></i>
                        Intégrations
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'danger' ? 'active' : ''}`}
                        onClick={() => setActiveTab('danger')}
                    >
                        <i className="bi bi-exclamation-triangle"></i>
                        Zone dangereuse
                    </button>
                </div>

                {/* Messages d'état */}
                {error && (
                    <div className="alert alert-error">
                        <i className="bi bi-exclamation-circle"></i>
                        {error}
                    </div>
                )}
                {successMessage && (
                    <div className="alert alert-success">
                        <i className="bi bi-check-circle"></i>
                        {successMessage}
                    </div>
                )}

                {/* Contenu des onglets */}
                <div className="account-content">
                    {activeTab === 'profile' && (
                        <div className="tab-content">
                            <div className="section-card">
                                <div className="section-header">
                                    <h3>Informations du profil</h3>
                                    <p>Modifiez vos informations personnelles</p>
                                </div>
                                <form onSubmit={handleProfileUpdate} className="form-grid">
                                    <div className="form-group">
                                        <label htmlFor="username">Nom d'utilisateur</label>
                                        <input
                                            type="text"
                                            id="username"
                                            value={profileForm.username}
                                            onChange={(e) => setProfileForm({
                                                ...profileForm,
                                                username: e.target.value
                                            })}
                                            className="form-input"
                                            maxLength="20"
                                            required
                                        />
                                        <small className="form-help">
                                            Entre 3 et 20 caractères, lettres et chiffres uniquement
                                        </small>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="email">Adresse email</label>
                                        <input
                                            type="email"
                                            id="email"
                                            value={profileForm.email}
                                            onChange={(e) => setProfileForm({
                                                ...profileForm,
                                                email: e.target.value
                                            })}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div className="form-actions">
                                        <button type="submit" className="btn btn-primary">
                                            <i className="bi bi-check"></i>
                                            Sauvegarder les modifications
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="tab-content">
                            <div className="section-card">
                                <div className="section-header">
                                    <h3>Changer le mot de passe</h3>
                                    <p>Assurez-vous d'utiliser un mot de passe fort et unique</p>
                                </div>
                                <form onSubmit={handlePasswordUpdate} className="form-grid">
                                    <div className="form-group">
                                        <label htmlFor="currentPassword">Mot de passe actuel</label>
                                        <input
                                            type="password"
                                            id="currentPassword"
                                            value={passwordForm.currentPassword}
                                            onChange={(e) => setPasswordForm({
                                                ...passwordForm,
                                                currentPassword: e.target.value
                                            })}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="newPassword">Nouveau mot de passe</label>
                                        <input
                                            type="password"
                                            id="newPassword"
                                            value={passwordForm.newPassword}
                                            onChange={(e) => setPasswordForm({
                                                ...passwordForm,
                                                newPassword: e.target.value
                                            })}
                                            className="form-input"
                                            minLength="8"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
                                        <input
                                            type="password"
                                            id="confirmPassword"
                                            value={passwordForm.confirmPassword}
                                            onChange={(e) => setPasswordForm({
                                                ...passwordForm,
                                                confirmPassword: e.target.value
                                            })}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div className="form-actions">
                                        <button type="submit" className="btn btn-primary">
                                            <i className="bi bi-shield-check"></i>
                                            Mettre à jour le mot de passe
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {activeTab === 'integrations' && (
                        <div className="tab-content">
                            <div className="section-card">
                                <div className="section-header">
                                    <h3>Connexion Spotify</h3>
                                    <p>Connectez votre compte Spotify pour créer des playlists automatiquement</p>
                                </div>
                                <div className="integration-item">
                                    <div className="integration-info">
                                        <div className="integration-icon spotify">
                                            <i className="bi bi-spotify"></i>
                                        </div>
                                        <div className="integration-details">
                                            <h4>Spotify</h4>
                                            <p>
                                                {spotifyConnected 
                                                    ? 'Votre compte est connecté et prêt à créer des playlists'
                                                    : 'Connectez votre compte pour profiter de toutes les fonctionnalités'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div className="integration-actions">
                                        {spotifyConnected ? (
                                            <button 
                                                onClick={disconnectSpotify}
                                                className="btn btn-outline btn-danger"
                                            >
                                                <i className="bi bi-unlink"></i>
                                                Déconnecter
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={connectSpotify}
                                                className="btn btn-spotify"
                                            >
                                                <i className="bi bi-spotify"></i>
                                                Connecter Spotify
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'danger' && (
                        <div className="tab-content">
                            <div className="section-card danger-zone">
                                <div className="section-header">
                                    <h3>Zone dangereuse</h3>
                                    <p>Actions irréversibles qui affecteront définitivement votre compte</p>
                                </div>
                                <div className="danger-item">
                                    <div className="danger-info">
                                        <h4>Supprimer le compte</h4>
                                        <p>
                                            Une fois supprimé, toutes vos données seront définitivement perdues.
                                            Cette action est irréversible.
                                        </p>
                                    </div>
                                    <button 
                                        onClick={handleDeleteAccount}
                                        className="btn btn-danger"
                                    >
                                        <i className="bi bi-trash"></i>
                                        Supprimer le compte
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccountPage;
