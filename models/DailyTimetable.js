const mongoose = require('mongoose');

const TimetableSlotSchema = new mongoose.Schema({
  time: { type: String },
  courseCode: { type: String },
  courseName: { type: String },
  facultyName: { type: String },
  roomNo: { type: String },
  roundingsTime: { type: String }
});

const DailyTimetableSchema = new mongoose.Schema({
  day: { type: String, required: true },
  department: { type: String, required: true },
  role: { type: String, enum: ['faculty', 'student', 'hod'], required: true },
  section: { type: String },         // For students/faculty if applicable
  semester: { type: String },
  facultyId: { type: String },       // For faculty role
  timetableSlots: [TimetableSlotSchema],
  // term: { type: String },            // Or rename to oddEvenTerm if you want
  oddEvenTerm: { type: String },     // You can keep either term or oddEvenTerm
  duration: { type: String }          // Add duration to match your controller
}, { timestamps: true });

module.exports = mongoose.model('DailyTimetable', DailyTimetableSchema);
