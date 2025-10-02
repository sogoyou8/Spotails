const express = require("express");
const router = express.Router();
const verifyAuth = require("../middleware/verifyAuth");
const verifyAdmin = require('../middleware/verifyAdmin');
const userController = require("../controllers/userController");
const User = require("../models/User");

router.put("/update-password", verifyAuth, userController.updatePassword);

router.put("/update-email", verifyAuth, userController.updateEmail);

router.put("/update-username", verifyAuth, userController.updateUsername);

router.delete("/delete-account", verifyAuth, userController.deleteAccount);

router.get("/me", verifyAuth, userController.retrieveAccount);

router.get("/", verifyAuth, verifyAdmin, async (req, res) => {
    const users = await User.find();
    res.json(users);
});

router.delete("/:id", verifyAuth, verifyAdmin, async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Utilisateur supprimé" });
});

router.put("/:id/role", verifyAuth, verifyAdmin, userController.updateRole);

router.put("/:id/password", verifyAuth, verifyAdmin, userController.resetPassword);

// GET /api/admin/stats - Statistiques pour le dashboard
router.get('/admin/stats', verifyAdmin, async (req, res) => {
  try {
    const [
      totalCocktails,
      publishedCocktails,
      draftCocktails,
      totalUsers,
      adminUsers,
      regularUsers,
      favoritesAgg,
      totalPlaylists
    ] = await Promise.all([
      require('../models/Cocktail').countDocuments(),
      require('../models/Cocktail').countDocuments({ publish: true }),
      require('../models/Cocktail').countDocuments({ publish: false }),
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'user' }),
      // FIX: total de favoris cocktails (somme des tailles du tableau favorites)
      User.aggregate([
        { $project: { count: { $size: { $ifNull: ['$favorites', []] } } } },
        { $group: { _id: null, total: { $sum: '$count' } } }
      ]),
      require('../models/Playlist').countDocuments()
    ]);

    res.json({
      cocktails: { total: totalCocktails, published: publishedCocktails, draft: draftCocktails },
      users: { total: totalUsers, admins: adminUsers, users: regularUsers },
      favorites: { total: (favoritesAgg?.[0]?.total || 0) },
      playlists: { total: totalPlaylists }
    });
  } catch (error) {
    console.error('Erreur stats admin:', error);
    res.status(500).json({ message: 'Erreur lors du chargement des statistiques' });
  }
});

// Stats détaillées favoris pour admin
router.get('/admin/favorites-stats', verifyAdmin, async (req, res) => {
  try {
    const [totalFavs, activeUsers, avgFavsPerUser] = await Promise.all([
      User.aggregate([
        { $project: { count: { $size: { $ifNull: ['$favorites', []] } } } },
        { $group: { _id: null, total: { $sum: '$count' } } }
      ]),
      User.countDocuments({ favorites: { $exists: true, $not: { $size: 0 } } }),
      User.aggregate([
        { $match: { favorites: { $exists: true, $not: { $size: 0 } } } },
        { $project: { count: { $size: '$favorites' } } },
        { $group: { _id: null, avg: { $avg: '$count' } } }
      ])
    ]);
    
    res.json({
      totalFavorites: totalFavs[0]?.total || 0,
      activeUsersWithFavorites: activeUsers,
      avgFavoritesPerUser: Math.round(avgFavsPerUser[0]?.avg || 0)
    });
  } catch (e) {
    res.status(500).json({ message: "Erreur stats favoris", error: e.message });
  }
});

// Trouver des utilisateurs similaires pour recommandations croisées
router.get('/admin/similar-taste-users/:userId', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Obtenir les favoris de l'utilisateur cible
    const targetUser = await User.findById(userId).populate('favorites');
    if (!targetUser) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }
    
    const targetFavorites = targetUser.favorites.map(f => f._id.toString());
    
    // Trouver des utilisateurs avec des goûts similaires
    const similarUsers = await User.aggregate([
      { $match: { _id: { $ne: targetUser._id }, favorites: { $exists: true, $not: { $size: 0 } } } },
      { $addFields: {
        commonFavorites: {
          $size: {
            $setIntersection: ['$favorites', targetFavorites]
          }
        },
        totalFavorites: { $size: '$favorites' }
      }},
      { $match: { commonFavorites: { $gte: 1 } } },
      { $addFields: {
        similarityScore: { $divide: ['$commonFavorites', '$totalFavorites'] }
      }},
      { $sort: { similarityScore: -1, commonFavorites: -1 } },
      { $limit: 10 },
      { $project: {
        username: 1,
        email: 1,
        commonFavorites: 1,
        totalFavorites: 1,
        similarityScore: { $round: ['$similarityScore', 2] }
      }}
    ]);
    
    res.json({ 
      data: similarUsers,
      targetUser: {
        username: targetUser.username,
        totalFavorites: targetFavorites.length
      }
    });
  } catch (e) {
    res.status(500).json({ message: "Erreur utilisateurs similaires", error: e.message });
  }
});

// NOUVEAU - Engagement des utilisateurs
router.get('/admin/user-engagement', verifyAdmin, async (req, res) => {
  try {
    const users = await User.aggregate([
      { $match: { favorites: { $exists: true, $not: { $size: 0 } } } },
      { $project: {
        username: 1,
        email: 1,
        role: 1,
        createdAt: 1,
        favoritesCount: { $size: '$favorites' }
      }},
      { $sort: { favoritesCount: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({ data: users });
  } catch (e) {
    res.status(500).json({ 
      message: "Erreur engagement utilisateurs", 
      error: e.message 
    });
  }
});

// NOUVEAU - Récupérer les favoris d'un utilisateur spécifique (pour admin)
router.get('/admin/:userId/favorites', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).populate({
      path: 'favorites',
      select: 'name theme color thumbnail image createdAt',
      match: { publish: true }
    });
    
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }
    
    const validFavorites = user.favorites.filter(fav => fav !== null);
    
    res.json({ 
      success: true,
      favorites: validFavorites,
      total: validFavorites.length,
      username: user.username
    });
  } catch (e) {
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des favoris", 
      error: e.message 
    });
  }
});

module.exports = router;
