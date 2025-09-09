const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const User = require("../models/User");
const Cocktail = require("../models/Cocktail");

// Ajouter aux favoris
router.post("/add/:cocktailId", verifyToken, async (req, res) => {
    try {
        const { cocktailId } = req.params;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user.favorites) user.favorites = [];
        
        if (!user.favorites.includes(cocktailId)) {
            user.favorites.push(cocktailId);
            await user.save();
        }

        res.json({ message: "Ajouté aux favoris" });
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Retirer des favoris
router.delete("/remove/:cocktailId", verifyToken, async (req, res) => {
    try {
        const { cocktailId } = req.params;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (user.favorites) {
            user.favorites = user.favorites.filter(id => id.toString() !== cocktailId);
            await user.save();
        }

        res.json({ message: "Retiré des favoris" });
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Vérifier si favori
router.get("/check/:cocktailId", verifyToken, async (req, res) => {
    try {
        const { cocktailId } = req.params;
        const userId = req.user.id;

        const user = await User.findById(userId);
        const isFavorite = user.favorites && user.favorites.includes(cocktailId);

        res.json({ isFavorite });
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Obtenir tous les favoris
router.get("/", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).populate("favorites");
        
        res.json(user.favorites || []);
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur" });
    }
});

module.exports = router;
