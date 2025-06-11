const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware to protect routes and optionally restrict to specific roles
 * @param {Array} roles - Allowed roles to access the route (empty means all authenticated)
 */
const protect = (roles = []) => {
  return (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = decoded; // decoded token payload (id, role, department, faculty_id, etc.)

      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401).json({ message: 'Invalid token' });
    }
  };
};

module.exports = { protect };
