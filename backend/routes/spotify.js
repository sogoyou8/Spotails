const express = require("express");
const router = express.Router();
const axios = require("axios");
const verifyToken = require("../middleware/verifyToken");
const User = require("../models/User");

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

// Générer un token d'accès serveur (Client Credentials)
const getServerAccessToken = async () => {
    try {
        const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
        const response = await axios.post(
            "https://accounts.spotify.com/api/token",
            new URLSearchParams({ grant_type: "client_credentials" }).toString(),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": `Basic ${basic}`
                }
            }
        );
        return response.data.access_token;
    } catch (error) {
        console.error("Erreur lors de l'obtention du token serveur:", error.response?.status, error.response?.data || error.message);
        throw error;
    }
};

// Initier l'authentification utilisateur
router.get("/auth", verifyToken, (req, res) => {
    const scopes = [
        "user-read-private",
        "user-read-email", 
        "playlist-modify-public",
        "playlist-modify-private",
        "user-library-modify",
        "user-read-playback-state",
        "user-modify-playback-state",
        "streaming"
    ].join(" ");

    const state = req.user.id; // Utiliser l'ID utilisateur comme state
    
    const authURL = `https://accounts.spotify.com/authorize?` +
        `response_type=code&` +
        `client_id=${SPOTIFY_CLIENT_ID}&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&` +
        `state=${state}`;

    res.json({ authURL });
});

