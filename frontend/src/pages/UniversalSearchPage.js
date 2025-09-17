import React, { useState, useEffect } from "react";
import axios from "../axiosConfig";
import { Link } from "react-router-dom";
import useDebounce from "../hooks/useDebounce";
import { analytics } from '../utils/analytics';

const UniversalSearchPage = () => {
    const [query, setQuery] = useState("");
    const [cocktailResults, setCocktailResults] = useState([]);
    const [trackResults, setTrackResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("all");
    const [favoriteTracks, setFavoriteTracks] = useState([]);
    const [currentTrack, setCurrentTrack] = useState(null);
    
    const debouncedQuery = useDebounce(query, 500);

    useEffect(() => {
        if (debouncedQuery.length >= 2) {
            performSearch(debouncedQuery);
        } else {
            setCocktailResults([]);
            setTrackResults([]);
        }
    }, [debouncedQuery]);

    useEffect(() => {
        loadFavoriteTracks();
    }, []);

    const loadFavoriteTracks = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            
            const res = await axios.get("/spotify/favorite-tracks");
            setFavoriteTracks(res.data);
        } catch (error) {
            console.error("Erreur chargement favoris:", error);
        }
    };

    const performSearch = async (searchQuery) => {
        setIsLoading(true);
        analytics.trackSearch(searchQuery, 0);
        
        try {
            // Recherche cocktails
            const cocktailRes = await axios.get(`/cocktails?q=${searchQuery}&limit=10`);
            setCocktailResults(cocktailRes.data.data || []);

            // Recherche Spotify
            const spotifyRes = await axios.get(`/spotify/search-tracks?q=${searchQuery}&limit=10`);
            setTrackResults(spotifyRes.data.tracks?.items || []);
            
            // Track analytics
            const totalResults = (cocktailRes.data.data?.length || 0) + (spotifyRes.data.tracks?.items?.length || 0);
            analytics.trackSearch(searchQuery, totalResults);
            
        } catch (error) {
            console.error("Erreur recherche:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTrackFavorite = async (track) => {
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Connectez-vous pour sauvegarder des morceaux");
            return;
        }

        const isFavorite = favoriteTracks.some(fav => fav.trackId === track.id);
        
        try {
            if (isFavorite) {
                await axios.delete(`/spotify/favorite-tracks/${track.id}`);
                setFavoriteTracks(prev => prev.filter(fav => fav.trackId !== track.id));
            } else {
                await axios.post(`/spotify/favorite-tracks`, {
                    trackId: track.id,
                    trackName: track.name,
                    artistName: track.artists?.[0]?.name,
                    previewUrl: track.preview_url,
                    spotifyUrl: track.external_urls?.spotify,
                    albumImage: track.album?.images?.[2]?.url
                });
                loadFavoriteTracks();
            }
        } catch (error) {
            console.error("Erreur favoris track:", error);
            alert("Erreur lors de la sauvegarde");
        }
    };

    const playPreview = (track) => {
        if (currentTrack?.id === track.id) {
            setCurrentTrack(null);
            return;
        }
        
        if (track.preview_url) {
            setCurrentTrack(track);
            analytics.trackMusicPreview(track.id, track.name, null);
        }
    };

    const isTrackFavorite = (trackId) => favoriteTracks.some(fav => fav.trackId === trackId);

    return (
        <div className="container mt-4">
            <div className="row justify-content-center">
                <div className="col-md-10">
                    <h2 className="text-light text-center mb-4">
                        <i className="bi bi-search me-2"></i>
                        Recherche Universelle
                    </h2>
                    
                    {/* Barre de recherche */}
                    <div className="search-container mb-4">
                        <div className="input-group">
                            <span className="input-group-text bg-dark text-light">
                                <i className="bi bi-search"></i>
                            </span>
                            <input
                                type="text"
                                className="form-control bg-dark text-light border-secondary"
                                placeholder="Rechercher des cocktails, morceaux, artistes..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                        {isLoading && (
                            <div className="text-center mt-2">
                                <div className="spinner-border spinner-border-sm text-light" role="status"></div>
                                <span className="text-light ms-2">Recherche en cours...</span>
                            </div>
                        )}
                    </div>

                    {/* Onglets */}
                    <ul className="nav nav-tabs mb-3">
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === "all" ? "active" : ""}`}
                                onClick={() => setActiveTab("all")}
                            >
                                Tout ({cocktailResults.length + trackResults.length})
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === "cocktails" ? "active" : ""}`}
                                onClick={() => setActiveTab("cocktails")}
                            >
                                <i className="bi bi-cup-straw me-1"></i>
                                Cocktails ({cocktailResults.length})
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === "tracks" ? "active" : ""}`}
                                onClick={() => setActiveTab("tracks")}
                            >
                                <i className="bi bi-music-note me-1"></i>
                                Morceaux ({trackResults.length})
                            </button>
                        </li>
                    </ul>

                    {/* Résultats */}
                    <div className="results">
                        {/* Section Cocktails */}
                        {(activeTab === "all" || activeTab === "cocktails") && cocktailResults.length > 0 && (
                            <div className="mb-4">
                                <h5 className="text-light mb-3">
                                    <i className="bi bi-cup-straw me-2"></i>Cocktails
                                </h5>
                                <div className="row">
                                    {cocktailResults.map(cocktail => (
                                        <div key={cocktail._id} className="col-md-6 col-lg-4 mb-3">
                                            <Link to={`/cocktails/${cocktail._id}`} className="text-decoration-none">
                                                <div className="card bg-dark text-light h-100 border-secondary">
                                                    <div className="card-body">
                                                        <h6 className="card-title">{cocktail.name}</h6>
                                                        <p className="card-text small text-muted">{cocktail.description}</p>
                                                        <span 
                                                            className="badge" 
                                                            style={{ backgroundColor: cocktail.color }}
                                                        >
                                                            {cocktail.theme}
                                                        </span>
                                                    </div>
                                                </div>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Section Morceaux */}
                        {(activeTab === "all" || activeTab === "tracks") && trackResults.length > 0 && (
                            <div className="mb-4">
                                <h5 className="text-light mb-3">
                                    <i className="bi bi-music-note me-2"></i>Morceaux
                                </h5>
                                {trackResults.map(track => (
                                    <div key={track.id} className="card bg-dark text-light mb-2 border-secondary">
                                        <div className="card-body py-3">
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center flex-grow-1">
                                                    {track.album?.images?.[2] && (
                                                        <img 
                                                            src={track.album.images[2].url} 
                                                            alt={track.album.name}
                                                            width="50" 
                                                            height="50" 
                                                            className="rounded me-3"
                                                        />
                                                    )}
                                                    <div className="flex-grow-1">
                                                        <div className="fw-bold">{track.name}</div>
                                                        <div className="text-muted small">
                                                            {track.artists?.map(a => a.name).join(", ")}
                                                        </div>
                                                        <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                                            {track.preview_url ? (
                                                                <span className="text-success">
                                                                    <i className="bi bi-volume-up"></i> Aperçu 30s
                                                                </span>
                                                            ) : (
                                                                <span className="text-warning">
                                                                    <i className="bi bi-volume-mute"></i> Pas d'aperçu
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="d-flex gap-2">
                                                    {/* Bouton favori */}
                                                    <button 
                                                        onClick={() => toggleTrackFavorite(track)}
                                                        className={`btn btn-sm ${isTrackFavorite(track.id) ? "btn-warning" : "btn-outline-warning"}`}
                                                        title={isTrackFavorite(track.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                                                    >
                                                        <i className={`bi ${isTrackFavorite(track.id) ? "bi-heart-fill" : "bi-heart"}`}></i>
                                                    </button>
                                                    
                                                    {/* Bouton lecture */}
                                                    {track.preview_url ? (
                                                        <button 
                                                            onClick={() => playPreview(track)}
                                                            className={`btn btn-sm ${currentTrack?.id === track.id ? "btn-success" : "btn-outline-light"}`}
                                                        >
                                                            <i className={`bi ${currentTrack?.id === track.id ? "bi-pause-fill" : "bi-play-fill"}`}></i>
                                                        </button>
                                                    ) : (
                                                        <button className="btn btn-sm btn-outline-secondary" disabled>
                                                            <i className="bi bi-volume-mute"></i>
                                                        </button>
                                                    )}
                                                    
                                                    {/* Lien Spotify */}
                                                    <a 
                                                        href={track.external_urls?.spotify} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="btn btn-sm btn-success"
                                                        title="Ouvrir dans Spotify"
                                                    >
                                                        <i className="bi bi-spotify"></i>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Message si pas de résultats */}
                        {query.length >= 2 && !isLoading && cocktailResults.length === 0 && trackResults.length === 0 && (
                            <div className="text-center text-muted py-5">
                                <i className="bi bi-search" style={{ fontSize: "3rem" }}></i>
                                <h5 className="mt-3">Aucun résultat trouvé</h5>
                                <p>Essayez avec d'autres mots-clés</p>
                            </div>
                        )}

                        {/* Message d'invitation */}
                        {query.length < 2 && (
                            <div className="text-center text-muted py-5">
                                <i className="bi bi-search" style={{ fontSize: "3rem" }}></i>
                                <h5 className="mt-3">Recherche Universelle</h5>
                                <p>Tapez au moins 2 caractères pour rechercher dans notre base de cocktails et la bibliothèque Spotify</p>
                            </div>
                        )}
                    </div>

                    {/* Audio player caché */}
                    {currentTrack && (
                        <audio 
                            key={currentTrack.id}
                            src={currentTrack.preview_url} 
                            autoPlay
                            onEnded={() => setCurrentTrack(null)}
                            onError={() => setCurrentTrack(null)}
                            style={{ display: 'none' }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default UniversalSearchPage;