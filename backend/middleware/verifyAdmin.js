const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyAdmin = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'Accès refusé. Aucun token fourni.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Accès refusé. Seul un administrateur peut effectuer cette action.' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(400).json({ message: 'Token invalide.' });
    }
};

module.exports = verifyAdmin;
