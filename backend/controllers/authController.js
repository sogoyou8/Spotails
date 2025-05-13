const User = require("../models/User");
const jwt = require("jsonwebtoken");

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

exports.registerUser = async (req, res) => {
    const { username, email, password } = req.body;

    const usernameRegex = /^[a-zA-Z0-9]+$/;
    if (!usernameRegex.test(username) || username.length > 16 || username.length < 3) {
        return res.status(400).json({ message: "Le nom d'utilisateur doit être alphanumérique et contenir entre 3 et 16 caractères." });
    }
    const usernameExists = await User.findOne({
        username: { $regex: new RegExp("^" + username + "$", "i") }
    });
    if (usernameExists) {
        return res.status(400).json({ message: "Nom d'utilisateur déjà pris." });
    }

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "L'adresse email n'est pas valide." });
    }
    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
        return res.status(400).json({ message: "Email déjà utilisé." });
    }

    if (password.length < 8) {
        return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères." });
    }

    const user = await User.create({
        username,
        email: email.toLowerCase(),
        password,
    });

    if (user) {
        const token = generateToken(user._id, user.role);
        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            token,
        });
    } else {
        res.status(400).json({ message: "Erreur lors de l'inscription" });
    }
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (user && (await user.matchPassword(password))) {
        const token = generateToken(user._id, user.role);
        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            token,
        });
    } else {
        res.status(401).json({ message: "Email ou mot de passe incorrect" });
    }
};