// Callback d'authentification
router.get("/callback", async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/account?spotify_error=${error}`);
    }

    try {
        // Échanger le code contre un token
        const tokenResponse = await axios.post("https://accounts.spotify.com/api/token",
            new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: SPOTIFY_REDIRECT_URI,
                client_id: SPOTIFY_CLIENT_ID,
                client_secret: SPOTIFY_CLIENT_SECRET
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        // Obtenir les infos utilisateur Spotify
        const userResponse = await axios.get("https://api.spotify.com/v1/me", {
            headers: {
                "Authorization": `Bearer ${access_token}`
            }
        });

        // Sauvegarder les tokens dans l'utilisateur
        await User.findByIdAndUpdate(state, {
            spotifyId: userResponse.data.id,
            spotifyAccessToken: access_token,
            spotifyRefreshToken: refresh_token,
            spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
        });

        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/account?spotify_connected=true`);
    } catch (error) {
        console.error("Erreur callback Spotify:", error.response?.data);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/account?spotify_error=callback_failed`);
    }
});

// Rechercher des tracks par thème de cocktail
router.get("/search/:theme", async (req, res) => {
    try {
        const { theme } = req.params;
        const { limit = 10 } = req.query;
        
        const accessToken = await getServerAccessToken();
        
        // Recherche basée sur le thème
        const searchQuery = `genre:${theme} OR mood:${theme} OR ${theme}`;
        
        const response = await axios.get("https://api.spotify.com/v1/search", {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            },
            params: {
                q: searchQuery,
                type: "track",
                limit: limit,
                market: "FR"
            }
        });

        res.json(response.data.tracks);
    } catch (error) {
        console.error("Erreur recherche Spotify:", error.response?.data);
        res.status(500).json({ message: "Erreur lors de la recherche Spotify" });
    }
});

// Obtenir des recommandations pour un cocktail
// Replace the genre mapping with valid Spotify genres
const genreMapping = {
    "tropical": "reggae,latin,world-music",
    "classique": "jazz,classical,blues", 
    "moderne": "pop,electronic,house",
    "fruité": "pop,reggae,latin",
    "épicé": "rock,funk,soul",
    "rafraîchissant": "electronic,chill,ambient"
};

// Add a fallback function to validate genres
const getValidGenres = async (serverToken) => {
    try {
        const response = await axios.get("https://api.spotify.com/v1/recommendations/available-genre-seeds", {
            headers: { "Authorization": `Bearer ${serverToken}` }
        });
        return response.data.genres;
    } catch (error) {
        console.warn("Could not fetch valid genres, using fallback");
        // Fallback to known valid genres
        return ["pop", "rock", "jazz", "electronic", "reggae", "latin", "blues", "funk", "soul", "house"];
    }
};

router.get("/recommendations/:cocktailId", async (req, res) => {
    try {
        const { cocktailId } = req.params;
        const Cocktail = require("../models/Cocktail");
        
        const cocktail = await Cocktail.findById(cocktailId);
        if (!cocktail) {
            return res.status(404).json({ message: "Cocktail introuvable" });
        }

        const serverAccess = await getServerAccessToken();

        // Mapper thème cocktail -> terme de recherche Spotify
        const searchTerms = {
            "tropical": "reggae caribbean latin",
            "classique": "jazz smooth classical", 
            "moderne": "pop electronic dance",
            "fruité": "pop summer reggae",
            "épicé": "rock funk energy",
            "rafraîchissant": "chill electronic ambient",
            "rock": "rock alternative indie",
            "jazz": "jazz smooth blues",
            "rap": "hip-hop rap urban",
            "disco": "disco funk dance",
            "détente": "chill lounge ambient"
        };

        const searchTerm = searchTerms[(cocktail.theme || "").toLowerCase()] || "pop chill";
        
        try {
            // Étape 1: Rechercher des tracks liées au thème
            const searchResp = await axios.get("https://api.spotify.com/v1/search", {
                headers: { Authorization: `Bearer ${serverAccess}` },
                params: {
                    q: searchTerm,
                    type: "track",
                    limit: 10,
                    market: "FR"
                }
            });

            const searchTracks = searchResp.data?.tracks?.items || [];
            if (searchTracks.length === 0) {
                throw new Error("Aucune track trouvée pour la recherche");
            }

            // Étape 2: Utiliser ces tracks comme seeds pour les recommandations
            const seedTrackIds = searchTracks.slice(0, 5).map(t => t.id).join(",");
            
            const recoResp = await axios.get("https://api.spotify.com/v1/recommendations", {
                headers: { Authorization: `Bearer ${serverAccess}` },
                params: {
                    seed_tracks: seedTrackIds,
                    limit: 15,
                    market: "FR"
                }
            });

            const tracks = recoResp?.data?.tracks || searchTracks.slice(0, 10);
            
            res.json({ tracks });
        } catch (recoErr) {
            console.warn("Recommandations par search échouent, utilisation directe de la recherche:", recoErr.response?.status);

            // Fallback : utiliser directement les résultats de recherche
            const fallbackResp = await axios.get("https://api.spotify.com/v1/search", {
                headers: { Authorization: `Bearer ${serverAccess}` },
                params: {
                    q: `${cocktail.theme} ${cocktail.name}`,
                    type: "track",
                    limit: 10,
                    market: "FR"
                }
            });
            
            res.json({ tracks: fallbackResp.data?.tracks?.items || [] });
        }
    } catch (error) {
        console.error("Erreur recommandations Spotify:", error.response?.status, error.response?.data || error.message);
        res.status(500).json({ 
            message: "Erreur lors des recommandations Spotify", 
            details: error.response?.data || error.message 
        });
    }
});

// Créer une playlist pour un cocktail
router.post("/playlist/:cocktailId", verifyToken, async (req, res) => {
    try {
        const { cocktailId } = req.params;
        let user = await User.findById(req.user.id);

        // If no spotify token or about to expire, refresh
        const now = Date.now();
        const expiry = user.spotifyTokenExpiry ? new Date(user.spotifyTokenExpiry).getTime() : 0;
        // threshold 60s to avoid race
        if (!user.spotifyAccessToken || expiry <= now + 60000) {
            try {
                const newAccess = await refreshUserAccessToken(user);
                user.spotifyAccessToken = newAccess;
                // reload user from DB to have up-to-date fields
                user = await User.findById(req.user.id);
            } catch (refreshErr) {
                console.error("Impossible de rafraîchir le token Spotify :", refreshErr.response?.data || refreshErr.message);
                return res.status(401).json({ message: "Impossible de rafraîchir le token Spotify. Reconnectez votre compte." });
            }
        }

        if (!user.spotifyAccessToken) {
            return res.status(400).json({ message: "Compte Spotify non connecté" });
        }

        const Cocktail = require("../models/Cocktail");
        const cocktail = await Cocktail.findById(cocktailId);
        
        if (!cocktail) {
            return res.status(404).json({ message: "Cocktail introuvable" });
        }

        // Créer la playlist (utiliser /me pour éviter 404 si spotifyId incorrect)
        const playlistResponse = await axios.post(
            `https://api.spotify.com/v1/me/playlists`,
            {
                name: `Spotails - ${cocktail.name}`,
                description: `Playlist générée pour le cocktail ${cocktail.name} (${cocktail.theme}) depuis Spotails`,
                public: false
            },
            {
                headers: {
                    "Authorization": `Bearer ${user.spotifyAccessToken}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const playlistId = playlistResponse.data.id;

        // --- Remplace l'appel local par un appel direct à Spotify (token serveur) pour récupérer des recommandations
        const serverAccess = await getServerAccessToken();

        // Mapper thème cocktail -> terme de recherche Spotify
        const searchTerms = {
            "tropical": "reggae caribbean latin",
            "classique": "jazz smooth classical", 
            "moderne": "pop electronic dance",
            "fruité": "pop summer reggae",
            "épicé": "rock funk energy",
            "rafraîchissant": "chill electronic ambient",
            "rock": "rock alternative indie",
            "jazz": "jazz smooth blues",
            "rap": "hip-hop rap urban",
            "disco": "disco funk dance"
        };

        const searchTerm = searchTerms[(cocktail.theme || "").toLowerCase()] || "pop chill";
        
        let recoResp;
        try {
            // Étape 1: Rechercher des tracks liées au thème
            const searchResp = await axios.get("https://api.spotify.com/v1/search", {
                headers: { Authorization: `Bearer ${serverAccess}` },
                params: {
                    q: searchTerm,
                    type: "track",
                    limit: 5,
                    market: "FR"
                }
            });

            const searchTracks = searchResp.data?.tracks?.items || [];
            if (searchTracks.length === 0) {
                throw new Error("Aucune track trouvée pour la recherche");
            }

            // Étape 2: Utiliser ces tracks comme seeds pour les recommandations
            const seedTrackIds = searchTracks.slice(0, 5).map(t => t.id).join(",");
            
            recoResp = await axios.get("https://api.spotify.com/v1/recommendations", {
                headers: { Authorization: `Bearer ${serverAccess}` },
                params: {
                    seed_tracks: seedTrackIds,
                    limit: 20,
                    market: "FR"
                }
            });
        } catch (recoErr) {
            console.warn("Recommandations par search échouent, tentative fallback simple:", recoErr.response?.status, recoErr.response?.data || recoErr.message);

            // Fallback ultime: utiliser directement les résultats de recherche
            try {
                const fallbackResp = await axios.get("https://api.spotify.com/v1/search", {
                    headers: { Authorization: `Bearer ${serverAccess}` },
                    params: {
                        q: `${cocktail.theme} ${cocktail.name}`,
                        type: "track",
                        limit: 15,
                        market: "FR"
                    }
                });
                // Simuler la structure de réponse des recommandations
                recoResp = { data: { tracks: fallbackResp.data?.tracks?.items || [] } };
            } catch (fallbackErr) {
                console.error("Echec recherche fallback:", fallbackErr.response?.status, fallbackErr.response?.data || fallbackErr.message);
                return res.status(502).json({ 
                    message: "Erreur lors des recommandations Spotify (toutes tentatives échouées)", 
                    details: fallbackErr.response?.data || fallbackErr.message 
                });
            }
        }

        const tracks = recoResp?.data?.tracks || [];
        if (!tracks.length) {
            console.warn("Aucune piste recommandée trouvée pour:", { cocktailId, searchTerm });
            return res.status(422).json({ message: "Aucune piste recommandée trouvée pour ce cocktail" });
        }

        const trackUris = tracks.map(track => track.uri);

        // Ajouter les tracks à la playlist (vérifier qu'il y a bien des URIs)
        await axios.post(
            `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
            {
                uris: trackUris.slice(0, 15) // Limite à 15 tracks
            },
            {
                headers: {
                    "Authorization": `Bearer ${user.spotifyAccessToken}`,
                    "Content-Type": "application/json"
                }
            }
        );

        res.json({
            playlist: playlistResponse.data,
            message: "Playlist créée avec succès"
        });

    } catch (error) {
        // better logging for debug
        console.error("Erreur création playlist:",
            error.response?.status,
            error.response?.data || error.message,
            { config: error.config && { url: error.config.url, method: error.config.method } }
        );
        return res.status(500).json({
            message: "Erreur lors de la création de la playlist",
            details: error.response?.data || error.message
        });
    }
});

