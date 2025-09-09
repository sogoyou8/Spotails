const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "user" },
  
  // Champs Spotify
  spotifyId: { type: String },
  spotifyAccessToken: { type: String },
  spotifyRefreshToken: { type: String },
  spotifyTokenExpiry: { type: Date },
  
  // ← AJOUTE ce champ
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cocktail" }]
}, {
  timestamps: true
});

module.exports = mongoose.model("User", UserSchema);
