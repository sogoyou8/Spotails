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
const sharp = require("sharp"); // <-- add

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

// helper: generate webp variants for a file (keeps original name in DB)
async function generateWebpVariants(inputPath, outputDir, baseFilename, sizes = [800, 400, 200]) {
    // base without extension
    const nameNoExt = baseFilename.replace(/\.[^/.]+$/, "");
    // full-size webp (no resize)
    await sharp(inputPath).toFormat("webp", { quality: 82 }).toFile(path.join(outputDir, `${nameNoExt}.webp`));
    // sized variants
    await Promise.all(
        sizes.map((w) =>
            sharp(inputPath)
                .resize({ width: w, withoutEnlargement: true })
                .toFormat("webp", { quality: 80 })
                .toFile(path.join(outputDir, `${nameNoExt}_${w}.webp`))
        )
    );
}

// helper pour quantity
function normalizeIngredients(list = []) {
  const filled = (list || []).filter(it => it && String(it.name || "").trim());
  if (filled.length === 0) return { error: "Vous devez ajouter au moins un ingrédient avec un nom." };

  const items = filled.map(it => {
    const name = String(it.name).trim();
    const unit = it.unit ? String(it.unit).trim() : "";
    const raw = it.quantity;
    let quantity = null;
    let quantityMode = String(it.quantityMode || "").trim() || null;

    // legacy: treat explicit 0 as "as_needed"
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
      const num = Number(String(raw).replace(",", "."));
      if (Number.isFinite(num)) {
        // if numeric and zero -> treat as as_needed
        if (num === 0) {
          quantity = null;
          quantityMode = quantityMode || "as_needed";
        } else {
          quantity = num;
          quantityMode = quantityMode || "exact";
        }
      } else {
        // non-numeric quantities like "dash" / "splash"
        quantity = String(raw).trim();
        quantityMode = quantityMode || "exact";
      }
    } else {
      // no quantity given -> mode default
      quantity = null;
      quantityMode = quantityMode || "as_needed";
    }

    return { name, quantity, unit, quantityMode };
  });
  return { items };
}

