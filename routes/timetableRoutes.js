const express = require('express');
const router = express.Router();

const {
  createOrUpdateDailyTimetable,
  deleteTimetable,
  searchFacultyByHOD,
  getFacultyTimetablesForHOD,
  getUserTimetableForDay,
  searchTimetable
} = require('../controllers/timetableController');

const { protect } = require('../middleware/authMiddleware');

// POST - Create or update daily timetable (admin only)
router.post('/daily', protect(['admin']), createOrUpdateDailyTimetable);

// GET - Search timetable (all roles)
router.get('/search', protect(['admin', 'hod', 'faculty', 'student']), searchTimetable);

// DELETE - Delete timetable by ID (admin only)
router.delete('/:id', protect(['admin']), deleteTimetable);

// GET - Faculty timetables filtered by HOD (hod only)
router.get('/faculty-by-hod', protect(['hod']), searchFacultyByHOD);

// GET - All faculty timetables for HOD's department (hod only)
router.get('/faculty-timetables', protect(['hod']), getFacultyTimetablesForHOD);

// GET - Daily timetable view for faculty/student/hod
router.get('/daily-view', protect(['faculty', 'student', 'hod']), getUserTimetableForDay);

// GET - Timetable for a day by role and user's department
router.get('/day/:day', protect(['admin', 'hod', 'faculty', 'student']), async (req, res) => {
  try {
    const { day } = req.params;
    const { role } = req.query;
    const user = req.user;

    const formattedDay = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();

    const query = { day: formattedDay, role: role.toLowerCase() };

    if (user && user.department) {
      query.department = user.department;
    }

    if (role === 'student') {
      if (user.section) query.section = user.section;
      if (user.semester) query.semester = user.semester;
    } else if (role === 'faculty') {
      if (user.faculty_id) query.facultyId = user.faculty_id;
    }

    const data = await require('../models/DailyTimetable').find(query);

    if (!data.length) {
      console.log(`No timetable found for ${formattedDay}, role: ${role}, department: ${user.department}`);
    }

    res.json(data);
  } catch (err) {
    console.error('Timetable fetch error:', err);
    res.status(500).json({ message: 'Error fetching timetable', error: err.message });
  }
});

module.exports = router;
