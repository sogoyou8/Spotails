import React, { useState, useRef, useEffect } from 'react';
import '../styles/PlaylistDetailModal.css';

const PlaylistDetailModal = ({ 
  playlist, 
  onClose, 
  onDelete, 
  onRename
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const audioRef = useRef(null);

  // Helpers
  const getPreviewUrl = (track) => track?.previewUrl || track?.preview_url || null;
  const getTrackImage = (track) => {
    if (!track) return '/thumbnail-placeholder.jpg';
    return track.albumImage ||
           track.album?.images?.[0]?.url ||
           track.album?.images?.[1]?.url ||
           '/thumbnail-placeholder.jpg';
  };
  
  const getTrackName = (track) => track?.trackName || track?.name || 'Titre inconnu';
  const getArtistName = (track) => {
    if (track?.artistName) return track.artistName;
    if (Array.isArray(track?.artists)) {
      return track.artists.map(a => a.name || a).join(', ');
    }
    return 'Artiste inconnu';
  };
  
  const formatDuration = (ms) => {
    if (!ms || isNaN(ms)) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  // Audio player
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      setCurrentTrack(null);
      setIsPlaying(false);
    };

    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, []);

  const playPreview = (track) => {
    const url = getPreviewUrl(track);
    if (!url) {
      alert('Aucun aperçu disponible');
      return;
    }

    if (currentTrack && currentTrack === track) {
      audioRef.current?.pause();
      setCurrentTrack(null);
      setIsPlaying(false);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play()
          .then(() => {
            setCurrentTrack(track);
            setIsPlaying(true);
          })
          .catch(err => {
            console.error('Erreur lecture:', err);
            alert('Impossible de lire cet aperçu');
          });
      }
    }
  };

  // Données
  const tracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
  const playlistName = playlist?.name || 'Sans nom';
  const username = playlist?.username || 'Anonyme';
  const createdAt = playlist?.createdAt ? new Date(playlist.createdAt).toLocaleDateString('fr-FR') : 'N/A';

  const totalTracks = tracks.length;
  const totalDuration = tracks.reduce((sum, t) => sum + (t?.duration_ms || t?.durationMs || 0), 0);
  const totalMinutes = Math.floor(totalDuration / 60000);
  const hasPreview = tracks.filter(t => getPreviewUrl(t)).length;

  if (!playlist) {
    return null;
  }

  return (
    <div className="playlist-detail-overlay" onClick={onClose}>
      <div className="playlist-detail-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header">
          <div className="playlist-header-info">
            <div className="playlist-cover-large">
              {(() => {
                const images = tracks
                  .map(t => getTrackImage(t))
                  .filter(img => img !== '/thumbnail-placeholder.jpg')
                  .slice(0, 4);
                
                if (images.length === 0) {
                  return (
                    <div className="empty-cover">
                      <i className="bi bi-music-note-list"></i>
                    </div>
                  );
                }
                
                if (images.length === 1) {
                  return <img src={images[0]} alt={playlistName} />;
                }
                
                return (
                  <div className={`cover-collage cover-${images.length}`}>
                    {images.map((img, i) => (
                      <div key={i} className={`collage-item item-${i + 1}`}>
                        <img src={img} alt="" />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="playlist-metadata">
              <h2>{playlistName}</h2>
              <div className="playlist-info-row">
                <span className="playlist-owner">
                  <i className="bi bi-person"></i>
                  {username}
                </span>
                <span className="playlist-stats">
                  <i className="bi bi-music-note-list"></i>
                  {totalTracks} {totalTracks > 1 ? 'morceaux' : 'morceau'}
                </span>
                <span className="playlist-duration">
                  <i className="bi bi-clock"></i>
                  {totalMinutes} min
                </span>
                <span className="playlist-preview-count">
                  <i className="bi bi-headphones"></i>
                  {hasPreview} aperçus
                </span>
              </div>
              <div className="playlist-dates">
                <span>Créée le {createdAt}</span>
              </div>
            </div>
          </div>

          <div className="modal-actions-header">
            {onRename && (
              <button 
                className="btn-modal-action edit"
                onClick={() => {
                  const newName = prompt('Nouveau nom:', playlistName);
                  if (newName && newName.trim()) {
                    onRename(playlist._id || playlist.id, newName.trim());
                  }
                }}
                title="Renommer"
              >
                <i className="bi bi-pencil"></i>
              </button>
            )}
            {onDelete && (
              <button 
                className="btn-modal-action danger"
                onClick={() => {
                  if (window.confirm(`Supprimer "${playlistName}" ?`)) {
                    onDelete(playlist._id || playlist.id);
                  }
                }}
                title="Supprimer"
              >
                <i className="bi bi-trash"></i>
              </button>
            )}
            <button 
              className="btn-modal-close"
              onClick={onClose}
              title="Fermer"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">
          {tracks.length === 0 ? (
            <div className="empty-playlist">
              <i className="bi bi-music-note-list"></i>
              <h3>Playlist vide</h3>
              <p>Cette playlist ne contient aucun morceau</p>
            </div>
          ) : (
            <div className="tracks-list">
              {tracks.map((track, index) => {
                const preview = getPreviewUrl(track);
                const isCurrentlyPlaying = currentTrack === track && isPlaying;

                return (
                  <div 
                    key={track?.id || track?.trackId || index} 
                    className={`track-item ${isCurrentlyPlaying ? 'playing' : ''}`}
                  >
                    <div className="track-number">
                      {isCurrentlyPlaying ? (
                        <i className="bi bi-volume-up-fill"></i>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>

                    <div className="track-cover">
                      <img src={getTrackImage(track)} alt={getTrackName(track)} />
                      {preview && (
                        <button 
                          className="play-btn"
                          onClick={() => playPreview(track)}
                        >
                          <i className={`bi ${isCurrentlyPlaying ? 'bi-pause-fill' : 'bi-play-fill'}`}></i>
                        </button>
                      )}
                    </div>

                    <div className="track-info">
                      <div className="track-name">{getTrackName(track)}</div>
                      <div className="track-artist">{getArtistName(track)}</div>
                    </div>

                    <div className="track-album">
                      {track?.album?.name || track?.albumName || '-'}
                    </div>

                    <div className="track-duration">
                      {formatDuration(track?.duration_ms || track?.durationMs)}
                    </div>

                    <div className="track-actions">
                      {track?.spotifyUrl && (
                        <a 
                          href={track.spotifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="track-action-btn spotify"
                          title="Ouvrir dans Spotify"
                        >
                          <i className="bi bi-spotify"></i>
                        </a>
                      )}
                      {!preview && (
                        <span className="no-preview-badge">Pas d'aperçu</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <audio ref={audioRef} style={{ display: 'none' }} />

        {currentTrack && isPlaying && (
          <div className="mini-player">
            <img src={getTrackImage(currentTrack)} alt="" className="mini-player-cover" />
            <div className="mini-player-info">
              <div className="mini-player-name">{getTrackName(currentTrack)}</div>
              <div className="mini-player-artist">{getArtistName(currentTrack)}</div>
            </div>
            <button 
              className="mini-player-btn"
              onClick={() => {
                audioRef.current?.pause();
                setCurrentTrack(null);
                setIsPlaying(false);
              }}
            >
              <i className="bi bi-pause-fill"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistDetailModal;