const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation des données
        if (!username || !email || !password) {
            return res.status(400).json({ message: "Tous les champs sont requis." });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères." });
        }

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await User.findOne({
            $or: [
                { username: username },
                { email: email }
            ]
        });

        if (existingUser) {
            if (existingUser.username === username) {
                return res.status(400).json({ message: "Nom d'utilisateur déjà pris." });
            } else {
                return res.status(400).json({ message: "Adresse e-mail déjà utilisée." });
            }
        }

        // Hacher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer l'utilisateur
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            role: "user"
        });

        await newUser.save();

        // Générer le token JWT
        const token = jwt.sign(
            { id: newUser._id, role: newUser.role },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        res.status(201).json({
            _id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            token
        });
    } catch (error) {
        console.error("Erreur register:", error);
        res.status(500).json({ message: "Erreur serveur lors de l'inscription." });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation des données d'entrée
        if (!username || !password) {
            return res.status(400).json({ message: "Nom d'utilisateur et mot de passe requis." });
        }

        // Convertir en lowercase de manière sécurisée
        const usernameNormalized = typeof username === 'string' ? username.toLowerCase() : '';
        
        if (!usernameNormalized) {
            return res.status(400).json({ message: "Nom d'utilisateur invalide." });
        }

        // Chercher l'utilisateur (insensible à la casse)
        const user = await User.findOne({
            $or: [
                { username: { $regex: new RegExp(`^${usernameNormalized}$`, 'i') } },
                { email: { $regex: new RegExp(`^${usernameNormalized}$`, 'i') } }
            ]
        });

        if (!user) {
            return res.status(401).json({ message: "Utilisateur introuvable." });
        }

        // Vérifier le mot de passe
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Mot de passe incorrect." });
        }

        // Générer le token JWT
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            token
        });
    } catch (error) {
        console.error("Erreur login:", error);
        res.status(500).json({ message: "Erreur serveur lors de la connexion." });
    }
};