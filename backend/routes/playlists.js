const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require('../middleware/verifyAdmin');
const Playlist = require("../models/Playlist");
const User = require("../models/User");

// GET mes playlists
router.get("/", verifyToken, async (req, res) => {
  const items = await Playlist.find({ userId: req.user.id }).sort({ updatedAt: -1 });
  res.json(items);
});

// POST créer
router.post("/", verifyToken, async (req, res) => {
  const { name, tracks = [] } = req.body;
  if (!name) return res.status(400).json({ message: "name requis" });
  const exists = await Playlist.findOne({ userId: req.user.id, name: { $regex: `^${name}$`, $options: "i" } });
  if (exists) return res.status(409).json({ message: "Une playlist du même nom existe déjà." });
  const doc = await Playlist.create({ userId: req.user.id, name: name.trim(), tracks, coverIndex: 0 });
  res.status(201).json(doc);
});

// PUT maj (nom et/ou pistes)
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { name, tracks } = req.body;
  const pl = await Playlist.findOne({ _id: id, userId: req.user.id });
  if (!pl) return res.status(404).json({ message: "Playlist introuvable" });

  if (typeof name === "string" && name.trim()) {
    const dup = await Playlist.findOne({
      userId: req.user.id,
      _id: { $ne: id },
      name: { $regex: `^${name}$`, $options: "i" },
    });
    if (dup) return res.status(409).json({ message: "Une playlist du même nom existe déjà." });
    pl.name = name.trim();
  }
  if (Array.isArray(tracks)) {
    pl.tracks = tracks;
    if (pl.coverIndex >= pl.tracks.length) pl.coverIndex = 0;
  }
  await pl.save();
  res.json(pl);
});

// PATCH cover
router.patch("/:id/cover", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { coverIndex = 0 } = req.body;
  const pl = await Playlist.findOne({ _id: id, userId: req.user.id });
  if (!pl) return res.status(404).json({ message: "Playlist introuvable" });
  pl.coverIndex = Number(coverIndex) || 0;
  await pl.save();
  res.json({ ok: true, coverIndex: pl.coverIndex });
});

// DELETE
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  await Playlist.deleteOne({ _id: id, userId: req.user.id });
  res.json({ ok: true });
});

// Liste paginée des playlists (admin)
router.get('/admin', verifyAdmin, async (req, res) => {
  try {
    const { page = '1', limit = '20', q = '' } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (p - 1) * l;
    const filter = q ? { name: { $regex: q, $options: 'i' } } : {};
    const Playlist = require('../models/Playlist');

    const [items, total] = await Promise.all([
      Playlist.find(filter).sort({ createdAt: -1 }).skip(skip).limit(l),
      Playlist.countDocuments(filter)
    ]);
    res.json({ data: items, page: p, totalPages: Math.ceil(total / l), total });
  } catch (e) {
    res.status(500).json({ message: 'Erreur chargement playlists', error: e.message });
  }
});

// Playlists flagged (noms inappropriés, etc.)
router.get('/admin/flagged', verifyAdmin, async (req, res) => {
  try {
    const Playlist = require('../models/Playlist');
    const flaggedTerms = ['spam', 'test', 'aaaa', 'untitled', 'nouvelle playlist'];
    
    const flagged = await Playlist.find({
      $or: flaggedTerms.map(term => ({ name: { $regex: term, $options: 'i' } }))
    }).populate('createdBy', 'username').limit(20);
    
    const enriched = flagged.map(p => ({
      ...p.toObject(),
      flagReason: 'Nom suspect ou générique'
    }));
    
    res.json({ data: enriched });
  } catch (e) {
    res.status(500).json({ message: 'Erreur flagged playlists', error: e.message });
  }
});

// Top playlists (par nombre de morceaux et récence)
router.get('/admin/top-playlists', verifyAdmin, async (req, res) => {
  try {
    const topPlaylists = await Playlist.aggregate([
      { $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }},
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $addFields: {
        trackCount: { $size: { $ifNull: ['$tracks', []] } },
        username: '$user.username'
      }},
      { $sort: { trackCount: -1, updatedAt: -1 } },
      { $limit: 20 },
      { $project: {
        name: 1,
        tracks: 1,
        trackCount: 1,
        username: 1,
        createdAt: 1,
        updatedAt: 1
      }}
    ]);
    
    res.json({ data: topPlaylists });
  } catch (e) {
    res.status(500).json({ message: 'Erreur top playlists', error: e.message });
  }
});

// Playlists récentes (7 derniers jours)
router.get('/admin/recent', verifyAdmin, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const recentPlaylists = await Playlist.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }},
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $addFields: {
        username: '$user.username'
      }},
      { $sort: { createdAt: -1 } },
      { $limit: 20 },
      { $project: {
        name: 1,
        tracks: 1,
        username: 1,
        createdAt: 1
      }}
    ]);
    
    res.json({ data: recentPlaylists });
  } catch (e) {
    res.status(500).json({ message: 'Erreur playlists récentes', error: e.message });
  }
});

