const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Pas de token" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (err) {
        res.status(401).json({ message: "Token invalide" });
    }
};

router.post("/add/:cocktailId", authMiddleware, async (req, res) => {
    const { cocktailId } = req.params;
    const user = await User.findById(req.userId);

    if (!user.favorites.includes(cocktailId)) {
        user.favorites.push(cocktailId);
        await user.save();
    }

    res.json({ message: "Ajouté aux favoris" });
});

router.delete("/remove/:cocktailId", authMiddleware, async (req, res) => {
    const { cocktailId } = req.params;
    const user = await User.findById(req.userId);

    user.favorites = user.favorites.filter(
        (fav) => fav.toString() !== cocktailId
    );
    await user.save();

    res.json({ message: "Retiré des favoris" });
});

router.get("/check/:cocktailId", authMiddleware, async (req, res) => {
    const { cocktailId } = req.params;
    const user = await User.findById(req.userId);

    const isFav = user.favorites.includes(cocktailId);
    res.json({ isFavorite: isFav });
});

router.get("/", authMiddleware, async (req, res) => {
    const user = await User.findById(req.userId).populate("favorites");
    res.json(user.favorites);
});


module.exports = router;
