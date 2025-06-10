// const jwt = require('jsonwebtoken');
// require('dotenv').config();

// const protect = (roles = []) => {
//   return (req, res, next) => {
//     const token = req.headers.authorization?.split(' ')[1];
//     if (!token) return res.status(401).json({ message: 'No token provided' });

//     try {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       req.user = decoded;

//       if (roles.length && !roles.includes(decoded.role)) {
//         return res.status(403).json({ message: 'Access denied' });
//       }

//       next();
//     } catch (err) {
//       console.error(err);
//       res.status(401).json({ message: 'Invalid token' });
//     }
//   };
// };
// const protect = (roles = []) => {
//   return (req, res, next) => {
//     const token = req.headers.authorization?.split(' ')[1];
//     if (!token) return res.status(401).json({ message: 'No token provided' });

//     try {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       req.user = decoded;  // decoded will now include id, role, department, faculty_id

//       if (roles.length && !roles.includes(decoded.role)) {
//         return res.status(403).json({ message: 'Access denied' });
//       }

//       next();
//     } catch (err) {
//       console.error(err);
//       res.status(401).json({ message: 'Invalid token' });
//     }
//   };
// };

// module.exports = { protect };
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