// Top créateurs (utilisateurs avec le plus de playlists)
router.get('/admin/top-creators', verifyAdmin, async (req, res) => {
  try {
    const topCreators = await Playlist.aggregate([
      { $group: {
        _id: '$userId',
        playlistCount: { $sum: 1 },
        totalTracks: { $sum: { $size: { $ifNull: ['$tracks', []] } } },
        lastActivity: { $max: '$updatedAt' }
      }},
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }},
      { $unwind: '$user' },
      { $project: {
        _id: '$user._id',
        username: '$user.username',
        email: '$user.email',
        role: '$user.role',
        createdAt: '$user.createdAt',
        playlistCount: 1,
        totalTracks: 1,
        lastActivity: 1
      }},
      { $sort: { playlistCount: -1, totalTracks: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({ data: topCreators });
  } catch (e) {
    res.status(500).json({ message: 'Erreur top créateurs', error: e.message });
  }
});

// Stats améliorées
router.get('/admin/stats', verifyAdmin, async (req, res) => {
  try {
    const [totalPlaylists, totalTracks, avgTracks, activeCreators] = await Promise.all([
      Playlist.countDocuments(),
      Playlist.aggregate([
        { $project: { trackCount: { $size: { $ifNull: ['$tracks', []] } } } },
        { $group: { _id: null, total: { $sum: '$trackCount' } } }
      ]),
      Playlist.aggregate([
        { $project: { trackCount: { $size: { $ifNull: ['$tracks', []] } } } },
        { $group: { _id: null, avg: { $avg: '$trackCount' } } }
      ]),
      Playlist.distinct('userId').then(ids => ids.length)
    ]);
    
    res.json({
      total: totalPlaylists,
      totalTracks: totalTracks[0]?.total || 0,
      avgTracksPerPlaylist: avgTracks[0]?.avg || 0,
      activeCreators
    });
  } catch (e) {
    res.status(500).json({ message: 'Erreur stats playlists', error: e.message });
  }
});

// Playlists d'un utilisateur spécifique (pour admin)
router.get('/admin/user/:userId', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const playlists = await Playlist.find({ userId })
      .sort({ updatedAt: -1 })
      .select('name tracks createdAt updatedAt');
    
    const user = await User.findById(userId).select('username email createdAt');
    
    res.json({
      success: true,
      playlists,
      user,
      total: playlists.length
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Erreur récupération playlists utilisateur',
      error: e.message
    });
  }
});

// Supprimer une playlist (admin)
router.delete('/admin/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Playlist.findByIdAndDelete(id);
    res.json({ success: true, message: 'Playlist supprimée' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur suppression', error: e.message });
  }
});

// Modifier une playlist (admin)
router.patch('/admin/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Nom requis' });
    }
    
    const playlist = await Playlist.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true }
    );
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist introuvable' });
    }
    
    res.json({ success: true, playlist });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur modification', error: e.message });
  }
});

// NOUVEAU - Récupérer les tracks d'une playlist pour admin
router.get('/admin/:playlistId/tracks', verifyAdmin, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.playlistId).lean();
    if (!playlist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Playlist introuvable' 
      });
    }

    // ✅ Récupérer les infos utilisateur
    const User = require('../models/User');
    const user = await User.findById(playlist.userId).select('username email').lean();

    // ✅ STRUCTURE ENRICHIE pour le frontend
    res.json({
      success: true,
      playlist: {
        _id: playlist._id,
        name: playlist.name,
        username: user?.username || 'Utilisateur supprimé',
        userEmail: user?.email || null,
        tracks: playlist.tracks || [],
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        coverIndex: playlist.coverIndex ?? 0,
        trackCount: (playlist.tracks || []).length,
        totalDuration: (playlist.tracks || []).reduce((sum, t) => 
          sum + (t.duration_ms || t.durationMs || 0), 0
        )
      }
    });
  } catch (e) {
    console.error('Erreur GET /admin/:playlistId/tracks:', e);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur', 
      error: e.message 
    });
  }
});

// NOUVEAU - Récupérer toutes les playlists d'un utilisateur pour admin
router.get('/admin/user/:userId', verifyAdmin, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }
    
    const playlists = await Playlist.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .select('name tracks createdAt flagReason');
    
    res.json({ 
      success: true,
      playlists: playlists,
      username: user.username,
      totalPlaylists: playlists.length
    });
  } catch (e) {
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des playlists utilisateur", 
      error: e.message 
    });
  }
});

// NOUVEAU - Analytics des playlists pour admin
router.get('/admin/stats', verifyAdmin, async (req, res) => {
  try {
    const totalPlaylists = await Playlist.countDocuments();
    const emptyPlaylists = await Playlist.countDocuments({
      $or: [
        { tracks: { $exists: false } },
        { tracks: { $size: 0 } }
      ]
    });
    
    const statsAgg = await Playlist.aggregate([
      {
        $project: {
          trackCount: { $size: { $ifNull: ["$tracks", []] } },
          totalDuration: {
            $sum: {
              $map: {
                input: { $ifNull: ["$tracks", []] },
                as: "track",
                in: { $ifNull: ["$$track.duration_ms", "$$track.durationMs", 0] }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalTracks: { $sum: "$trackCount" },
          avgTracksPerPlaylist: { $avg: "$trackCount" }
        }
      }
    ]);
    
    const activeCreators = await Playlist.distinct('userId');
    const stats = statsAgg[0] || { totalTracks: 0, avgTracksPerPlaylist: 0 };
    
    res.json({
      total: totalPlaylists,
      empty: emptyPlaylists,
      filled: totalPlaylists - emptyPlaylists,
      totalTracks: stats.totalTracks,
      avgTracksPerPlaylist: stats.avgTracksPerPlaylist || 0,
      activeCreators: activeCreators.length
    });
  } catch (e) {
    console.error('Erreur stats:', e);
    res.status(500).json({ message: "Erreur stats playlists", error: e.message });
  }
});

// Playlists d'un utilisateur spécifique (pour admin)
router.get('/admin/user/:userId', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const playlists = await Playlist.find({ userId })
      .sort({ updatedAt: -1 })
      .select('name tracks createdAt updatedAt');
    
    const user = await User.findById(userId).select('username email createdAt');
    
    res.json({
      success: true,
      playlists,
      user,
      total: playlists.length
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Erreur récupération playlists utilisateur',
      error: e.message
    });
  }
});

// Supprimer une playlist (admin)
router.delete('/admin/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Playlist.findByIdAndDelete(id);
    res.json({ success: true, message: 'Playlist supprimée' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur suppression', error: e.message });
  }
});

// Modifier une playlist (admin)
router.patch('/admin/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Nom requis' });
    }
    
    const playlist = await Playlist.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true }
    );
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist introuvable' });
    }
    
    res.json({ success: true, playlist });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur modification', error: e.message });
  }
});

