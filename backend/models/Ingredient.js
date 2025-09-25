const mongoose = require("mongoose");

const IngredientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // accept number | string | null
  quantity: { type: mongoose.Schema.Types.Mixed, default: null, required: false },
  unit: { type: String, default: "" },
  // new: mode to explain quantity meaning
  quantityMode: { 
    type: String, 
    enum: ["exact","to_taste","as_needed","garnish","count"], 
    default: "exact" 
  },
  cocktail: { type: mongoose.Schema.Types.ObjectId, ref: "Cocktail", required: true }
}, { timestamps: true });

module.exports = mongoose.model("Ingredient", IngredientSchema);
