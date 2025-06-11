const express = require('express');
const router = express.Router();

const {
    createOrUpdateDailyTimetable,
    updateTimetableSlot,    // NEW: Imported update function
    deleteTimetable,
    deleteTimetableSlot,    // NEW: Imported delete slot function
    searchFacultyByHOD,
    getFacultyTimetablesForHOD,
    getUserTimetableForDay, // For /daily-view
    searchTimetable,
    getTimetableForDay      // For /day/:day
} = require('../controllers/timetableController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware'); // Assuming this middleware exists

// POST - Create or update daily timetable (admin only)
router.post('/daily', protect(['admin']), createOrUpdateDailyTimetable);

// GET - Search timetable (all roles)
router.get('/search', protect(['admin', 'hod', 'faculty', 'student']), searchTimetable);

// DELETE - Delete entire daily timetable by ID (admin only)
router.delete('/:id', protect(['admin']), deleteTimetable);

// PUT - Update a specific slot within a daily timetable entry (admin only)
router.put('/:id/slot/:slotId', protect(['admin']), updateTimetableSlot); // <--- THIS IS THE PUT ROUTE

// DELETE - Delete a specific slot from a daily timetable entry (admin only)
router.delete('/:dailyTimetableId/slot/:slotId', protect(['admin']), deleteTimetableSlot); // <--- Now uses controller function

// GET - Faculty timetables filtered by HOD (hod only)
router.get('/faculty-by-hod', protect(['hod']), searchFacultyByHOD);

// GET - All faculty timetables for HOD's department (hod only)
router.get('/faculty-timetables', protect(['hod']), getFacultyTimetablesForHOD);

// GET - Daily timetable view for faculty/student/hod (using query params)
router.get('/daily-view', protect(['faculty', 'student', 'hod']), getUserTimetableForDay);

// GET - Timetable for a specific day by role and user's department/criteria (using path params for day)
router.get('/day/:day', protect(['admin', 'hod', 'faculty', 'student']), getTimetableForDay); // <--- Now uses controller function

module.exports = router;