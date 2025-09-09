import React, { useState, useEffect, useRef } from "react";
import axios from "../axiosConfig";
import "bootstrap-icons/font/bootstrap-icons.css";
import { analytics } from '../utils/analytics';

const SpotifyPlayerAdvanced = ({ cocktail }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [recommendations, setRecommendations] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [error, setError] = useState(null);
    const [playbackProgress, setPlaybackProgress] = useState(0);
    const [volume, setVolume] = useState(0.7);
    const audioRef = useRef(null);
    const progressInterval = useRef(null);

    useEffect(() => {
        checkSpotifyConnection();
        if (cocktail) {
            loadRecommendations();
        }
    }, [cocktail]);

    // Progress tracking
    useEffect(() => {
        if (currentTrack && audioRef.current) {
            progressInterval.current = setInterval(() => {
                const audio = audioRef.current;
                if (audio.duration) {
                    setPlaybackProgress((audio.currentTime / audio.duration) * 100);
                }
            }, 100);
        } else {
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
            }
        }

        return () => {
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
            }
        };
    }, [currentTrack]);

    const checkSpotifyConnection = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            
            const res = await axios.get("/users/me", {
                headers: { Authorization: `Bearer ${token}` }
            });
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
            const res = await axios.get(`/spotify/recommendations/${cocktail._id}`);
            setRecommendations(res.data.tracks || []);
        } catch (error) {
            console.error("Erreur recommandations:", error);
            setError(error.response?.data?.message || "Erreur lors du chargement des recommandations");
        } finally {
            setIsLoading(false);
        }
    };

    const playPreview = (track) => {
        if (currentTrack && currentTrack.id === track.id) {
            // Pause current track
            audioRef.current?.pause();
            setCurrentTrack(null);
            setPlaybackProgress(0);
            return;
        }

        if (track.preview_url) {
            setCurrentTrack(track);
            setPlaybackProgress(0);
            
            // ✅ Track lecture audio
            analytics.trackMusicPreview(track.id, track.name, cocktail._id);
            
            if (audioRef.current) {
                audioRef.current.src = track.preview_url;
                audioRef.current.volume = volume;
                audioRef.current.play().catch(e => {
                    console.log("Erreur lecture audio:", e);
                    setCurrentTrack(null);
                });
            }
        }
    };

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    };

    const handleProgressClick = (e) => {
        if (!audioRef.current || !currentTrack) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const newTime = percentage * audioRef.current.duration;
        
        audioRef.current.currentTime = newTime;
        setPlaybackProgress(percentage * 100);
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

    const createPlaylistWithPreview = async () => {
        if (recommendations.length === 0) {
            alert("Aucune recommandation disponible");
            return;
        }

        const availableTracks = recommendations.filter(t => t.preview_url);
        const confirmed = window.confirm(
            `Créer une playlist "${cocktail.name}" avec ${recommendations.length} morceaux ?\n\n` +
            `📊 Statistiques :\n` +
            `• ${availableTracks.length} aperçus audio disponibles\n` +
            `• ${recommendations.length - availableTracks.length} morceaux sans aperçu\n\n` +
            `🎵 Exemples :\n` +
            recommendations.slice(0, 3).map(t => `• ${t.name} - ${t.artists[0]?.name}`).join('\n') +
            (recommendations.length > 3 ? `\n... et ${recommendations.length - 3} autres` : '')
        );

        if (!confirmed) return;

        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(`/spotify/playlist/${cocktail._id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // ✅ Track création playlist
            analytics.trackSpotifyPlaylistCreated(cocktail._id, res.data.playlist.id);
            
            // Notification de succès améliorée
            const notification = document.createElement('div');
            notification.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show position-fixed" 
                     style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;" role="alert">
                    <i class="bi bi-spotify me-2"></i>
                    <strong>Playlist créée !</strong><br>
                    "${res.data.playlist.name}" ajoutée à votre Spotify
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
            document.body.appendChild(notification);
            
            // Auto-remove après 5 secondes
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 5000);
            
        } catch (error) {
            console.error("Erreur création playlist:", error);
            alert("Erreur lors de la création de la playlist: " + (error.response?.data?.message || error.message));
        }
    };

    if (!cocktail) return null;

    const availablePreviewsCount = recommendations.filter(t => t.preview_url).length;

    return (
        <div className="spotify-player-advanced mt-4 p-4" style={{ 
            backgroundColor: cocktail.color, 
            borderRadius: "15px",
            color: cocktail.textColor 
        }}>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="mb-0">
                    <i className="bi bi-spotify me-2"></i>
                    Ambiance Musicale
                    {recommendations.length > 0 && (
                        <small className="ms-2 opacity-75">
                            ({availablePreviewsCount}/{recommendations.length} aperçus)
                        </small>
                    )}
                </h5>
                
                <div className="d-flex align-items-center gap-2">
                    {!isConnected ? (
                        <button onClick={connectSpotify} className="btn btn-success btn-sm">
                            <i className="bi bi-spotify"></i> Connecter Spotify
                        </button>
                    ) : (
                        <>
                            <button onClick={loadRecommendations} className="btn btn-outline-light btn-sm">
                                <i className="bi bi-arrow-repeat"></i>
                            </button>
                            <button onClick={createPlaylistWithPreview} className="btn btn-light btn-sm">
                                <i className="bi bi-plus-circle"></i> Playlist ({recommendations.length})
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Player Controls */}
            {currentTrack && (
                <div className="player-controls mb-3 p-3 bg-dark bg-opacity-25 rounded">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="flex-grow-1">
                            <div className="fw-bold">{currentTrack.name}</div>
                            <div className="text-muted small">{currentTrack.artists?.[0]?.name}</div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-volume-down"></i>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={volume}
                                onChange={handleVolumeChange}
                                className="form-range"
                                style={{ width: "80px" }}
                            />
                            <i className="bi bi-volume-up"></i>
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div 
                        className="progress mb-2" 
                        style={{ height: "8px", cursor: "pointer" }}
                        onClick={handleProgressClick}
                    >
                        <div 
                            className="progress-bar bg-warning" 
                            style={{ width: `${playbackProgress}%` }}
                        ></div>
                    </div>
                    
                    <div className="d-flex justify-content-center">
                        <button 
                            onClick={() => playPreview(currentTrack)}
                            className="btn btn-warning btn-sm"
                        >
                            <i className="bi bi-pause-fill"></i> Pause
                        </button>
                    </div>
                </div>
            )}

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
                    <div className="mb-3 text-center">
                        <small className="text-muted">
                            {recommendations.length} morceaux trouvés pour "{cocktail.theme}"
                        </small>
                        {availablePreviewsCount === 0 && (
                            <div className="alert alert-info mt-2">
                                <i className="bi bi-info-circle"></i> 
                                <strong>Aucun aperçu audio disponible</strong><br/>
                                Spotify ne fournit des aperçus que pour certains morceaux. 
                                Vous pouvez créer une playlist complète et l'écouter dans Spotify !
                            </div>
                        )}
                    </div>
                    
                    {recommendations.slice(0, 8).map((track, index) => (
                        <div key={track.id} className="track-item d-flex align-items-center justify-content-between py-2 border-bottom border-light">
                            <div className="d-flex align-items-center flex-grow-1">
                                <div className="track-number me-3 text-muted" style={{ minWidth: "20px" }}>
                                    {index + 1}
                                </div>
                                
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
                                        {currentTrack?.id === track.id && (
                                            <i className="bi bi-volume-up ms-2 text-warning"></i>
                                        )}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                                        {track.artists?.map(a => a.name).join(", ") || "Artiste inconnu"}
                                    </div>
                                    <div style={{ fontSize: "0.7rem" }} className="text-muted">
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
                            
                            <div className="d-flex align-items-center gap-2">
                                {track.preview_url ? (
                                    <button 
                                        onClick={() => playPreview(track)}
                                        className={`btn btn-sm ${currentTrack?.id === track.id ? "btn-warning" : "btn-outline-light"}`}
                                        style={{ minWidth: "40px" }}
                                        title={currentTrack?.id === track.id ? "Pause" : "Jouer l'aperçu"}
                                    >
                                        <i className={`bi ${currentTrack?.id === track.id ? "bi-pause-fill" : "bi-play-fill"}`}></i>
                                    </button>
                                ) : (
                                    <button 
                                        className="btn btn-sm btn-outline-secondary" 
                                        disabled
                                        title="Aperçu non disponible"
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

            {/* Audio Element */}
            <audio 
                ref={audioRef}
                onEnded={() => {
                    setCurrentTrack(null);
                    setPlaybackProgress(0);
                }}
                onError={() => {
                    console.warn("Erreur lecture audio");
                    setCurrentTrack(null);
                    setPlaybackProgress(0);
                }}
                style={{ display: 'none' }}
            />
        </div>
    );
};

export default SpotifyPlayerAdvanced;