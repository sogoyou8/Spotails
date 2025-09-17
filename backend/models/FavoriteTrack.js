const mongoose = require("mongoose");

const FavoriteTrackSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    trackId: { type: String, required: true }, // Spotify track ID
    trackName: { type: String, required: true },
    artistName: { type: String, required: true },
    previewUrl: { type: String },
    spotifyUrl: { type: String },
    albumImage: { type: String },
    cocktailId: { type: mongoose.Schema.Types.ObjectId, ref: "Cocktail" } // Cocktail associé
}, {
    timestamps: true
});

// Index pour éviter les doublons
FavoriteTrackSchema.index({ userId: 1, trackId: 1 }, { unique: true });

module.exports = mongoose.model("FavoriteTrack", FavoriteTrackSchema);