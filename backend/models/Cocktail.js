const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CocktailSchema = new Schema({
  name: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  thumbnail: { type: String, required: true },
  recipe: { type: String, required: true },
  theme: { type: String, required: true },
  description: { type: String, required: true },
  color: { type: String, default: "#13a444" },
  textColor: { type: String, default: "black" },
  publish: {
    type: Boolean,
    default: false
  },
  featured: {
    type: Boolean,
    default: false
  },
  ingredients: [{ type: Schema.Types.ObjectId, ref: "Ingredient" }]
}, {
  timestamps: true // <-- createdAt et updatedAt automatiques
});

module.exports = mongoose.model("Cocktail", CocktailSchema);
