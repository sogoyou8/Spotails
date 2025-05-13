const User = require("../models/User");
const bcrypt = require("bcryptjs");

exports.updatePassword = async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: "Tous les champs sont requis." });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères." });
    }
    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "Les nouveaux mots de passe ne correspondent pas." });
    }
    const user = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        return res.status(400).json({ message: "Mot de passe actuel incorrect." });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: "Mot de passe mis à jour avec succès." });
};

exports.updateEmail = async (req, res) => {
    const { email } = req.body;

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "L'adresse email n'est pas valide." });
    }

    if (!email) {
        return res.status(400).json({ message: "Email requis." });
    }
    const user = await User.findById(req.user.id);
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
        return res.status(400).json({ message: "Cet e-mail est déjà utilisé." });
    }
    user.email = email;
    await user.save();
    res.json({ message: "E-mail mis à jour avec succès." });
};

exports.updateUsername = async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ message: "Pseudo requis." });
    }
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    if (!usernameRegex.test(username) || username.length > 16 || username.length < 3) {
        return res.status(400).json({ message: "Le nom d'utilisateur doit être alphanumérique et contenir entre 3 et 16 caractères." });
    }
    const user = await User.findById(req.user.id);
    const existingUsername = await User.findOne({
        username: { $regex: new RegExp("^" + username + "$", "i") }
    });
    if (existingUsername) {
        return res.status(400).json({ message: "Ce pseudo est déjà pris." });
    }
    user.username = username;
    await user.save();
    res.json({ message: "Pseudo mis à jour avec succès." });
};

exports.deleteAccount = async (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ message: "Mot de passe requis pour confirmer la suppression." });
    }
    const user = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ message: "Mot de passe incorrect." });
    }
    await User.findByIdAndDelete(req.user.id);
    res.json({ message: "Compte supprimé avec succès." });
};

exports.retrieveAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "Utilisateur introuvable." });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: "Erreur serveur.", error: err.message });
    }
};

exports.updateRole = async (req, res) => {
    const { role } = req.body;
    if (!role || !['user', 'admin'].includes(role)) {
        return res.status(400).json({ message: "Rôle invalide." });
    }
    try {
        const updatedUser = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ message: "Utilisateur introuvable." });
        }
        res.json({ message: "Rôle mis à jour", user: updatedUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erreur lors de la mise à jour du rôle.", error: err.message });
    }
};

exports.resetPassword = async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) {
        return res.status(400).json({ message: "Nouveau mot de passe requis." });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
        return res.status(404).json({ message: "Utilisateur introuvable." });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: "Mot de passe réinitialisé." });
};