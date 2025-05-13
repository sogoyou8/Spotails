const express = require("express");
const router = express.Router();
const Cocktail = require("../models/Cocktail");
const Ingredient = require("../models/Ingredient");
const verifyAdmin = require('../middleware/verifyAdmin');
const verifyToken = require('../middleware/verifyToken');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        const date = Date.now();
        const randomString = crypto.randomBytes(6).toString("hex");
        cb(null, date + randomString + path.extname(file.originalname).toLowerCase());
    },
});
const upload = multer({ storage });
const multipleUpload = upload.fields([
    { name: "image", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
]);

const deleteImage = (filename) => {
    const imagePath = path.join(__dirname, "../uploads", filename);
    if (fs.existsSync(imagePath)) {
        fs.unlink(imagePath, (err) => {
            if (err) console.error("Erreur suppression image :", err);
        });
    }
};

router.get("/", async (req, res) => {
    try {
        const cocktails = await Cocktail.find({ publish: true });
        res.json(cocktails);
    } catch (err) {
        res.status(500).json({ message: "Erreur lors de la récupération des cocktails.", error: err.message });
    }
});

router.get("/admin", verifyAdmin, async (req, res) => {
    try {
        const cocktails = await Cocktail.find();
        res.json(cocktails);
    } catch (err) {
        res.status(500).json({ message: "Erreur lors de la récupération des cocktails pour l'admin.", error: err.message });
    }
});

router.get("/:id", verifyToken, async (req, res) => {
    try {
        const cocktail = await Cocktail.findById(req.params.id).populate("ingredients");
        if (!cocktail) {
            console.log("cocktail introuvable")
            return res.status(404).json({ message: "Cocktail introuvable." });
        }
        if (!cocktail.publish && (!req.user || req.user.role !== "admin")) {
            console.log("cocktail non publie")
            return res.status(404).json({ message: "Cocktail introuvable." });
        }
        res.json(cocktail);
    } catch (err) {
        res.status(500).json({ message: "Erreur lors de la récupération du cocktail.", error: err.message });
    }
});

router.post("/", verifyAdmin, multipleUpload, async (req, res) => {
    try {
        const { name, ingredients, recipe, theme, description, color, textColor } = req.body;

        if (!name || !req.files["image"] || !req.files["thumbnail"] || !ingredients || !recipe || !theme || !description) {
            return res.status(400).json({ error: 'BAD_REQUEST', message: 'Tous les champs sont requis.' });
        }

        let ingredientsData;
        try {
            ingredientsData = JSON.parse(ingredients);
            if (ingredientsData.length === 0 || ingredientsData.some(item => !item.name || !item.quantity || !item.unit)) {
                return res.status(400).json({ message: 'Vous devez ajouter au moins un ingrédient complet.' });
            }
        } catch (e) {
            console.error("Erreur parsing ingrédients", e);
            return res.status(400).json({ message: 'Format ingrédients invalide.', error: e.message });
        }

        const newCocktail = new Cocktail({
            name,
            image: req.files["image"][0].filename,
            thumbnail: req.files["thumbnail"][0].filename,
            recipe,
            theme,
            description,
            color: color || "#13a444",
            textColor: textColor || "black",
            publish: false
        });
        await newCocktail.save();
        console.log("Cocktail créé :", newCocktail);

        newCocktail.ingredients = await Promise.all(
            ingredientsData.map(async (ingredient) => {
                const {name, quantity, unit} = ingredient;
                const ingredientDoc = new Ingredient({
                    name,
                    quantity,
                    unit,
                    cocktail: newCocktail._id
                });
                await ingredientDoc.save();
                return ingredientDoc._id;
            })
        );
        await newCocktail.save();
        return res.status(201).json({ message: 'Cocktail ajouté avec succès', cocktail: newCocktail });
    } catch (error) {
        return res.status(500).json({ message: 'Erreur interne du serveur', error: error.message });
    }
});

router.put("/:id", verifyAdmin, multipleUpload, async (req, res) => {
    try {
        console.log("Données reçues :", req.body);
        const cocktail = await Cocktail.findById(req.params.id);
        if (!cocktail) {
            return res.status(404).json({ message: "Cocktail introuvable." });
        }
        const updateData = { ...req.body };

        let ingredientsData = [];
        if (updateData.ingredients) {
            try {
                ingredientsData = JSON.parse(updateData.ingredients);
                if (ingredientsData.length === 0 || ingredientsData.some(item => !item.name || !item.quantity || !item.unit)) {
                    return res.status(400).json({ message: 'Vous devez ajouter au moins un ingrédient complet.' });
                }
            } catch (e) {
                return res.status(400).json({ message: "Format ingrédients invalide.", error: e.message });
            }
        }

        if (req.files?.image?.[0]) {
            if (cocktail.image) deleteImage(cocktail.image);
            updateData.image = req.files.image[0].filename;
        }
        if (req.files?.thumbnail?.[0]) {
            if (cocktail.thumbnail) deleteImage(cocktail.thumbnail);
            updateData.thumbnail = req.files.thumbnail[0].filename;
        }
        cocktail.set(updateData);
        await Ingredient.deleteMany({ cocktail: cocktail._id });

        cocktail.ingredients = await Promise.all(
            ingredientsData.map(async (ingredient) => {
                const {name, quantity, unit} = ingredient;
                const ingredientDoc = new Ingredient({
                    name,
                    quantity,
                    unit,
                    cocktail: cocktail._id
                });
                await ingredientDoc.save();
                return ingredientDoc._id;
            })
        );
        await cocktail.save();
        res.json(cocktail);
    } catch (err) {
        res.status(400).json({ message: "Erreur lors de la mise à jour." });
    }
});

router.delete("/:id", verifyAdmin, async (req, res) => {
    try {
        const deletedCocktail = await Cocktail.findByIdAndDelete(req.params.id);
        if (!deletedCocktail) return res.status(404).json({ message: "Cocktail introuvable." });

        await Ingredient.deleteMany({ cocktail: deletedCocktail._id });

        if (deletedCocktail.image) deleteImage(deletedCocktail.image);
        if (deletedCocktail.thumbnail) deleteImage(deletedCocktail.thumbnail);
        res.json({ message: "Cocktail supprimé." });
    } catch (err) {
        res.status(400).json({ message: "Erreur lors de la suppression." });
    }
});

router.patch("/:id/publish", verifyAdmin, async (req, res) => {
    try {
        const cocktail = await Cocktail.findById(req.params.id);
        if (!cocktail) {
            return res.status(404).json({ message: "Cocktail introuvable." });
        }
        cocktail.publish = req.body.publish;
        await cocktail.save();
        res.json(cocktail);
    } catch (err) {
        res.status(400).json({ message: "Erreur lors de la mise à jour du publish." });
    }
});


module.exports = router;
