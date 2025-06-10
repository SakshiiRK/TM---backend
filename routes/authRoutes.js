const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');

router.post('/register', registerUser); // Public or protect(['admin']) if needed
router.post('/login', loginUser);

module.exports = router;
