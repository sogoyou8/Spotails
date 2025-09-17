const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const Playlist = require("../models/Playlist");

// GET mes playlists
router.get("/", verifyToken, async (req, res) => {
  const items = await Playlist.find({ userId: req.user.id }).sort({ updatedAt: -1 });
  res.json(items);
});

// POST créer
router.post("/", verifyToken, async (req, res) => {
  const { name, tracks = [] } = req.body;
  if (!name) return res.status(400).json({ message: "name requis" });
  const exists = await Playlist.findOne({ userId: req.user.id, name: { $regex: `^${name}$`, $options: "i" } });
  if (exists) return res.status(409).json({ message: "Une playlist du même nom existe déjà." });
  const doc = await Playlist.create({ userId: req.user.id, name: name.trim(), tracks, coverIndex: 0 });
  res.status(201).json(doc);
});

// PUT maj (nom et/ou pistes)
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { name, tracks } = req.body;
  const pl = await Playlist.findOne({ _id: id, userId: req.user.id });
  if (!pl) return res.status(404).json({ message: "Playlist introuvable" });

  if (typeof name === "string" && name.trim()) {
    const dup = await Playlist.findOne({
      userId: req.user.id,
      _id: { $ne: id },
      name: { $regex: `^${name}$`, $options: "i" },
    });
    if (dup) return res.status(409).json({ message: "Une playlist du même nom existe déjà." });
    pl.name = name.trim();
  }
  if (Array.isArray(tracks)) {
    pl.tracks = tracks;
    if (pl.coverIndex >= pl.tracks.length) pl.coverIndex = 0;
  }
  await pl.save();
  res.json(pl);
});

// PATCH cover
router.patch("/:id/cover", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { coverIndex = 0 } = req.body;
  const pl = await Playlist.findOne({ _id: id, userId: req.user.id });
  if (!pl) return res.status(404).json({ message: "Playlist introuvable" });
  pl.coverIndex = Number(coverIndex) || 0;
  await pl.save();
  res.json({ ok: true, coverIndex: pl.coverIndex });
});

// DELETE
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  await Playlist.deleteOne({ _id: id, userId: req.user.id });
  res.json({ ok: true });
});

module.exports = router;