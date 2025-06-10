// const mongoose = require('mongoose');

// const UserSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   role: { type: String, enum: ['admin', 'hod', 'faculty', 'student'], required: true },
//   department: { type: String, required: true },
// });

// module.exports = mongoose.model('User', UserSchema);
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'hod', 'faculty', 'student'], required: true },
  department: { type: String },        // optional for admin
  faculty_id: { type: String },        // only for faculty
  semester: { type: String },          // only for student
  section: { type: String },           // only for student
});

module.exports = mongoose.model('User', UserSchema);
