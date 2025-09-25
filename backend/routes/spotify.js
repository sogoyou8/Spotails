const express = require("express");
const router = express.Router();
const axios = require("axios");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin"); // add
const User = require("../models/User");
const FavoriteTrack = require("../models/FavoriteTrack");

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

// --- Cache des seeds Spotify (24h) ---
const seedsCache = { list: [], ts: 0 };
const SEEDS_TTL_MS = 24 * 60 * 60 * 1000;

async function getAvailableSeedsCached() {
  const now = Date.now();
  if (seedsCache.list.length && (now - seedsCache.ts) < SEEDS_TTL_MS) return seedsCache.list;
  const token = await getServerAccessToken();
  try {
    const { data } = await axios.get(
      "https://api.spotify.com/v1/recommendations/available-genre-seeds",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    seedsCache.list = data.genres || [];
    seedsCache.ts = now;
    return seedsCache.list;
  } catch (e) {
    console.warn("getAvailableSeedsCached failed, fallback used:", e.response?.status || e.message);
    return ["pop","rock","jazz","electronic","house","hip-hop","hip hop","rap","latin","reggae","classical","ambient","chill","dance","metal","disco","soul","funk"];
  }
}

const norm = (s="") => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

const themeToSeedsAlias = {
  "tropical": ["latin","reggae"],
  "detente": ["chill","ambient"],
  "détente": ["chill","ambient"],
  "ambiance": ["chill","lounge","ambient"],
  "classique": ["classical","jazz"],
  "moderne": ["pop","electronic"],
  "fruité": ["pop","latin"],
  "epice": ["funk","rock"],
  "épicé": ["funk","rock"],
  "hip hop": ["hip-hop","rap"],
  "variete francaise": ["french pop","pop"],
  "variété française": ["french pop","pop"]
};

async function resolveSeedsForTheme(rawTheme="") {
  const available = await getAvailableSeedsCached();
  const n = norm(rawTheme);
  if (!n) return ["pop"];

  // exact
  if (available.includes(n)) return [n];

  // alias directs
  if (themeToSeedsAlias[n]) {
    return themeToSeedsAlias[n].map(norm).filter(s => available.includes(s)).slice(0,3);
  }

  // contains / fuzzy-lite
  const contains = available.filter(g => n.includes(g) || g.includes(n));
  if (contains.length) return contains.slice(0,3);

  // heuristiques
  if (/(rap|hip.?hop)/.test(n)) return ["hip-hop","rap"].filter(s => available.includes(s));
  if (/(rock|metal|punk)/.test(n)) return ["rock","metal"].filter(s => available.includes(s));
  if (/(jazz|blues)/.test(n)) return ["jazz","blues"].filter(s => available.includes(s));
  if (/(chill|relax|sleep|ambient|lofi|dormir|detente|détente)/.test(n)) return ["chill","ambient"].filter(s => available.includes(s));
  if (/(electro|edm|house|techno|dance)/.test(n)) return ["electronic","house","dance"].filter(s => available.includes(s));
  if (/(latin|tropic|reggae|carib)/.test(n)) return ["latin","reggae"].filter(s => available.includes(s));
  if (/(classique|orchestra|piano)/.test(n)) return ["classical"].filter(s => available.includes(s));

  return ["pop"];
}

// Endpoint: tester la résolution d’un thème → seeds
router.get("/resolve-theme", async (req, res) => {
  try {
    const t = req.query.theme || "";
    const seeds = await resolveSeedsForTheme(t);
    res.json({ theme: t, seeds });
  } catch {
    res.status(500).json({ message: "resolve-theme failed" });
  }
});

// (optionnel) Audit admin: voir mapping de tous les cocktails
router.get("/audit/cocktail-themes", verifyAdmin, async (req, res) => {
  try {
    const Cocktail = require("../models/Cocktail");
    const list = await Cocktail.find({}, { name:1, theme:1 }).lean();
    const result = [];
    for (const c of list) {
      const seeds = await resolveSeedsForTheme(c.theme || "");
      result.push({ id: c._id, name: c.name, theme: c.theme, seeds });
    }
    res.json({ total: result.length, data: result });
  } catch (e) {
    res.status(500).json({ message: "audit failed" });
  }
});

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

// Rechercher des tracks par thème
const removeDiacritics = (str="") =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

const themeAliasMap = {
  "variete francaise": "french pop chanson",
  "concu specialement pour vous": "chill mix",
  "dernieres sorties": "new music friday",
  "detente": "chill relax ambient",
  "dormir": "sleep calm",
  "ambiance": "lounge chill",
  "hip-hop": "hip hop rap",
  "hiphop": "hip hop rap",
  "rock": "rock",
  "jazz": "jazz",
  "rap": "rap hip hop",
  "disco": "disco funk dance",
  "metal": "metal rock",
  "pop": "pop",
  "classique": "classical orchestra piano"
};

// --- Cache mémoire simple (reset on server restart)
const themeCache = new Map(); // key: norm|limit => { items, ts }
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

function getCacheKey(norm, limit) {
    return `${norm}|${limit}`;
}

function setThemeCache(norm, limit, items) {
    themeCache.set(getCacheKey(norm, limit), { items, ts: Date.now() });
}

function getThemeCache(norm, limit) {
    const entry = themeCache.get(getCacheKey(norm, limit));
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
        themeCache.delete(getCacheKey(norm, limit));
        return null;
    }
    return entry.items;
}

