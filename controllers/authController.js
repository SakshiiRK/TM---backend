const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

// Generate JWT token with extra fields
const generateToken = (id, role, department, faculty_id) => {
  return jwt.sign(
    { id, role, department, faculty_id },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
};

// Register User
exports.registerUser = async (req, res) => {
  const {
    name,
    email,
    password,
    role,
    department,
    semester,
    section,
    faculty_id,
  } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required' });
  }

  // Role-specific checks
  if (role === 'student' && (!semester || !section || !department)) {
    return res.status(400).json({ message: 'Semester, section, and department are required for students' });
  }
  if (role === 'faculty' && (!department || !faculty_id)) {
    return res.status(400).json({ message: 'Department and faculty ID are required for faculty' });
  }
  if (role === 'hod' && !department) {
    return res.status(400).json({ message: 'Department is required for HOD' });
  }

  try {
    if (role === 'admin') {
      const adminExists = await User.findOne({ role: 'admin' });
      if (adminExists) return res.status(403).json({ message: 'Admin already exists' });
    }

    if (role === 'hod') {
      const hodExists = await User.findOne({ role: 'hod', department });
      if (hodExists) return res.status(403).json({ message: `HOD already exists for ${department}` });
    }

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      department: department || null,
      faculty_id: faculty_id || null,
      semester: semester || null,
      section: section || null,
    });

    const token = generateToken(user._id, user.role, user.department, user.faculty_id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      faculty_id: user.faculty_id || null,
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login User
// Login User
exports.loginUser = async (req, res) => {
  const { email, password, faculty_id } = req.body;

  try {
    let user;

    if (faculty_id) {
      if (!email) return res.status(400).json({ message: 'Email is required for faculty login' });
      user = await User.findOne({ email, faculty_id });
    } else {
      if (!email) return res.status(400).json({ message: 'Email is required' });
      user = await User.findOne({ email });
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id, user.role, user.department, user.faculty_id);

    // 💡 Construct custom user object for frontend
    const userData = {
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    };

    // Add role-specific fields
    if (user.role === 'faculty' || user.role === 'hod') {
      userData.faculty_id = user.faculty_id;
    } else if (user.role === 'student') {
      userData.section = user.section;
      userData.semester = user.semester;
    }

    res.json({ token, user: userData });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

