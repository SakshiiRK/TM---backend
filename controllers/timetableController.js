// const Timetable = require('../models/Timetable'); // Your main Timetable model
const DailyTimetable = require('../models/DailyTimetable'); // Daily-specific timetable

/**
 * Create or update a daily timetable entry
 */
exports.createOrUpdateDailyTimetable = async (req, res) => {
  const {
    day,
    role,
    department,
    semester,
    section,
    facultyId,
    oddEvenTerm,
    duration,
    roomNumber,
    className,
    timetableSlots
  } = req.body;

  // Build query depending on role
  const query = { day, role, department };
  console.log("Incoming Timetable Body:", req.body);
  if (role === 'student') {
    query.semester = semester;
    query.section = section;
  } else if (role === 'faculty') {
    query.facultyId = facultyId;
  }

  try {
    let timetable = await DailyTimetable.findOne(query);

    if (timetable) {
      // Update existing timetable
      Object.assign(timetable, { oddEvenTerm, duration, roomNumber, className, timetableSlots });
      await timetable.save();
    } else {
      // Create new timetable entry
      timetable = new DailyTimetable({
        day,
        role,
        department,
        semester,
        section,
        facultyId,
        oddEvenTerm,
        duration,
        roomNumber,
        className,
        timetableSlots
      });
      await timetable.save();
    }

    res.status(200).json({ message: 'Saved successfully', timetable });
  } catch (err) {
    console.error('Save timetable error:', err);
    res.status(500).json({ message: 'Save failed', error: err.message });
  }
};

/**
 * Search timetable based on filters (department, semester, section, role)
 */
exports.searchTimetable = async (req, res) => {
  const { department, semester, section, role } = req.query;
  const query = {};

  if (department) query.department = department;
  if (semester) query.semester = semester;
  if (section) query.section = section;
  if (role) query.role = role;

  try {
    const timetables = await Timetable.find(query);
    res.json(timetables);
  } catch (err) {
    console.error('Search timetable error:', err);
    res.status(500).json({ message: 'Search failed', error: err.message });
  }
};

/**
 * Delete a timetable entry by ID
 */
// Delete daily timetable by ID
exports.deleteTimetable = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await DailyTimetable.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Timetable entry not found' });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Delete timetable error:', err);
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
};


/**
 * Get faculty timetables filtered by HOD's department
 */
exports.searchFacultyByHOD = async (req, res) => {
  try {
    const hodDepartment = req.user.department;
    const facultyTimetables = await Timetable.find({
      department: hodDepartment,
      role: 'faculty'
    });
    res.json(facultyTimetables);
  } catch (err) {
    console.error('Fetch faculty timetables error:', err);
    res.status(500).json({ message: 'Failed to fetch faculty timetables', error: err.message });
  }
};

/**
 * Get timetable by ID
 */
// exports.getTimetableById = async (req, res) => {
//   const { id } = req.params;
//   try {
//     const timetable = await Timetable.findById(id);
//     if (!timetable) return res.status(404).json({ message: 'Timetable not found' });
//     res.json(timetable);
//   } catch (err) {
//     console.error('Get timetable by ID error:', err);
//     res.status(500).json({ message: 'Fetch failed', error: err.message });
//   }
// };
// GET timetable for a specific day
// exports.getTimetableByDay = async (req, res) => {
//   const { day } = req.params;
//   const { role, department, faculty_id } = req.query;

//   try {
//     let query = { day };

//     if (role === 'faculty' && faculty_id) {
//       query.role = 'faculty';
//       query.faculty_id = faculty_id;
//     } else if (role === 'hod' && department) {
//       query.role = 'faculty';
//       query.department = department;
//     } else if (role === 'student') {
//       query.role = 'student';
//       query.department = department;
//       if (req.query.semester) query.semester = req.query.semester;
//       if (req.query.section) query.section = req.query.section;
//     }

//     const timetables = await DailyTimetable.find(query);

//     // If HOD, fetch their own timetable too
//     let hodTimetable = [];
//     if (role === 'hod' && faculty_id) {
//       const hodQuery = { day, role: 'hod', faculty_id };
//       hodTimetable = await DailyTimetable.find(hodQuery);
//     }

//     // Merge all timetables (faculty + HOD if needed)
//     const allTimetables = [...timetables, ...hodTimetable];

//     // Flatten and attach metadata
//     const result = allTimetables.map((entry) => ({
//       ...entry._doc,
//       timetableSlots: entry.timetableSlots.map((slot) => ({
//         ...slot,
//         facultyId: entry.faculty_id || '',
//         section: entry.section || '',
//         semester: entry.semester || '',
//         department: entry.department || '',
//       })),
//     }));

//     res.status(200).json(result);
//   } catch (error) {
//     console.error('Error fetching timetable by day:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };
// inside controller
const timetableByDay = async (req, res) => {
  const { dayName } = req.params;
  const { department, faculty_id, role } = req.query;

  try {
    const timetable = await Timetable.find({
      day: dayName,
      department: department
    });

    const result = timetable.map(t => {
      // Add facultyId, role, section, semester to each slot
      const slotsWithExtras = t.timetableSlots.map(slot => ({
        ...slot,
        facultyId: t.facultyId,
        section: slot.section || t.section,
        semester: slot.semester || t.semester
      }));

      return {
        facultyId: t.facultyId,
        role: t.role,
        timetableSlots: slotsWithExtras
      };
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Error fetching timetable data." });
  }
};


/**
 * Get all faculty timetables for HOD's department
 */
exports.getFacultyTimetablesForHOD = async (req, res) => {
  try {
    const hodDepartment = req.user.department;
    const facultyTimetables = await Timetable.find({ role: 'faculty', department: hodDepartment });
    res.json(facultyTimetables);
  } catch (err) {
    console.error('Fetch faculty timetables for HOD error:', err);
    res.status(500).json({ message: 'Failed to fetch faculty timetables', error: err.message });
  }
};

/**
 * Get user's timetable for a specific day
 */
exports.getUserTimetableForDay = async (req, res) => {
  const { day, role, department, semester, section, facultyId } = req.query;

  const query = { day, role, department };

  if (role === 'student') {
    query.semester = semester;
    query.section = section;
  } else if (role === 'faculty') {
    query.facultyId = facultyId;
  }

  try {
    const timetable = await DailyTimetable.findOne(query);
    res.json(timetable || { slots: [] });
  } catch (err) {
    console.error('Get user timetable for day error:', err);
    res.status(500).json({ message: 'Could not fetch timetable', error: err.message });
  }
};
