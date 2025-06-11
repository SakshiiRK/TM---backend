const express = require('express');
const router = express.Router();

const {
  createOrUpdateDailyTimetable,
  deleteTimetable, // This currently deletes the whole daily entry
  searchFacultyByHOD,
  getFacultyTimetablesForHOD,
  getUserTimetableForDay,
  searchTimetable
} = require('../controllers/timetableController'); // You will need to add the new function to this controller or inline it as shown below

const { protect } = require('../middleware/authMiddleware');
const DailyTimetable = require('../models/DailyTimetable'); // Make sure to import your model


// POST - Create or update daily timetable (admin only)
router.post('/daily', protect(['admin']), createOrUpdateDailyTimetable);

// GET - Search timetable (all roles)
router.get('/search', protect(['admin', 'hod', 'faculty', 'student']), searchTimetable);

// DELETE - Delete timetable by ID (admin only)
// This route will continue to delete the entire daily timetable document
router.delete('/:id', protect(['admin']), deleteTimetable);


// --- NEW ROUTE: DELETE A SPECIFIC SLOT FROM A DAILY TIMETABLE ENTRY ---
// @route   DELETE /api/timetable/:dailyTimetableId/slot/:slotId
// @desc    Delete a specific timetable slot from a daily timetable entry
// @access  Private (admin only)
router.delete('/:dailyTimetableId/slot/:slotId', protect(['admin']), async (req, res) => {
  try {
    const { dailyTimetableId, slotId } = req.params;

    // Find the DailyTimetable document and pull the specific slot from its array
    const updatedDoc = await DailyTimetable.findByIdAndUpdate(
      dailyTimetableId,
      { $pull: { timetableSlots: { _id: slotId } } }, // $pull operator removes elements from an array
      { new: true } // Returns the modified document
    );

    if (!updatedDoc) {
      return res.status(404).json({ msg: 'Daily timetable entry not found.' });
    }

    // Optional: If no slots remain after deleting, delete the parent DailyTimetable document as well
    if (updatedDoc.timetableSlots.length === 0) {
      await DailyTimetable.findByIdAndDelete(dailyTimetableId);
      return res.json({ msg: 'Timetable slot deleted successfully. As it was the last slot, the daily timetable entry was also removed.' });
    }

    // Respond with success message and the updated document
    res.json({ msg: 'Timetable slot deleted successfully.', updatedDoc });

  } catch (err) {
    console.error('Error deleting timetable slot:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});
// --- END NEW ROUTE ---


// GET - Faculty timetables filtered by HOD (hod only)
router.get('/faculty-by-hod', protect(['hod']), searchFacultyByHOD);

// GET - All faculty timetables for HOD's department (hod only)
router.get('/faculty-timetables', protect(['hod']), getFacultyTimetablesForHOD);

// GET - Daily timetable view for faculty/student/hod
router.get('/daily-view', protect(['faculty', 'student', 'hod']), getUserTimetableForDay);

// GET - Timetable for a day by role and user's department (Original route)
router.get('/day/:day', protect(['admin', 'hod', 'faculty', 'student']), async (req, res) => {
  try {
    const { day } = req.params;
    const { role } = req.query;
    const user = req.user; // This comes from your authMiddleware

    const formattedDay = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();

    const query = { day: formattedDay, role: role.toLowerCase() };

    if (user && user.department) {
      query.department = user.department;
    }

    // Add filtering for student specific timetable
    if (role === 'student') {
      if (user.section) query.section = user.section;
      if (user.semester) query.semester = user.semester;
    }
    // Add filtering for faculty specific timetable
    else if (role === 'faculty') {
      if (user.faculty_id) query.facultyId = user.faculty_id;
    }
    // For HOD role, the `query.department` already handles fetching all for the department.
    // If you need HOD's *own* timetable, it would fall under `faculty` role check or a separate query.


    const data = await DailyTimetable.find(query); // Use the imported model directly

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