// NOUVEAU - Récupérer les tracks d'une playlist pour admin
router.get('/admin/:playlistId/tracks', verifyAdmin, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.playlistId).lean();
    if (!playlist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Playlist introuvable' 
      });
    }

    // ✅ Récupérer les infos utilisateur
    const User = require('../models/User');
    const user = await User.findById(playlist.userId).select('username email').lean();

    // ✅ STRUCTURE ENRICHIE pour le frontend
    res.json({
      success: true,
      playlist: {
        _id: playlist._id,
        name: playlist.name,
        username: user?.username || 'Utilisateur supprimé',
        userEmail: user?.email || null,
        tracks: playlist.tracks || [],
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        coverIndex: playlist.coverIndex ?? 0,
        trackCount: (playlist.tracks || []).length,
        totalDuration: (playlist.tracks || []).reduce((sum, t) => 
          sum + (t.duration_ms || t.durationMs || 0), 0
        )
      }
    });
  } catch (e) {
    console.error('Erreur GET /admin/:playlistId/tracks:', e);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur', 
      error: e.message 
    });
  }
});

// NOUVEAU - Récupérer toutes les playlists d'un utilisateur pour admin
router.get('/admin/user/:userId', verifyAdmin, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }
    
    const playlists = await Playlist.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .select('name tracks createdAt flagReason');
    
    res.json({ 
      success: true,
      playlists: playlists,
      username: user.username,
      totalPlaylists: playlists.length
    });
  } catch (e) {
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des playlists utilisateur", 
      error: e.message 
    });
  }
});

// NOUVEAU - Analytics des playlists pour admin
router.get('/admin/stats', verifyAdmin, async (req, res) => {
  try {
    const totalPlaylists = await Playlist.countDocuments();
    const emptyPlaylists = await Playlist.countDocuments({
      $or: [
        { tracks: { $exists: false } },
        { tracks: { $size: 0 } }
      ]
    });
    
    const statsAgg = await Playlist.aggregate([
      {
        $project: {
          trackCount: { $size: { $ifNull: ["$tracks", []] } },
          totalDuration: {
            $sum: {
              $map: {
                input: { $ifNull: ["$tracks", []] },
                as: "track",
                in: { $ifNull: ["$$track.duration_ms", "$$track.durationMs", 0] }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalTracks: { $sum: "$trackCount" },
          avgTracksPerPlaylist: { $avg: "$trackCount" }
        }
      }
    ]);
    
    const activeCreators = await Playlist.distinct('userId');
    const stats = statsAgg[0] || { totalTracks: 0, avgTracksPerPlaylist: 0 };
    
    res.json({
      total: totalPlaylists,
      empty: emptyPlaylists,
      filled: totalPlaylists - emptyPlaylists,
      totalTracks: stats.totalTracks,
      avgTracksPerPlaylist: stats.avgTracksPerPlaylist || 0,
      activeCreators: activeCreators.length
    });
  } catch (e) {
    console.error('Erreur stats:', e);
    res.status(500).json({ message: "Erreur stats playlists", error: e.message });
  }
});

// Playlists d'un utilisateur spécifique (pour admin)
router.get('/admin/user/:userId', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const playlists = await Playlist.find({ userId })
      .sort({ updatedAt: -1 })
      .select('name tracks createdAt updatedAt');
    
    const user = await User.findById(userId).select('username email createdAt');
    
    res.json({
      success: true,
      playlists,
      user,
      total: playlists.length
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Erreur récupération playlists utilisateur',
      error: e.message
    });
  }
});

// Supprimer une playlist (admin)
router.delete('/admin/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Playlist.findByIdAndDelete(id);
    res.json({ success: true, message: 'Playlist supprimée' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur suppression', error: e.message });
  }
});

// Modifier une playlist (admin)
router.patch('/admin/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Nom requis' });
    }
    
    const playlist = await Playlist.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true }
    );
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist introuvable' });
    }
    
    res.json({ success: true, playlist });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur modification', error: e.message });
  }
});

// NOUVEAU - Récupérer les tracks d'une playlist pour admin
router.get('/admin/:playlistId/tracks', verifyAdmin, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.playlistId).lean();
    if (!playlist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Playlist introuvable' 
      });
    }

    // ✅ Récupérer les infos utilisateur
    const User = require('../models/User');
    const user = await User.findById(playlist.userId).select('username email').lean();

    // ✅ STRUCTURE ENRICHIE pour le frontend
    res.json({
      success: true,
      playlist: {
        _id: playlist._id,
        name: playlist.name,
        username: user?.username || 'Utilisateur supprimé',
        userEmail: user?.email || null,
        tracks: playlist.tracks || [],
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        coverIndex: playlist.coverIndex ?? 0,
        trackCount: (playlist.tracks || []).length,
        totalDuration: (playlist.tracks || []).reduce((sum, t) => 
          sum + (t.duration_ms || t.durationMs || 0), 0
        )
      }
    });
  } catch (e) {
    console.error('Erreur GET /admin/:playlistId/tracks:', e);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur', 
      error: e.message 
    });
  }
});

// NOUVEAU - Récupérer toutes les playlists d'un utilisateur pour admin
router.get('/admin/user/:userId', verifyAdmin, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }
    
    const playlists = await Playlist.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .select('name tracks createdAt flagReason');
    
    res.json({ 
      success: true,
      playlists: playlists,
      username: user.username,
      totalPlaylists: playlists.length
    });
  } catch (e) {
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des playlists utilisateur", 
      error: e.message 
    });
  }
});

