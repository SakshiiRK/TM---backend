const express = require('express');
const { registerUser, getAllUsers } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', protect(['admin']), registerUser);
router.get('/', protect(['admin']), getAllUsers);

module.exports = router;
