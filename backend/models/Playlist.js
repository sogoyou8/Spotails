const mongoose = require("mongoose");

const PlaylistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  tracks: { type: Array, default: [] },
  coverIndex: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model("Playlist", PlaylistSchema);