// NOUVEAU - Analytics des playlists pour admin
router.get('/admin/stats', verifyAdmin, async (req, res) => {
  try {
    const totalPlaylists = await Playlist.countDocuments();
    const emptyPlaylists = await Playlist.countDocuments({
      $or: [
        { tracks: { $exists: false } },
        { tracks: { $size: 0 } }
      ]
    });
    
    const statsAgg = await Playlist.aggregate([
      {
        $project: {
          trackCount: { $size: { $ifNull: ["$tracks", []] } },
          totalDuration: {
            $sum: {
              $map: {
                input: { $ifNull: ["$tracks", []] },
                as: "track",
                in: { $ifNull: ["$$track.duration_ms", "$$track.durationMs", 0] }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalTracks: { $sum: "$trackCount" },
          avgTracksPerPlaylist: { $avg: "$trackCount" }
        }
      }
    ]);
    
    const activeCreators = await Playlist.distinct('userId');
    const stats = statsAgg[0] || { totalTracks: 0, avgTracksPerPlaylist: 0 };
    
    res.json({
      total: totalPlaylists,
      empty: emptyPlaylists,
      filled: totalPlaylists - emptyPlaylists,
      totalTracks: stats.totalTracks,
      avgTracksPerPlaylist: stats.avgTracksPerPlaylist || 0,
      activeCreators: activeCreators.length
    });
  } catch (e) {
    console.error('Erreur stats:', e);
    res.status(500).json({ message: "Erreur stats playlists", error: e.message });
  }
});

// Top playlists (par nombre de morceaux et récence)
router.get('/admin/top-playlists', verifyAdmin, async (req, res) => {
  try {
    const topPlaylists = await Playlist.aggregate([
      { $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }},
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $addFields: {
        trackCount: { $size: { $ifNull: ['$tracks', []] } },
        username: '$user.username'
      }},
      { $sort: { trackCount: -1, updatedAt: -1 } },
      { $limit: 20 },
      { $project: {
        name: 1,
        tracks: 1,
        trackCount: 1,
        username: 1,
        createdAt: 1,
        updatedAt: 1
      }}
    ]);
    
    res.json({ data: topPlaylists });
  } catch (e) {
    res.status(500).json({ message: 'Erreur top playlists', error: e.message });
  }
});

// Playlists récentes (7 derniers jours)
router.get('/admin/recent', verifyAdmin, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const recentPlaylists = await Playlist.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }},
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $addFields: {
        username: '$user.username'
      }},
      { $sort: { createdAt: -1 } },
      { $limit: 20 },
      { $project: {
        name: 1,
        tracks: 1,
        username: 1,
        createdAt: 1
      }}
    ]);
    
    res.json({ data: recentPlaylists });
  } catch (e) {
    res.status(500).json({ message: 'Erreur playlists récentes', error: e.message });
  }
});

// Top créateurs (utilisateurs avec le plus de playlists)
router.get('/admin/top-creators', verifyAdmin, async (req, res) => {
  try {
    const topCreators = await Playlist.aggregate([
      { $group: {
        _id: '$userId',
        playlistCount: { $sum: 1 },
        totalTracks: { $sum: { $size: { $ifNull: ['$tracks', []] } } },
        lastActivity: { $max: '$updatedAt' }
      }},
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }},
      { $unwind: '$user' },
      { $project: {
        _id: '$user._id',
        username: '$user.username',
        email: '$user.email',
        role: '$user.role',
        createdAt: '$user.createdAt',
        playlistCount: 1,
        totalTracks: 1,
        lastActivity: 1
      }},
      { $sort: { playlistCount: -1, totalTracks: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({ data: topCreators });
  } catch (e) {
    res.status(500).json({ message: 'Erreur top créateurs', error: e.message });
  }
});

// Stats améliorées
router.get('/admin/stats', verifyAdmin, async (req, res) => {
  try {
    const [totalPlaylists, totalTracks, avgTracks, activeCreators] = await Promise.all([
      Playlist.countDocuments(),
      Playlist.aggregate([
        { $project: { trackCount: { $size: { $ifNull: ['$tracks', []] } } } },
        { $group: { _id: null, total: { $sum: '$trackCount' } } }
      ]),
      Playlist.aggregate([
        { $project: { trackCount: { $size: { $ifNull: ['$tracks', []] } } } },
        { $group: { _id: null, avg: { $avg: '$trackCount' } } }
      ]),
      Playlist.distinct('userId').then(ids => ids.length)
    ]);
    
    res.json({
      total: totalPlaylists,
      totalTracks: totalTracks[0]?.total || 0,
      avgTracksPerPlaylist: avgTracks[0]?.avg || 0,
      activeCreators
    });
  } catch (e) {
    res.status(500).json({ message: 'Erreur stats playlists', error: e.message });
  }
});

// Playlists d'un utilisateur spécifique (pour admin)
router.get('/admin/user/:userId', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const playlists = await Playlist.find({ userId })
      .sort({ updatedAt: -1 })
      .select('name tracks createdAt updatedAt');
    
    const user = await User.findById(userId).select('username email createdAt');
    
    res.json({
      success: true,
      playlists,
      user,
      total: playlists.length
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Erreur récupération playlists utilisateur',
      error: e.message
    });
  }
});

// Supprimer une playlist (admin)
router.delete('/admin/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Playlist.findByIdAndDelete(id);
    res.json({ success: true, message: 'Playlist supprimée' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur suppression', error: e.message });
  }
});

// Modifier une playlist (admin)
router.patch('/admin/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Nom requis' });
    }
    
    const playlist = await Playlist.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true }
    );
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist introuvable' });
    }
    
    res.json({ success: true, playlist });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur modification', error: e.message });
  }
});