// Mood/activité vs genre hints
const moodAlias = {
    sleep: "sleep calm",
    dormir: "sleep calm ambient",
    detente: "chill relax ambient",
    détente: "chill relax ambient",
    chill: "chill relax",
    ambiance: "lounge chill",
    focus: "focus concentration",
    study: "focus study",
    workout: "workout energy"
};

// COMPLETER themeAliasMap existant si besoin (garde l'existant plus haut)
const extendedThemeAlias = {
    "concu specialement pour vous": "chill mix discovery",
    "conçu spécialement pour vous": "chill mix discovery",
    "variete francaise": "french pop chanson",
    "variété française": "french pop chanson",
    "dernieres sorties": "new music friday",
    "dernières sorties": "new music friday",
    ...moodAlias
};

router.get("/search/:theme", async (req, res) => {
  const started = Date.now();
  let raw = req.params.theme || "";
  const limit = Math.min(50, parseInt(req.query.limit || "30", 10));
  const norm = removeDiacritics(raw.trim());
  try {
    // Cache check
    const cached = getThemeCache(norm, limit);
    if (cached) {
        return res.json({ items: cached.slice(0, limit), cached: true, theme: raw, tookMs: Date.now()-started });
    }

    const accessToken = await getServerAccessToken();
    const alias = extendedThemeAlias[norm] || themeAliasMap?.[norm] || norm;

    const collected = new Map();

    // 1. Track queries
    const queries = [
      `"${alias}"`,
      `${alias} music`,
      `${alias} playlist`,
      alias.split(" ").slice(0,2).join(" ")
    ].filter((q,i,a)=>q && a.indexOf(q)===i);

    for (const q of queries) {
      if (collected.size >= limit) break;
      try {
        const r = await axios.get("https://api.spotify.com/v1/search", {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { q, type:"track", limit: Math.min(8, limit - collected.size), market:"FR" }
        });
        (r.data?.tracks?.items||[]).forEach(t => {
          if (t?.id && !collected.has(t.id)) collected.set(t.id, t);
        });
      } catch (err) {
        // continue
      }
    }

    // 2. Playlist fallback (si peu de résultats ET alias pas purement un genre simple)
    if (collected.size < Math.min(10, limit)) {
      try {
        const playlistSearchQ = alias.split(" ").slice(0,3).join(" ");
        const pr = await axios.get("https://api.spotify.com/v1/search", {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { q: playlistSearchQ, type:"playlist", limit: 3, market:"FR" }
        });
        const playlists = pr.data?.playlists?.items || [];
        if (playlists.length) {
            // Récupérer pistes de la première playlist (max 50)
            const plId = playlists[0].id;
            const tr = await axios.get(`https://api.spotify.com/v1/playlists/${plId}/tracks`, {
              headers: { Authorization: `Bearer ${accessToken}` },
              params: { limit: Math.min(50, limit - collected.size), market:"FR" }
            });
            (tr.data?.items || [])
              .map(it => it.track)
              .filter(Boolean)
              .forEach(t => {
                if (t?.id && !collected.has(t.id)) collected.set(t.id, t);
              });
        }
      } catch (err) {
        // ignore
      }
    }

    // 3. Recommendations fallback (seed genres)
    if (collected.size < Math.min(8, limit)) {
      try {
        const seedsResp = await axios.get("https://api.spotify.com/v1/recommendations/available-genre-seeds", {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const seeds = seedsResp.data.genres || [];
        const chosenSeeds = [];
        for (const s of seeds) {
          if (alias.includes(s) || norm.includes(s)) chosenSeeds.push(s);
          if (chosenSeeds.length === 2) break;
        }
        if (chosenSeeds.length === 0) chosenSeeds.push("pop");
        const rec = await axios.get("https://api.spotify.com/v1/recommendations", {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { seed_genres: chosenSeeds.slice(0,5).join(","), limit: Math.min(20, limit - collected.size), market:"FR" }
        });
        (rec.data?.tracks || []).forEach(t => {
          if (t?.id && !collected.has(t.id)) collected.set(t.id, t);
        });
      } catch (err) {
        // ignore
      }
    }

    const items = Array.from(collected.values()).slice(0, limit);
    setThemeCache(norm, limit, items);

    res.json({
      theme: raw,
      aliasUsed: alias,
      total: items.length,
      items,
      tookMs: Date.now() - started
    });
  } catch (e) {
    console.error("search route fatal:", e.response?.data || e.message);
    res.status(500).json({ message: "Erreur recherche Spotify", details: e.response?.data || e.message });
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
        if (!cocktail) return res.status(404).json({ message: "Cocktail introuvable." });

        const serverAccess = await getServerAccessToken();
        const seeds = await resolveSeedsForTheme(cocktail.theme || "");
        const recUrl = `https://api.spotify.com/v1/recommendations?limit=30&seed_genres=${encodeURIComponent(seeds.join(","))}`;

        try {
          const { data } = await axios.get(recUrl, { headers: { Authorization: `Bearer ${serverAccess}` } });
          if (Array.isArray(data.tracks) && data.tracks.length) {
            return res.json({ tracks: data.tracks, seeds, method: "recommendations" });
          }
        } catch (reErr) {
          console.warn("recommendations by seeds failed:", reErr.response?.status || reErr.message);
        }

        // Fallback: conserver votre logique search existante (…)
        // res.json({ tracks: [], seeds, method: "fallback" });
        return res.json({ tracks: [], seeds, method: "fallback" });
    } catch (error) {
        console.error("Erreur recommandations Spotify:", error.response?.status, error.response?.data || error.message);
        res.status(500).json({ message: "Erreur lors des recommandations Spotify" });
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

// Ajouter un morceau aux favoris
router.post("/favorite-tracks", verifyToken, async (req, res) => {
    try {
        const { trackId, trackName, artistName, previewUrl, spotifyUrl, albumImage, cocktailId } = req.body;
        
        const favoriteTrack = new FavoriteTrack({
            userId: req.user.id,
            trackId,
            trackName,
            artistName,
            previewUrl,
            spotifyUrl,
            albumImage,
            cocktailId
        });
        
        await favoriteTrack.save();
        res.json({ message: "Morceau ajouté aux favoris", track: favoriteTrack });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: "Morceau déjà dans les favoris" });
        }
        console.error("Erreur ajout favori track:", error);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Retirer un morceau des favoris
router.delete("/favorite-tracks/:trackId", verifyToken, async (req, res) => {
    try {
        await FavoriteTrack.findOneAndDelete({
            userId: req.user.id,
            trackId: req.params.trackId
        });
        res.json({ message: "Morceau retiré des favoris" });
    } catch (error) {
        console.error("Erreur suppression favori track:", error);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Obtenir tous les morceaux favoris
router.get("/favorite-tracks", verifyToken, async (req, res) => {
    try {
        const favoriteTracks = await FavoriteTrack.find({ userId: req.user.id })
            .populate('cocktailId', 'name theme color')
            .sort({ createdAt: -1 });
        res.json(favoriteTracks);
    } catch (error) {
        console.error("Erreur récupération favoris tracks:", error);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Recherche de morceaux Spotify
router.get("/search-tracks", async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        
        if (!q) {
            return res.status(400).json({ message: "Paramètre de recherche requis" });
        }
        
        const accessToken = await getServerAccessToken();
        
        const response = await axios.get("https://api.spotify.com/v1/search", {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            },
            params: {
                q: q,
                type: "track",
                limit: limit,
                market: "FR"
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error("Erreur recherche tracks Spotify:", error.response?.data);
        res.status(500).json({ message: "Erreur lors de la recherche Spotify" });
    }
});

/**
 * Helper de refresh (si pas déjà défini proprement plus haut)
 */
async function refreshUserAccessToken(user) {
    if (!user.spotifyRefreshToken) {
        throw new Error("Aucun refresh token Spotify.");
    }
    try {
        const resp = await axios.post(
            "https://accounts.spotify.com/api/token",
            new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: user.spotifyRefreshToken,
                client_id: SPOTIFY_CLIENT_ID,
                client_secret: SPOTIFY_CLIENT_SECRET
            }).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        user.spotifyAccessToken = resp.data.access_token;
        if (resp.data.refresh_token) {
            user.spotifyRefreshToken = resp.data.refresh_token;
        }
        if (resp.data.expires_in) {
            user.spotifyTokenExpiry = new Date(Date.now() + resp.data.expires_in * 1000);
        }
        await user.save();
        return user.spotifyAccessToken;
    } catch (err) {
        console.error("Erreur refresh token Spotify:", err.response?.data || err.message);
        throw new Error("Refresh token Spotify échoué");
    }
}

/**
 * Créer une playlist personnalisée depuis une liste d'URIs
 * Body: { name, description?, tracks: [ 'spotify:track:xxx' | 'xxx' ] }
 */
router.post("/create-custom-playlist", verifyToken, async (req, res) => {
    try {
        const { name, description = "Playlist générée via Spotails", tracks = [] } = req.body;
        if (!name || !Array.isArray(tracks) || tracks.length === 0) {
            return res.status(400).json({ message: "Nom et liste de morceaux requis." });
        }

        let user = await User.findById(req.user.id);
        if (!user) return res.status(401).json({ message: "Utilisateur introuvable." });
        if (!user.spotifyAccessToken) {
            return res.status(400).json({ message: "Compte Spotify non connecté." });
        }

        // Refresh si expiré (< 60s)
        const now = Date.now();
        const exp = user.spotifyTokenExpiry ? new Date(user.spotifyTokenExpiry).getTime() : 0;
        if (!exp || exp < now + 60000) {
            await refreshUserAccessToken(user);
        }

        const accessToken = user.spotifyAccessToken;

        // Normaliser URIs
        const uris = tracks
            .map(t => t?.startsWith("spotify:track:") ? t : `spotify:track:${t}`)
            .filter(Boolean);

        // Créer playlist
        const createResp = await axios.post(
            "https://api.spotify.com/v1/me/playlists",
            {
                name: name.substring(0, 95),
                description,
                public: false
            },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const playlistId = createResp.data.id;
        const externalUrl = createResp.data.external_urls?.spotify;

        // Ajout par chunks de 100
        const chunkSize = 100;
        for (let i = 0; i < uris.length; i += chunkSize) {
            const chunk = uris.slice(i, i + chunkSize);
            await axios.post(
                `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
                { uris: chunk },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
        }

        return res.json({
            message: "Playlist créée",
            playlistId,
            external_url: externalUrl,
            totalTracks: uris.length
        });
    } catch (error) {
        console.error("Erreur create-custom-playlist:", error.response?.data || error.message);
        return res.status(500).json({
            message: "Erreur création playlist Spotify",
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

// Endpoint to manually refresh (for testing)
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

// Retourne les genres Spotify + thèmes déjà présents en base
router.get("/genres", async (req, res) => {
  try {
    const seeds = await getAvailableSeedsCached(); // array of spotify seeds
    const Cocktail = require("../models/Cocktail");
    const themesRaw = await Cocktail.distinct("theme") || [];
    const themes = themesRaw
      .map(t => (typeof t === "string" ? t.trim() : ""))
      .filter(Boolean);

    // Ne pas renvoyer de doublons : garder l'ordre seeds puis thèmes supplémentaires
    const seedsLc = seeds.map(s => s.toLowerCase());
    const extraThemes = themes.filter(t => !seedsLc.includes((t || "").toLowerCase()));

    res.json({ spotifySeeds: seeds, existingThemes: extraThemes });
  } catch (err) {
    console.error("Erreur /spotify/genres:", err?.message || err);
    res.status(500).json({ spotifySeeds: [], existingThemes: [] });
  }
});

// util diacritiques (si absent ici, reprend celui plus haut)
const strip = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Récupère une image Spotify pour un thème (catégorie ou première playlist)
async function findSpotifyThemeImage(theme) {
  const token = await getServerAccessToken();
  const headers = { Authorization: `Bearer ${token}` };
  const t = strip(theme);

  // 1) Catégories
  try {
    const { data } = await axios.get("https://api.spotify.com/v1/browse/categories", {
      headers, params: { country: "FR", locale: "fr_FR", limit: 50 }
    });
    const items = data?.categories?.items || [];
    let found = items.find(c => strip(c.name) === t) ||
                items.find(c => strip(c.name).includes(t) || t.includes(strip(c.name)));
    if (found?.icons?.length) return found.icons[0].url;
  } catch (_) {}

  // 2) Playlists liées au thème
  try {
    const { data } = await axios.get("https://api.spotify.com/v1/search", {
      headers,
      params: { q: theme, type: "playlist", market: "FR", limit: 1 }
    });
    const pl = data?.playlists?.items?.[0];
    const img = pl?.images?.[0]?.url;
    if (img) return img;
  } catch (_) {}

  return null;
}

// GET /api/spotify/theme-image?theme=rock
router.get("/theme-image", async (req, res) => {
  try {
    const theme = req.query.theme || "";
    if (!theme.trim()) return res.status(400).json({ image: null });
    const url = await findSpotifyThemeImage(theme);
    res.json({ image: url });
  } catch (e) {
    res.status(500).json({ image: null });
  }
});

module.exports = router;