const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    cocktail: { type: mongoose.Schema.Types.ObjectId, ref: "Cocktail", required: true }
});

module.exports = mongoose.model("Ingredient", ingredientSchema);