// NOUVEAU - Récupérer les tracks d'une playlist pour admin
router.get('/admin/:playlistId/tracks', verifyAdmin, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.playlistId).lean();
    if (!playlist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Playlist introuvable' 
      });
    }

    // ✅ Récupérer les infos utilisateur
    const User = require('../models/User');
    const user = await User.findById(playlist.userId).select('username email').lean();

    // ✅ STRUCTURE ENRICHIE pour le frontend
    res.json({
      success: true,
      playlist: {
        _id: playlist._id,
        name: playlist.name,
        username: user?.username || 'Utilisateur supprimé',
        userEmail: user?.email || null,
        tracks: playlist.tracks || [],
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        coverIndex: playlist.coverIndex ?? 0,
        trackCount: (playlist.tracks || []).length,
        totalDuration: (playlist.tracks || []).reduce((sum, t) => 
          sum + (t.duration_ms || t.durationMs || 0), 0
        )
      }
    });
  } catch (e) {
    console.error('Erreur GET /admin/:playlistId/tracks:', e);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur', 
      error: e.message 
    });
  }
});

// NOUVEAU - Récupérer toutes les playlists d'un utilisateur pour admin
router.get('/admin/user/:userId', verifyAdmin, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }
    
    const playlists = await Playlist.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .select('name tracks createdAt flagReason');
    
    res.json({ 
      success: true,
      playlists: playlists,
      username: user.username,
      totalPlaylists: playlists.length
    });
  } catch (e) {
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des playlists utilisateur", 
      error: e.message 
    });
  }
});

