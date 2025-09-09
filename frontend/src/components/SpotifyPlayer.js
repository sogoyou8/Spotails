import React, { useState, useEffect } from "react";
import axios from "../axiosConfig";
import "bootstrap-icons/font/bootstrap-icons.css";

const SpotifyPlayer = ({ cocktail }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [recommendations, setRecommendations] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        checkSpotifyConnection();
        if (cocktail) {
            loadRecommendations();
        }
    }, [cocktail]);

    const checkSpotifyConnection = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            
            const res = await axios.get("/users/me", {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("User data:", res.data); // Debug
            setIsConnected(!!res.data.spotifyId);
        } catch (error) {
            console.error("Erreur vérification Spotify:", error);
        }
    };

    const loadRecommendations = async () => {
        if (!cocktail) return;
        setIsLoading(true);
        setError(null);
        try {
            console.log("Loading recommendations for:", cocktail._id);
            
            // Utilise l'endpoint de recommandations serveur (pas besoin d'être connecté)
            const res = await axios.get(`/spotify/recommendations/${cocktail._id}`, {
                // Pas besoin d'auth token pour cet endpoint
            });
            
            console.log("Recommendations response:", res.data);
            setRecommendations(res.data.tracks || []);
        } catch (error) {
            console.error("Erreur recommandations:", error);
            setError(error.response?.data?.message || "Erreur lors du chargement des recommandations");
            
            // Fallback : essayer sans être connecté
            if (error.response?.status === 401) {
                try {
                    const fallbackRes = await axios.get(`/spotify/search/${cocktail.theme || 'jazz'}`);
                    setRecommendations(fallbackRes.data.items || []);
                } catch (fallbackError) {
                    console.error("Fallback failed:", fallbackError);
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    const connectSpotify = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                alert("Vous devez être connecté pour lier Spotify");
                return;
            }
            
            const res = await axios.get("/spotify/auth", {
                headers: { Authorization: `Bearer ${token}` }
            });
            window.location.href = res.data.authURL;
        } catch (error) {
            console.error("Erreur connexion Spotify:", error);
            alert("Erreur lors de la connexion Spotify");
        }
    };

    const createPlaylist = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(`/spotify/playlist/${cocktail._id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(`Playlist "${res.data.playlist.name}" créée avec succès dans votre Spotify !`);
        } catch (error) {
            console.error("Erreur création playlist:", error);
            alert("Erreur lors de la création de la playlist: " + (error.response?.data?.message || error.message));
        }
    };

    const createPlaylistWithPreview = async () => {
        if (recommendations.length === 0) {
            alert("Aucune recommandation disponible");
            return;
        }

        const confirmed = window.confirm(
            `Créer une playlist avec ${recommendations.length} morceaux pour le cocktail ${cocktail.name} ?\n\n` +
            `Aperçu des morceaux :\n` +
            recommendations.slice(0, 3).map(t => `• ${t.name} - ${t.artists[0]?.name}`).join('\n') +
            (recommendations.length > 3 ? `\n... et ${recommendations.length - 3} autres` : '')
        );

        if (!confirmed) return;

        // Puis faire l'appel existant
        createPlaylist();
    };

    const playPreview = (track) => {
        if (currentTrack && currentTrack.preview_url) {
            const audio = document.getElementById("spotify-audio");
            audio.pause();
            if (currentTrack.id === track.id) {
                setCurrentTrack(null);
                return;
            }
        }

        if (track.preview_url) {
            setCurrentTrack(track);
            const audio = document.getElementById("spotify-audio");
            audio.src = track.preview_url;
            audio.play().catch(e => console.log("Erreur lecture audio:", e));
        }
    };

    if (!cocktail) return null;

    return (
        <div className="spotify-player mt-4 p-4" style={{ 
            backgroundColor: cocktail.color, 
            borderRadius: "15px",
            color: cocktail.textColor 
        }}>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="mb-0">
                    <i className="bi bi-spotify me-2"></i>
                    Ambiance Musicale
                </h5>
                {!isConnected ? (
                    <button onClick={connectSpotify} className="btn btn-success btn-sm">
                        <i className="bi bi-spotify"></i> Connecter Spotify
                    </button>
                ) : (
                    <div>
                        <button onClick={loadRecommendations} className="btn btn-outline-light btn-sm me-2">
                            <i className="bi bi-arrow-repeat"></i> Recharger
                        </button>
                        <button onClick={createPlaylistWithPreview} className="btn btn-light btn-sm">
                            <i className="bi bi-plus-circle"></i> Créer Playlist ({recommendations.length} morceaux)
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="alert alert-warning mb-3">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="text-center">
                    <div className="spinner-border spinner-border-sm" role="status"></div>
                    <span className="ms-2">Chargement des recommandations...</span>
                </div>
            ) : recommendations.length > 0 ? (
                <div className="recommendations">
                    <div className="mb-2 text-center">
                        <small className="text-muted">
                            {recommendations.length} recommandations trouvées pour le thème "{cocktail.theme}"
                        </small>
                    </div>
                    {recommendations.slice(0, 5).map((track) => (
                        <div key={track.id} className="d-flex align-items-center justify-content-between py-2 border-bottom border-light">
                            <div className="d-flex align-items-center flex-grow-1">
                                {track.album?.images?.[2] && (
                                    <img 
                                        src={track.album.images[2].url || track.album.images[0]?.url} 
                                        alt={track.album.name}
                                        width="40" 
                                        height="40" 
                                        className="rounded me-3"
                                        onError={(e) => e.target.style.display = 'none'}
                                    />
                                )}
                                <div className="flex-grow-1">
                                    <div className="fw-bold" style={{ fontSize: "0.9rem" }}>
                                        {track.name}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                                        {track.artists?.map(a => a.name).join(", ") || "Artiste inconnu"}
                                    </div>
                                    {/* ✅ Ajoute l'info sur la disponibilité de l'aperçu */}
                                    <div style={{ fontSize: "0.7rem" }} className="text-muted">
                                        {track.preview_url ? (
                                            <span className="text-success">
                                                <i className="bi bi-volume-up"></i> Aperçu disponible (30s)
                                            </span>
                                        ) : (
                                            <span className="text-warning">
                                                <i className="bi bi-volume-mute"></i> Pas d'aperçu
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                {track.preview_url ? (
                                    <button 
                                        onClick={() => playPreview(track)}
                                        className={`btn btn-sm ${currentTrack?.id === track.id ? "btn-warning" : "btn-outline-light"}`}
                                        style={{ minWidth: "40px" }}
                                        title={currentTrack?.id === track.id ? "Arrêter l'aperçu" : "Écouter un aperçu de 30 secondes"}
                                    >
                                        <i className={`bi ${currentTrack?.id === track.id ? "bi-pause-fill" : "bi-play-fill"}`}></i>
                                    </button>
                                ) : (
                                    <button 
                                        className="btn btn-sm btn-outline-secondary" 
                                        disabled
                                        title="Aperçu non disponible pour cette chanson"
                                    >
                                        <i className="bi bi-volume-mute"></i>
                                    </button>
                                )}
                                {track.external_urls?.spotify && (
                                    <a 
                                        href={track.external_urls.spotify} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="btn btn-sm btn-outline-light"
                                        title="Ouvrir dans Spotify"
                                    >
                                        <i className="bi bi-spotify"></i>
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {/* ✅ Ajoute des statistiques */}
                    <div className="mt-3 text-center">
                        <small className="text-muted">
                            {recommendations.filter(t => t.preview_url).length} aperçus audio sur {recommendations.length} morceaux
                        </small>
                    </div>
                </div>
            ) : isConnected ? (
                <div className="text-center text-muted">
                    <p>Aucune recommandation disponible pour ce cocktail</p>
                    <button onClick={loadRecommendations} className="btn btn-outline-light btn-sm">
                        <i className="bi bi-arrow-repeat"></i> Réessayer
                    </button>
                </div>
            ) : (
                <div className="text-center text-muted">
                    <p>Connectez votre compte Spotify pour voir les recommandations musicales</p>
                </div>
            )}

            {/* ✅ Améliore l'audio player */}
            <audio 
                id="spotify-audio" 
                onEnded={() => setCurrentTrack(null)}
                onError={() => {
                    console.warn("Erreur lecture audio");
                    setCurrentTrack(null);
                }}
                style={{ display: 'none' }}
            />

            {/* ✅ Affiche le morceau en cours */}
            {currentTrack && (
                <div className="mt-3 p-3 bg-dark bg-opacity-25 rounded">
                    <div className="d-flex align-items-center justify-content-between">
                        <div>
                            <div className="fw-bold">{currentTrack.name}</div>
                            <div className="text-muted small">{currentTrack.artists?.[0]?.name}</div>
                        </div>
                        <button 
                            onClick={() => {
                                const audio = document.getElementById("spotify-audio");
                                audio.pause();
                                setCurrentTrack(null);
                            }}
                            className="btn btn-sm btn-outline-light"
                            title="Arrêter la lecture"
                        >
                            <i className="bi bi-stop-fill"></i>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpotifyPlayer;