// Déconnecter Spotify
router.delete("/disconnect", verifyToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, {
            $unset: {
                spotifyId: 1,
                spotifyAccessToken: 1,
                spotifyRefreshToken: 1,
                spotifyTokenExpiry: 1
            }
        });

        res.json({ message: "Compte Spotify déconnecté" });
    } catch (error) {
        console.error("Erreur déconnexion Spotify:", error);
        res.status(500).json({ message: "Erreur lors de la déconnexion" });
    }
});

// Route DEBUG temporaire — supprime après vérification
router.get("/debug/token", async (req, res) => {
  try {
    const t = await getServerAccessToken();
    res.json({ ok: true, token_length: t ? t.length : 0 });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.response?.data || err.message });
  }
});

// --- NEW: refresh user access token helper
const refreshUserAccessToken = async (user) => {
    if (!user?.spotifyRefreshToken) throw new Error("No refresh token available");
    try {
        const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
        const resp = await axios.post(
            "https://accounts.spotify.com/api/token",
            new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: user.spotifyRefreshToken
            }).toString(),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": `Basic ${basic}`
                }
            }
        );

        const { access_token, refresh_token, expires_in } = resp.data;

        // if Spotify returned a new refresh_token, save it; else keep existing
        const update = {
            spotifyAccessToken: access_token,
            spotifyTokenExpiry: new Date(Date.now() + (expires_in || 3600) * 1000)
        };
        if (refresh_token) update.spotifyRefreshToken = refresh_token;

        await User.findByIdAndUpdate(user._id, update, { new: true });
        return access_token;
    } catch (err) {
        console.error("Erreur refresh token utilisateur:", err.response?.status, err.response?.data || err.message);
        throw err;
    }
};

// --- NEW: endpoint to manually refresh (for testing)
router.post("/refresh", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
        const newAccess = await refreshUserAccessToken(user);
        res.json({ ok: true, accessToken: newAccess });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.response?.data || err.message });
    }
});

module.exports = router;