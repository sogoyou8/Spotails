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
      totalFavorites,
      totalPlaylists
    ] = await Promise.all([
      require('../models/Cocktail').countDocuments(),
      require('../models/Cocktail').countDocuments({ publish: true }),
      require('../models/Cocktail').countDocuments({ publish: false }),
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'user' }),
      require('../models/FavoriteTrack').countDocuments(),
      require('../models/Playlist').countDocuments()
    ]);

    res.json({
      cocktails: {
        total: totalCocktails,
        published: publishedCocktails,
        draft: draftCocktails
      },
      users: {
        total: totalUsers,
        admins: adminUsers,
        users: regularUsers
      },
      favorites: {
        total: totalFavorites
      },
      playlists: {
        total: totalPlaylists
      }
    });
  } catch (error) {
    console.error('Erreur stats admin:', error);
    res.status(500).json({ message: 'Erreur lors du chargement des statistiques' });
  }
});

module.exports = router;
