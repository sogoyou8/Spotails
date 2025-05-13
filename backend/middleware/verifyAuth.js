const jwt = require('jsonwebtoken');

const verifyAuth = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'Accès non autorisé. Token requis.' });
    }
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        res.status(400).json({ message: 'Token invalide.' });
    }
};

module.exports = verifyAuth;
