const mongoose = require('mongoose');

// Define the schema for a single timetable slot
const timetableSlotSchema = new mongoose.Schema({
    time: { type: String, required: true },
    courseCode: { type: String, required: true },
    courseName: { type: String, required: true },
    facultyName: { type: String }, // Optional for student timetable
    roomNo: { type: String, required: true },
    roundingsTime: { type: String }, // Optional, e.g., for lab timings
    // Add any other specific fields for a slot
}, { _id: true }); // <--- CRITICAL: Ensures _id is generated for subdocuments

// Define the main DailyTimetable schema
const dailyTimetableSchema = new mongoose.Schema({
    day: {
        type: String,
        required: true,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    role: {
        type: String,
        required: true,
        enum: ['hod', 'faculty', 'student']
    },
    department: {
        type: String,
        required: true
    },
    facultyId: { // Required for faculty role
        type: String,
        
        sparse: true // Allows multiple documents to have null or unique values
    },
    section: { // Required for student role
        type: String,
        sparse: true
    },
    semester: { // Required for student role
        type: String,
        sparse: true
    },
    oddEvenTerm: { type: String }, // General property for the daily timetable
    duration: { type: String }, // General property for the daily timetable
    // Array of timetable slots for the day
    timetableSlots: [timetableSlotSchema],
}, { timestamps: true }); // Adds createdAt and updatedAt fields

// Create indexes for faster queries (ensure uniqueness for role-specific timetables)
dailyTimetableSchema.index({ day: 1, role: 1, department: 1 }, { unique: true, partialFilterExpression: { role: 'hod' } });
dailyTimetableSchema.index({ day: 1, role: 1, department: 1, facultyId: 1 }, { unique: true, partialFilterExpression: { role: 'faculty' } });
dailyTimetableSchema.index({ day: 1, role: 1, department: 1, section: 1, semester: 1 }, { unique: true, partialFilterExpression: { role: 'student' } });


// Static method to find existing timetable entry based on role-specific criteria
dailyTimetableSchema.statics.findExistingEntry = async function (day, role, department, facultyId, section, semester) {
    const query = { day, role, department };

    if (role === 'faculty' && facultyId) {
        query.facultyId = facultyId;
    } else if (role === 'student' && section && semester) {
        query.section = section;
        query.semester = semester;
    }
    // HOD entries are unique by department for a given day (handled by the index/default query)

    return await this.findOne(query);
};

const DailyTimetable = mongoose.model('DailyTimetable', dailyTimetableSchema);

module.exports = DailyTimetable;