router.get("/", async (req, res) => {
    try {
        // Query params: q (text search), ingredient, theme, page, limit
        const { q, ingredient, theme } = req.query;
        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const limit = Math.max(1, parseInt(req.query.limit || "50", 10));
        const skip = (page - 1) * limit;

        let filter = { publish: true };

        if (theme) {
            filter.theme = { $regex: theme, $options: "i" };
        }

        if (q) {
            const regex = { $regex: q, $options: "i" };
            filter.$or = [
                { name: regex },
                { description: regex },
                { theme: regex }
            ];
        }

        if (ingredient) {
            // find ingredients matching and limit cocktails to those ids
            const ingRegex = new RegExp(ingredient, "i");
            const matchedIngredients = await Ingredient.find({ name: ingRegex });
            const cocktailIds = matchedIngredients.map(i => i.cocktail).filter(Boolean);
            if (cocktailIds.length === 0) {
                return res.json({ data: [], page, totalPages: 0, total: 0 });
            }
            filter._id = { $in: cocktailIds };
        }

        const total = await Cocktail.countDocuments(filter);
        const cocktails = await Cocktail.find(filter).skip(skip).limit(limit);

        res.json({
            data: cocktails,
            page,
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (err) {
        res.status(500).json({ message: "Erreur lors de la récupération des cocktails.", error: err.message });
    }
});

router.get("/admin", verifyAdmin, async (req, res) => {
    try {
        const {
            q = "",
            theme = "",
            publish = "all",           // all | published | draft
            page = "1",
            limit = "24",
            sortBy = "updatedAt",      // updatedAt | createdAt | name | theme | publish
            sortDir = "desc"           // asc | desc
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;

        // Filtre
        const filter = {};
        if (q && String(q).trim()) {
            const regex = { $regex: String(q).trim(), $options: "i" };
            filter.$or = [{ name: regex }, { description: regex }, { theme: regex }];
        }
        if (theme && String(theme).trim()) {
            filter.theme = { $regex: String(theme).trim(), $options: "i" };
        }
        if (publish === "published") filter.publish = true;
        if (publish === "draft") filter.publish = false;

        // Tri
        const sortMap = { updatedAt: "updatedAt", createdAt: "createdAt", name: "name", theme: "theme", publish: "publish" };
        const sortField = sortMap[sortBy] || "updatedAt";
        const sort = { [sortField]: sortDir === "asc" ? 1 : -1 };

        // Requêtes parallèles
        const [total, items, themesAgg, pubCounts] = await Promise.all([
            Cocktail.countDocuments(filter),
            Cocktail.find(filter).sort(sort).skip(skip).limit(limitNum),
            Cocktail.aggregate([
                { $group: { _id: "$theme", count: { $sum: 1 } } },
                { $sort: { count: -1, _id: 1 } }
            ]),
            Promise.all([
                Cocktail.countDocuments({ publish: true }),
                Cocktail.countDocuments({ publish: false })
            ])
        ]);

        const [publishedCount, draftCount] = pubCounts;

        res.json({
            data: items,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            total,
            facets: {
                themes: themesAgg.map(t => ({ name: t._id, count: t.count })),
                publish: { published: publishedCount, draft: draftCount }
            }
        });
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

// POST create
router.post("/", verifyAdmin, multipleUpload, async (req, res) => {
  try {
    const { name, ingredients, recipe, theme, description, color, textColor } = req.body;
    if (!name || !req.files?.image?.[0] || !req.files?.thumbnail?.[0] || !ingredients || !recipe || !theme || !description) {
      return res.status(400).json({ message: "Tous les champs sont requis." });
    }

    let ing = [];
    try {
      const parsed = JSON.parse(ingredients);
      const result = normalizeIngredients(parsed);
      if (result.error) {
        // validation error -> return 400 avec message clair
        return res.status(400).json({ message: result.error });
      } else {
        ing = result.items;
      }
    } catch (e) {
      console.error("Erreur parsing ingrédients (POST /api/cocktails) :", e);
      return res.status(400).json({ message: "Format ingrédients invalide.", error: e.message });
    }

    const imageFilename = req.files["image"][0].filename;
    const thumbFilename = req.files["thumbnail"][0].filename;

    // generate webp variants (keeps originals)
    const uploadsDir = path.join(__dirname, "../uploads");
    try {
      await generateWebpVariants(path.join(uploadsDir, imageFilename), uploadsDir, imageFilename, [1200, 800, 400]);
      await generateWebpVariants(path.join(uploadsDir, thumbFilename), uploadsDir, thumbFilename, [400, 200, 100]);
    } catch (e) {
      console.error("Erreur génération webp variants :", e);
      // ne bloque pas la création si les conversions échouent, mais logguer et continuer
    }

    const newCocktail = new Cocktail({
        name,
        image: imageFilename,
        thumbnail: thumbFilename,
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
      ing.map(async (ingredient) => {
        const doc = new Ingredient({ ...ingredient, cocktail: newCocktail._id });
        await doc.save();
        return doc._id;
      })
    );
    await newCocktail.save();
    return res.status(201).json({ message: 'Cocktail ajouté avec succès', cocktail: newCocktail });
  } catch (error) {
    console.error("POST /api/cocktails ERROR:", error);
    return res.status(500).json({ message: "Erreur interne du serveur", error: error.message });
  }
});

// PUT update
router.put("/:id", verifyAdmin, multipleUpload, async (req, res) => {
  try {
    console.log("Données reçues :", req.body);
    const cocktail = await Cocktail.findById(req.params.id);
    if (!cocktail) {
      return res.status(404).json({ message: "Cocktail introuvable." });
    }
    const updateData = { ...req.body };

    let ing = [];
    if (updateData.ingredients) {
      try {
        const parsed = JSON.parse(updateData.ingredients);
        const result = normalizeIngredients(parsed);
        if (result.error) return res.status(400).json({ message: result.error });
        ing = result.items;
      } catch (e) {
        return res.status(400).json({ message: "Format ingrédients invalide." });
      }
    }

    if (req.files?.image?.[0]) {
      if (cocktail.image) deleteImage(cocktail.image);
      updateData.image = req.files.image[0].filename;
      const uploadsDir = path.join(__dirname, "../uploads");
      await generateWebpVariants(path.join(uploadsDir, updateData.image), uploadsDir, updateData.image, [1200, 800, 400]);
    }
    if (req.files?.thumbnail?.[0]) {
      if (cocktail.thumbnail) deleteImage(cocktail.thumbnail);
      updateData.thumbnail = req.files.thumbnail[0].filename;
      const uploadsDir = path.join(__dirname, "../uploads");
      await generateWebpVariants(path.join(uploadsDir, updateData.thumbnail), uploadsDir, updateData.thumbnail, [400, 200, 100]);
    }
    cocktail.set(updateData);
    await Ingredient.deleteMany({ cocktail: cocktail._id });
    cocktail.ingredients = await Promise.all(
      ing.map(async (ingredient) => {
        const doc = new Ingredient({ ...ingredient, cocktail: cocktail._id });
        await doc.save();
        return doc._id;
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
