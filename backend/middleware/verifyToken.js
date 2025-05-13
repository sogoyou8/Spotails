const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyToken = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        req.user = null;
        return next();
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            req.user = null;
            return next();
        }

        if (user.role !== 'admin') {
            req.user = user;
            return next();
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(400).json({message: 'Token invalide.'});
    }
};

module.exports = verifyToken;