// NOUVEAU - Analytics des playlists pour admin
router.get('/admin/stats', verifyAdmin, async (req, res) => {
  try {
    const totalPlaylists = await Playlist.countDocuments();
    const emptyPlaylists = await Playlist.countDocuments({
      $or: [
        { tracks: { $exists: false } },
        { tracks: { $size: 0 } }
      ]
    });
    
    const statsAgg = await Playlist.aggregate([
      {
        $project: {
          trackCount: { $size: { $ifNull: ["$tracks", []] } },
          totalDuration: {
            $sum: {
              $map: {
                input: { $ifNull: ["$tracks", []] },
                as: "track",
                in: { $ifNull: ["$$track.duration_ms", "$$track.durationMs", 0] }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalTracks: { $sum: "$trackCount" },
          avgTracksPerPlaylist: { $avg: "$trackCount" }
        }
      }
    ]);
    
    const activeCreators = await Playlist.distinct('userId');
    const stats = statsAgg[0] || { totalTracks: 0, avgTracksPerPlaylist: 0 };
    
    res.json({
      total: totalPlaylists,
      empty: emptyPlaylists,
      filled: totalPlaylists - emptyPlaylists,
      totalTracks: stats.totalTracks,
      avgTracksPerPlaylist: stats.avgTracksPerPlaylist || 0,
      activeCreators: activeCreators.length
    });
  } catch (e) {
    console.error('Erreur stats:', e);
    res.status(500).json({ message: "Erreur stats playlists", error: e.message });
  }
});

// ✅ TOP PLAYLISTS - AVEC USERNAME ET DURÉE
router.get('/admin/top', verifyAdmin, async (req, res) => {
  try {
    const topPlaylists = await Playlist.aggregate([
      {
        $addFields: {
          trackCount: { $size: { $ifNull: ["$tracks", []] } }
        }
      },
      { $sort: { trackCount: -1, updatedAt: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $addFields: {
          username: { $arrayElemAt: ['$userInfo.username', 0] }
        }
      },
      {
        $project: {
          name: 1,
          tracks: 1,
          username: 1,
          createdAt: 1,
          updatedAt: 1,
          trackCount: 1
        }
      }
    ]);
    
    res.json({ data: topPlaylists });
  } catch (e) {
    console.error('Erreur top playlists:', e);
    res.status(500).json({ message: "Erreur", error: e.message });
  }
});

// ✅ ACTIVITÉ RÉCENTE - AVEC USERNAME ET DURÉE
router.get('/admin/recent-activity', verifyAdmin, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const recentPlaylists = await Playlist.aggregate([
      { $match: { updatedAt: { $gte: sevenDaysAgo } } },
      { $sort: { updatedAt: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $addFields: {
          username: { $arrayElemAt: ['$userInfo.username', 0] },
          trackCount: { $size: { $ifNull: ['$tracks', []] } }
        }
      },
      {
        $project: {
          name: 1,
          tracks: 1,
          username: 1,
          createdAt: 1,
          updatedAt: 1,
          trackCount: 1
        }
      }
    ]);
    
    res.json(recentPlaylists);
  } catch (e) {
    console.error('Erreur activité récente:', e);
    res.status(500).json({ message: "Erreur activité récente", error: e.message });
  }
});

// ✅ MORCEAUX POPULAIRES - LIMITÉ À 5 AVEC TOUTES LES DONNÉES
router.get('/admin/popular-tracks', verifyAdmin, async (req, res) => {
  try {
    const popularTracks = await Playlist.aggregate([
      { $unwind: '$tracks' },
      {
        $group: {
          _id: '$tracks.trackId',
          trackName: { $first: { $ifNull: ['$tracks.trackName', '$tracks.name'] } },
          name: { $first: { $ifNull: ['$tracks.name', '$tracks.trackName'] } },
          // Gestion robuste de artistName
          artistName: { 
            $first: { 
              $cond: {
                if: { $isArray: '$tracks.artists' },
                then: {
                  $reduce: {
                    input: '$tracks.artists',
                    initialValue: '',
                    in: {
                      $concat: [
                        '$$value',
                        { $cond: [{ $eq: ['$$value', ''] }, '', ', '] },
                        { $ifNull: ['$$this.name', { $toString: '$$this' }] }
                      ]
                    }
                  }
                },
                else: { $ifNull: ['$tracks.artistName', 'Artiste inconnu'] }
              }
            }
          },
          artists: { $first: '$tracks.artists' },
          albumImage: { 
            $first: { 
              $ifNull: [
                '$tracks.albumImage',
                { $arrayElemAt: ['$tracks.album.images.url', 0] }
              ]
            }
          },
          albumImages: { $first: '$tracks.album.images' },
          previewUrl: { $first: '$tracks.previewUrl' },
          spotifyUrl: { $first: '$tracks.spotifyUrl' },
          duration_ms: { $first: { $ifNull: ['$tracks.duration_ms', '$tracks.durationMs', 0] } },
          album: { $first: '$tracks.album' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }, // ✅ LIMITÉ À 5
      {
        $project: {
          trackId: '$_id',
          trackName: { $ifNull: ['$trackName', '$name', 'Titre inconnu'] },
          name: { $ifNull: ['$name', '$trackName', 'Titre inconnu'] },
          artistName: { $ifNull: ['$artistName', 'Artiste inconnu'] },
          albumImage: {
            $cond: {
              if: { $ne: ['$albumImage', null] },
              then: '$albumImage',
              else: {
                $cond: {
                  if: { $gt: [{ $size: { $ifNull: ['$albumImages', []] } }, 0] },
                  then: { $arrayElemAt: ['$albumImages.url', 0] },
                  else: '/thumbnail-placeholder.jpg'
                }
              }
            }
          },
          previewUrl: 1,
          spotifyUrl: 1,
          duration_ms: { $ifNull: ['$duration_ms', 0] },
          album: { $ifNull: ['$album', { name: 'Album inconnu' }] },
          count: 1,
          _id: 0
        }
      }
    ]);

    res.json(popularTracks);
  } catch (e) {
    console.error('Erreur morceaux populaires:', e);
    res.status(500).json({ message: "Erreur morceaux populaires", error: e.message });
  }
});

// Croissance des playlists (7 derniers jours)
router.get('/admin/growth', verifyAdmin, async (req, res) => {
  try {
    const today = new Date();
    const growth = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await Playlist.countDocuments({
        createdAt: {
          $gte: date,
          $lt: nextDate
        }
      });

      growth.push({
        date: date.toISOString(),
        label: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        count
      });
    }

    res.json(growth);
  } catch (e) {
    console.error('Erreur growth:', e);
    res.status(500).json({ message: 'Erreur growth', error: e.message });
  }
});

// NOUVEAU - Playlists contenant un track spécifique
router.get('/admin/track/:trackId', verifyAdmin, async (req, res) => {
  try {
    const { trackId } = req.params;
    
    const playlists = await Playlist.find({
      'tracks.trackId': trackId
    }).lean();
    
    // Enrichir avec les usernames
    const enriched = await Promise.all(playlists.map(async (pl) => {
      const user = await User.findById(pl.userId).select('username');
      return {
        ...pl,
        username: user?.username || 'Anonyme'
      };
    }));
    
    res.json({ 
      success: true, 
      playlists: enriched 
    });
  } catch (e) {
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la recherche des playlists', 
      error: e.message 
    });
  }
});

// Top créateurs
router.get('/admin/by-creator', verifyAdmin, async (req, res) => {
  try {
    const topCreators = await Playlist.aggregate([
      {
        $group: {
          _id: '$userId',
          playlistCount: { $sum: 1 },
          totalTracks: { $sum: { $size: { $ifNull: ["$tracks", []] } } },
          lastActivity: { $max: '$updatedAt' }
        }
      },
      { $sort: { playlistCount: -1, totalTracks: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $addFields: {
          username: { $arrayElemAt: ['$userInfo.username', 0] },
          role: { $arrayElemAt: ['$userInfo.role', 0] },
          createdAt: { $arrayElemAt: ['$userInfo.createdAt', 0] }
        }
      },
      {
        $project: {
          username: 1,
          role: 1,
          createdAt: 1,
          playlistCount: 1,
          totalTracks: 1,
          lastActivity: 1
        }
      }
    ]);
    
    res.json(topCreators);
  } catch (e) {
    console.error('Erreur top créateurs:', e);
    res.status(500).json({ message: "Erreur top créateurs", error: e.message });
  }
});

// Playlists vides
router.get('/admin/empty', verifyAdmin, async (req, res) => {
  try {
    const emptyPlaylists = await Playlist.aggregate([
      { 
        $match: { 
          $or: [
            { tracks: { $exists: false } },
            { tracks: { $size: 0 } }
          ]
        }
      },
      { $limit: 50 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $addFields: {
          username: { $arrayElemAt: ['$userInfo.username', 0] }
        }
      },
      {
        $project: {
          name: 1,
          tracks: 1,
          username: 1,
          createdAt: 1
        }
      }
    ]);
    
    res.json(emptyPlaylists);
  } catch (e) {
    console.error('Erreur playlists vides:', e);
    res.status(500).json({ message: "Erreur playlists vides", error: e.message });
  }
});

// Croissance
router.get('/admin/growth', verifyAdmin, async (req, res) => {
  try {
    const today = new Date();
    const growth = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await Playlist.countDocuments({
        createdAt: {
          $gte: date,
          $lt: nextDate
        }
      });

      growth.push({
        date: date.toISOString(),
        label: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        count
      });
    }

    res.json(growth);
  } catch (e) {
    console.error('Erreur growth:', e);
    res.status(500).json({ message: "Erreur growth", error: e.message });
  }
});

// NOUVEAU - Transférer une playlist à un autre utilisateur (admin)
router.patch('/admin/:id/transfer', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newUsername } = req.body;
    
    if (!newUsername || !newUsername.trim()) {
      return res.status(400).json({ message: 'Nom d\'utilisateur requis' });
    }
    
    const User = require('../models/User');
    const newOwner = await User.findOne({ username: newUsername.trim() });
    
    if (!newOwner) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }
    
    const playlist = await Playlist.findByIdAndUpdate(
      id,
      { 
        userId: newOwner._id,
        username: newOwner.username,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist introuvable' });
    }
    
    res.json({ success: true, playlist, newOwner: newOwner.username });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur transfert', error: e.message });
  }
});

// NOUVEAU - Dupliquer une playlist (admin)
router.post('/admin/duplicate', verifyAdmin, async (req, res) => {
  try {
    const { originalId, newName } = req.body;
    
    if (!originalId || !newName || !newName.trim()) {
      return res.status(400).json({ message: 'ID original et nouveau nom requis' });
    }
    
    const original = await Playlist.findById(originalId);
    if (!original) {
      return res.status(404).json({ message: 'Playlist originale introuvable' });
    }
    
    // Créer la copie avec l'admin comme propriétaire
    const duplicate = new Playlist({
      name: newName.trim(),
      tracks: [...original.tracks],
      userId: req.user.id, // Admin devient propriétaire
      username: req.user.username,
      coverIndex: original.coverIndex || 0
    });
    
    await duplicate.save();
    
    res.status(201).json({ success: true, playlist: duplicate, original: original.name });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ message: 'Une playlist avec ce nom existe déjà' });
    }
    res.status(500).json({ success: false, message: 'Erreur duplication', error: e.message });
  }
});

// NOUVEAU - Suppression en lot (admin)
router.delete('/admin/bulk', verifyAdmin, async (req, res) => {
  try {
    const { playlistIds } = req.body;
    
    if (!Array.isArray(playlistIds) || playlistIds.length === 0) {
      return res.status(400).json({ message: 'IDs de playlists requis' });
    }
    
    const result = await Playlist.deleteMany({ _id: { $in: playlistIds } });
    
    res.json({ 
      success: true, 
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} playlists supprimées`
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur suppression bulk', error: e.message });
  }
});

// NOUVEAU - Nettoyer les playlists vides (admin)
router.delete('/admin/cleanup-empty', verifyAdmin, async (req, res) => {
  try {
    // Supprimer les playlists sans morceaux ou avec un tableau vide
    const result = await Playlist.deleteMany({
      $or: [
        { tracks: { $exists: false } },
        { tracks: { $size: 0 } }
      ]
    });
    
    res.json({ 
      success: true, 
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} playlists vides supprimées`
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur nettoyage', error: e.message });
  }
});

// NOUVEAU - Améliorer les stats avec plus de détails
router.get('/admin/stats-detailed', verifyAdmin, async (req, res) => {
  try {
    const totalPlaylists = await Playlist.countDocuments();
    
    const statsAgg = await Playlist.aggregate([
      {
        $group: {
          _id: null,
          totalTracks: { $sum: { $size: { $ifNull: ["$tracks", []] } } },
          avgTracksPerPlaylist: { $avg: { $size: { $ifNull: ["$tracks", []] } } },
          emptyPlaylists: {
            $sum: {
              $cond: [
                { $or: [
                  { $eq: [{ $size: { $ifNull: ["$tracks", []] } }, 0] },
                  { $not: { $ifNull: ["$tracks", false] } }
                ]},
                1,
                0
              ]
            }
          },
          richPlaylists: {
            $sum: {
              $cond: [
                { $gte: [{ $size: { $ifNull: ["$tracks", []] } }, 20] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    const activeCreators = await Playlist.distinct('userId').length;
    
    // Calcul des playlists créées par période
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const [weeklyCount, monthlyCount] = await Promise.all([
      Playlist.countDocuments({ createdAt: { $gte: lastWeek } }),
      Playlist.countDocuments({ createdAt: { $gte: lastMonth } })
    ]);
    
    const stats = statsAgg[0] || { 
      totalTracks: 0, 
      avgTracksPerPlaylist: 0,
      emptyPlaylists: 0,
      richPlaylists: 0
    };
    
    res.json({
      total: totalPlaylists,
      totalTracks: stats.totalTracks,
      avgTracksPerPlaylist: stats.avgTracksPerPlaylist || 0,
      activeCreators: activeCreators,
      emptyPlaylists: stats.emptyPlaylists,
      richPlaylists: stats.richPlaylists,
      weeklyGrowth: weeklyCount,
      monthlyGrowth: monthlyCount,
      estimatedDuration: Math.round(stats.totalTracks * 3.5) // 3.5 min moyenne par track
    });
  } catch (e) {
    res.status(500).json({ message: "Erreur stats détaillées", error: e.message });
  }
});

// ALIAS ROUTES pour compatibilité frontend AdminPlaylistManager
router.get('/admin/top', verifyAdmin, async (req, res) => {
  // Alias vers /admin/top-playlists
  try {
    const User = require('../models/User');
    
    const topPlaylists = await Playlist.aggregate([
      { $addFields: { trackCount: { $size: { $ifNull: ["$tracks", []] } } } },
      { $sort: { trackCount: -1, updatedAt: -1 } },
      { $limit: 10 },
      { $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'userInfo'
      }},
      { $addFields: {
        username: { $arrayElemAt: ['$userInfo.username', 0] }
      }},
      { $project: {
        name: 1,
        tracks: 1,
        username: 1,
        createdAt: 1,
        updatedAt: 1,
        trackCount: 1
      }}
    ]);
    
    res.json({ data: topPlaylists });
  } catch (e) {
    res.status(500).json({ message: "Erreur", error: e.message });
  }
});

router.get('/admin/empty', verifyAdmin, async (req, res) => {
  try {
    const User = require('../models/User');
    const emptyPlaylists = await Playlist.aggregate([
      { $match: { 
        $or: [
          { tracks: { $exists: false } },
          { tracks: { $size: 0 } }
        ]
      }},
      { $limit: 50 },
      { $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'userInfo'
      }},
      { $addFields: {
        username: { $arrayElemAt: ['$userInfo.username', 0] }
      }},
      { $project: {
        name: 1,
        tracks: 1,
        username: 1,
        createdAt: 1
      }}
    ]);
    res.json(emptyPlaylists);
  } catch (e) {
    res.status(500).json({ message: "Erreur playlists vides", error: e.message });
  }
});

router.get('/admin/by-creator', verifyAdmin, async (req, res) => {
  // Alias vers /admin/top-creators
  try {
    const topCreators = await Playlist.aggregate([
      { $group: {
        _id: '$userId',
        playlistCount: { $sum: 1 },
        totalTracks: { $sum: { $size: { $ifNull: ["$tracks", []] } } },
        lastActivity: { $max: '$updatedAt' }
      }},
      { $sort: { playlistCount: -1, totalTracks: -1 } },
      { $limit: 10 },
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }},
      { $addFields: {
        username: { $arrayElemAt: ['$userInfo.username', 0] },
        role: { $arrayElemAt: ['$userInfo.role', 0] },
        createdAt: { $arrayElemAt: ['$userInfo.createdAt', 0] }
      }},
      { $project: {
        username: 1,
        role: 1,
        createdAt: 1,
        playlistCount: 1,
        totalTracks: 1,
        lastActivity: 1
      }}
    ]);
    res.json(topCreators);
  } catch (e) {
    res.status(500).json({ message: "Erreur top créateurs", error: e.message });
  }
});

router.get('/admin/recent-activity', verifyAdmin, async (req, res) => {
  // Alias vers /admin/recent avec enrichissement
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentPlaylists = await Playlist.aggregate([
      { $match: { updatedAt: { $gte: sevenDaysAgo } } },
      { $sort: { updatedAt: -1 } },
      { $limit: 5 },
      { $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'userInfo'
      }},
      { $addFields: {
        username: { $arrayElemAt: ['$userInfo.username', 0] },
        trackCount: { $size: { $ifNull: ['$tracks', []] } }
      }},
      { $project: {
        name: 1,
        tracks: 1,
        username: 1,
        createdAt: 1,
        updatedAt: 1,
        trackCount: 1
      }}
    ]);
    
    res.json(recentPlaylists);
  } catch (e) {
    res.status(500).json({ message: "Erreur activité récente", error: e.message });
  }
});

// Morceaux populaires dans les playlists
router.get('/admin/popular-tracks', verifyAdmin, async (req, res) => {
  try {
    const popularTracks = await Playlist.aggregate([
      { $unwind: '$tracks' },
      {
        $group: {
          _id: '$tracks.trackId',
          trackName: { $first: '$tracks.trackName' },
          name: { $first: { $ifNull: ['$tracks.name', '$tracks.trackName'] } },
          artistName: { 
            $first: { 
              $cond: {
                if: { $isArray: '$tracks.artists' },
                then: { $arrayElemAt: ['$tracks.artists', 0] },
                else: '$tracks.artistName'
              }
            }
          },
          artists: { $first: '$tracks.artists' },
          albumImage: { $first: '$tracks.albumImage' },
          albumImages: { $first: '$tracks.album.images' },
          previewUrl: { $first: '$tracks.previewUrl' },
          spotifyUrl: { $first: '$tracks.spotifyUrl' },
          duration_ms: { $first: { $ifNull: ['$tracks.duration_ms', '$tracks.durationMs', 0] } },
          album: { $first: '$tracks.album' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }, // ✅ CORRECTION : Limité à 5 au lieu de 10
      {
        $project: {
          trackId: '$_id',
          trackName: { $ifNull: ['$trackName', '$name'] },
          name: { $ifNull: ['$name', '$trackName'] },
          artistName: {
            $cond: {
              if: { $isArray: '$artists' },
              then: { 
                $reduce: {
                  input: '$artists',
                  initialValue: '',
                  in: { 
                    $concat: [
                      '$$value',
                      { $cond: [{ $eq: ['$$value', ''] }, '', ', '] },
                      { $ifNull: ['$$this.name', { $toString: '$$this' }] }
                    ]
                  }
                }
              },
              else: { $ifNull: ['$artistName', 'Artiste inconnu'] }
            }
          },
          albumImage: {
            $ifNull: [
              '$albumImage',
              { $arrayElemAt: ['$albumImages.url', 0] },
              '/thumbnail-placeholder.jpg'
            ]
          },
          previewUrl: '$previewUrl',
          spotifyUrl: '$spotifyUrl',
          duration_ms: { $ifNull: ['$duration_ms', 0] },
          album: { $ifNull: ['$album', { name: 'Album inconnu' }] },
          count: 1,
          _id: 0
        }
      }
    ]);

    res.json(popularTracks);
  } catch (e) {
    console.error('Erreur popular-tracks:', e);
    res.status(500).json({ message: "Erreur morceaux populaires", error: e.message });
  }
});

// Croissance des playlists (7 derniers jours)
router.get('/admin/growth', verifyAdmin, async (req, res) => {
  try {
    const today = new Date();
    const growth = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await Playlist.countDocuments({
        createdAt: {
          $gte: date,
          $lt: nextDate
        }
      });

      growth.push({
        date: date.toISOString(),
        label: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        count
      });
    }

    res.json(growth);
  } catch (e) {
    console.error('Erreur growth:', e);
    res.status(500).json({ message: 'Erreur growth', error: e.message });
  }
});

// NOUVEAU - Playlists contenant un track spécifique
router.get('/admin/track/:trackId', verifyAdmin, async (req, res) => {
  try {
    const { trackId } = req.params;
    
    const playlists = await Playlist.find({
      'tracks.trackId': trackId
    }).lean();
    
    // Enrichir avec les usernames
    const enriched = await Promise.all(playlists.map(async (pl) => {
      const user = await User.findById(pl.userId).select('username');
      return {
        ...pl,
        username: user?.username || 'Anonyme'
      };
    }));
    
    res.json({ 
      success: true, 
      playlists: enriched 
    });
  } catch (e) {
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la recherche des playlists', 
      error: e.message 
    });
  }
});

module.exports = router;