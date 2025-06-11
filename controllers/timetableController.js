const DailyTimetable = require('../models/DailyTimetable');

// Helper function to format time for consistent comparison (e.g., 'HH:MM' 24-hour format)
const formatTime = (timeString) => {
    try {
        if (!timeString) return null;
        const [time, period] = timeString.split(' ');
        let [hours, minutes] = time.split(':').map(Number);

        if (period && period.toLowerCase() === 'pm' && hours !== 12) {
            hours += 12;
        } else if (period && period.toLowerCase() === 'am' && hours === 12) {
            hours = 0; // Midnight
        }
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } catch (e) {
        console.error('Time formatting error:', e, 'for time string:', timeString);
        return null;
    }
};

// @desc    Create or Update daily timetable entry
// @route   POST /api/timetable/daily
// @access  Private/Admin
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
        timetableSlots // This should be an array of slot objects
    } = req.body;

    // Basic validation
    if (!day || !role || !department || !timetableSlots || !Array.isArray(timetableSlots)) {
        return res.status(400).json({ message: 'Missing required timetable fields (day, role, department, timetableSlots).' });
    }

    if (role === 'faculty' && !facultyId) {
        return res.status(400).json({ message: 'Faculty ID is required for faculty role.' });
    }
    if (role === 'student' && (!section || !semester)) {
        return res.status(400).json({ message: 'Section and Semester are required for student role.' });
    }

    // --- Validation for individual slots and conflicts ---
    const seenTimesForEntry = new Set();
    const formattedSlots = [];

    for (const slot of timetableSlots) {
        if (!slot.time || !slot.courseCode || !slot.courseName || !slot.roomNo) {
            return res.status(400).json({ message: 'Each timetable slot must have time, courseCode, courseName, and roomNo.' });
        }

        const formattedTime = formatTime(slot.time);
        if (!formattedTime) {
            return res.status(400).json({ message: `Invalid time format: ${slot.time}` });
        }
        if (seenTimesForEntry.has(formattedTime)) {
            return res.status(400).json({
                message: `Duplicate timing (${slot.time}) found for this timetable entry. Each slot must have a unique time.`,
            });
        }
        seenTimesForEntry.add(formattedTime);

        // Prepare slot for database (ensure _id is not explicitly set for new subdocuments)
        formattedSlots.push({
            time: slot.time, // Store original time string
            courseCode: slot.courseCode,
            courseName: slot.courseName,
            facultyName: slot.facultyName,
            roomNo: slot.roomNo,
            roundingsTime: slot.roundingsTime
        });
    }

    try {
        let timetable = await DailyTimetable.findExistingEntry(day, role, department, facultyId, section, semester);

        // Check for room conflicts against other timetable entries
        for (const newSlot of formattedSlots) {
            const conflictQuery = {
                day: day,
                'timetableSlots.time': newSlot.time,
                'timetableSlots.roomNo': newSlot.roomNo,
            };
            if (timetable) { // If updating, exclude the current document from conflict check
                conflictQuery._id = { $ne: timetable._id };
            }

            const existingRoomConflict = await DailyTimetable.findOne(conflictQuery);
            if (existingRoomConflict) {
                let conflictDetail = `Room ${newSlot.roomNo} at ${newSlot.time} is already occupied by another class on ${day}.`;
                if (existingRoomConflict.role === 'faculty' && existingRoomConflict.facultyId) {
                    conflictDetail += ` (Faculty ID: ${existingRoomConflict.facultyId})`;
                } else if (existingRoomConflict.role === 'student' && existingRoomConflict.section) {
                    conflictDetail += ` (Section: ${existingRoomConflict.section}, Semester: ${existingRoomConflict.semester})`;
                } else if (existingRoomConflict.role === 'hod' && existingRoomConflict.department) {
                    conflictDetail += ` (Department: ${existingRoomConflict.department})`;
                }
                return res.status(400).json({ message: `Timetable conflict detected: ${conflictDetail}` });
            }
        }

        if (timetable) {
            // Update existing timetable
            Object.assign(timetable, {
                oddEvenTerm,
                duration,
                timetableSlots: formattedSlots // Replace all slots
            });
            await timetable.save();
            res.status(200).json({ message: 'Timetable updated successfully', timetable });
        } else {
            // Create new timetable entry
            timetable = new DailyTimetable({
                day,
                role,
                department,
                semester: role === 'student' ? semester : undefined,
                section: role === 'student' ? section : undefined,
                facultyId: role === 'faculty' ? facultyId : undefined,
                oddEvenTerm,
                duration,
                timetableSlots: formattedSlots
            });
            await timetable.save();
            res.status(201).json({ message: 'Timetable created successfully', timetable });
        }

    } catch (err) {
        console.error('Save timetable error:', err);
        res.status(500).json({ message: 'Save failed', error: err.message });
    }
};

// @desc    Update a single timetable slot inside a DailyTimetable
// @route   PUT /api/timetable/:id/slot/:slotId
// @access  Private/Admin
exports.updateTimetableSlot = async (req, res) => {
    const { id, slotId } = req.params; // id is DailyTimetable _id, slotId is the slot subdocument _id
    const updatedSlotData = req.body; // The data for the slot to be updated

    try {
        const timetable = await DailyTimetable.findById(id);
        if (!timetable) {
            return res.status(404).json({ message: 'Timetable entry not found.' });
        }

        const slotIndex = timetable.timetableSlots.findIndex(slot => slot._id.toString() === slotId);
        if (slotIndex === -1) {
            return res.status(404).json({ message: 'Slot not found within this timetable entry.' });
        }

        const oldSlot = timetable.timetableSlots[slotIndex];
        // Merge old slot data with new data
        const newSlot = {
            ...oldSlot.toObject(), // Convert to plain object to avoid Mongoose issues with direct modification
            ...updatedSlotData,
            _id: oldSlot._id // Ensure _id is preserved
        };

        // --- VALIDATION: Unique timing per daily timetable entry (Rule 1) ---
        const allSlotsExceptCurrent = timetable.timetableSlots.filter(
            slot => slot._id.toString() !== slotId
        );
        const combinedSlotsForThisEntry = [...allSlotsExceptCurrent, newSlot];

        const seenTimesForEntry = new Set();
        for (const slot of combinedSlotsForThisEntry) {
            if (!slot.time) {
                return res.status(400).json({ message: 'Each timetable slot must have a time.' });
            }
            const formattedTime = formatTime(slot.time);
            if (!formattedTime) {
                return res.status(400).json({ message: `Invalid time format: ${slot.time}` });
            }
            if (seenTimesForEntry.has(formattedTime)) {
                return res.status(400).json({
                    message: `Duplicate timing (${slot.time}) found for this timetable entry on ${timetable.day}. Each slot must have a unique time.`,
                });
            }
            seenTimesForEntry.add(formattedTime);
        }

        // --- VALIDATION: Unique room allocation across all timetables for the same day/time (Rule 2) ---
        if (newSlot.roomNo && newSlot.time) {
            const conflictQuery = {
                day: timetable.day,
                'timetableSlots.time': newSlot.time,
                'timetableSlots.roomNo': newSlot.roomNo,
                // Exclude the current DailyTimetable document from conflict checks
                _id: { $ne: timetable._id },
            };

            const existingRoomConflict = await DailyTimetable.findOne(conflictQuery);

            if (existingRoomConflict) {
                let conflictDetail = `Room ${newSlot.roomNo} at ${newSlot.time} is already occupied by another class.`;
                if (existingRoomConflict.role === 'faculty' && existingRoomConflict.facultyId) {
                    conflictDetail += ` (Faculty ID: ${existingRoomConflict.facultyId})`;
                } else if (existingRoomConflict.role === 'student' && existingRoomConflict.section) {
                    conflictDetail += ` (Section: ${existingRoomConflict.section}, Semester: ${existingRoomConflict.semester})`;
                } else if (existingRoomConflict.role === 'hod' && existingRoomConflict.department) {
                    conflictDetail += ` (Department: ${existingRoomConflict.department})`;
                }
                return res.status(400).json({ message: `Timetable conflict detected: ${conflictDetail}` });
            }
        }

        // If validations pass, update the slot
        timetable.timetableSlots[slotIndex] = newSlot;

        await timetable.save();
        res.status(200).json({ message: 'Slot updated successfully', timetable });
    } catch (err) {
        console.error('Update slot error:', err);
        // Handle CastError for invalid IDs
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Timetable or Slot ID format.' });
        }
        res.status(500).json({ message: 'Slot update failed', error: err.message });
    }
};

// @desc    Search timetable based on filters (department, semester, section, role)
// @route   GET /api/timetable/search
// @access  Private (all roles)
exports.searchTimetable = async (req, res) => {
    const { department, semester, section, role } = req.query;
    const query = {};

    if (department) query.department = department;
    if (semester) query.semester = semester;
    if (section) query.section = section;
    if (role) query.role = role;

    try {
        const timetables = await DailyTimetable.find(query); // Corrected: DailyTimetable
        res.json(timetables);
    } catch (err) {
        console.error('Search timetable error:', err);
        res.status(500).json({ message: 'Search failed', error: err.message });
    }
};

// @desc    Delete an entire daily timetable entry by its ID
// @route   DELETE /api/timetable/:id
// @access  Private/Admin
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
        // Handle CastError for invalid IDs
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Timetable ID format.' });
        }
        res.status(500).json({ message: 'Delete failed', error: err.message });
    }
};

// @desc    Delete a specific timetable slot from a daily timetable entry
// @route   DELETE /api/timetable/:dailyTimetableId/slot/:slotId
// @access  Private/Admin
exports.deleteTimetableSlot = async (req, res) => {
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
        // Handle CastError for invalid IDs
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Timetable or Slot ID format.' });
        }
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// @desc    Get faculty timetables filtered by HOD's department
// @route   GET /api/timetable/faculty-by-hod
// @access  Private/HOD
exports.searchFacultyByHOD = async (req, res) => {
    try {
        // Ensure req.user and req.user.department exist
        if (!req.user || !req.user.department) {
            return res.status(403).json({ message: 'Access denied. HOD department not found in user session.' });
        }
        const hodDepartment = req.user.department;
        const facultyTimetables = await DailyTimetable.find({ // Corrected: DailyTimetable
            department: hodDepartment,
            role: 'faculty'
        });
        res.json(facultyTimetables);
    } catch (err) {
        console.error('Fetch faculty timetables error:', err);
        res.status(500).json({ message: 'Failed to fetch faculty timetables', error: err.message });
    }
};

// @desc    Get all faculty timetables for HOD's department
// @route   GET /api/timetable/faculty-timetables
// @access  Private/HOD
exports.getFacultyTimetablesForHOD = async (req, res) => {
    try {
        // This endpoint seems redundant with the getTimetableForDay if role filter is applied.
        // However, keeping it if it serves a specific purpose (e.g., fetching all faculty timetables
        // across all days for an HOD, rather than just for a specific day).
        // If it's meant to be for a specific day, then the getTimetableForDay with 'faculty' role and HOD's department
        // would be more appropriate. Assuming it's for all days for now.
        if (!req.user || !req.user.department) {
            return res.status(403).json({ message: 'Access denied. HOD department not found in user session.' });
        }
        const hodDepartment = req.user.department;
        const facultyTimetables = await DailyTimetable.find({ role: 'faculty', department: hodDepartment }); // Corrected: DailyTimetable
        res.json(facultyTimetables);
    } catch (err) {
        console.error('Fetch faculty timetables for HOD error:', err);
        res.status(500).json({ message: 'Failed to fetch faculty timetables', error: err.message });
    }
};

// @desc    Get user's timetable for a specific day and role
// @route   GET /api/timetable/daily-view (or /api/timetable/day/:day)
// @access  Private (faculty, student, hod)
// NOTE: This getUserTimetableForDay is largely superseded by getTimetableForDay below,
// but is kept if there are specific UI paths using it.
exports.getUserTimetableForDay = async (req, res) => {
    const { day, role, department, semester, section, facultyId } = req.query;

    const query = { day, role, department };

    if (role === 'student') {
        if (!semester || !section) {
            return res.status(400).json({ message: 'Semester and section are required for student timetable.' });
        }
        query.semester = semester;
        query.section = section;
    } else if (role === 'faculty') {
        if (!facultyId) {
            return res.status(400).json({ message: 'Faculty ID is required for faculty timetable.' });
        }
        query.facultyId = facultyId;
    }
    // For HOD, department is sufficient

    try {
        const timetable = await DailyTimetable.findOne(query); // findOne to get the specific entry
        res.json(timetable || { timetableSlots: [] }); // Return an empty array if not found
    } catch (err) {
        console.error('Get user timetable for day error:', err);
        res.status(500).json({ message: 'Could not fetch timetable', error: err.message });
    }
};

// This function can be used for the /day/:day route in routes/timetableRoutes.js
exports.getTimetableForDay = async (req, res) => {
    try {
        const { day } = req.params; // Day comes from URL parameter
        const { role, facultyId } = req.query; // role and optional facultyId from query parameters
        const user = req.user; // This comes from your authMiddleware (MUST BE PRESENT)

        if (!user) {
            return res.status(401).json({ message: 'Authentication required. User not found in session.' });
        }

        const formattedDay = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
        let query = { day: formattedDay };
        let data = [];

        // Determine department based on user's role or query parameter
        const selectedDepartment = req.query.department || user.department;

        if (!selectedDepartment) {
            return res.status(400).json({ message: 'Department is required for timetable retrieval.' });
        }
        query.department = selectedDepartment;

          if (user.role === 'hod') {
            const hodDepartment = user.department; // Use HOD's actual department from auth

            if (facultyId) {
                // Scenario: HOD wants to see a specific faculty's timetable (or their own via filter)
                if (facultyId === user.faculty_id) {
                    // If the selected facultyId filter is the HOD's own facultyId
                    console.log(`HOD: Fetching own timetable based on facultyId filter for ${facultyId} in department ${hodDepartment} on ${formattedDay}`);
                    data = await DailyTimetable.find({
                        day: formattedDay,
                        department: hodDepartment,
                        role: 'hod', // Look for HOD's own entry
                        facultyId: user.faculty_id // Use HOD's actual faculty_id from auth
                    });
                } else {
                    // HOD wants to see another specific faculty's timetable
                    console.log(`HOD: Fetching specific faculty timetable for ${facultyId} in department ${hodDepartment} on ${formattedDay}`);
                    data = await DailyTimetable.find({
                        day: formattedDay,
                        department: hodDepartment,
                        role: 'faculty', // Look for faculty entry
                        facultyId: facultyId // The specific faculty ID from query
                    });
                }
            } else {
                // Scenario: HOD is viewing their own timetable AND all faculty timetables (default view)
                console.log(`HOD: Fetching own and all faculty timetables in department ${hodDepartment} on ${formattedDay}`);
                data = await DailyTimetable.find({
                    day: formattedDay,
                    department: hodDepartment,
                    $or: [
                        { role: 'hod', facultyId: user.faculty_id }, // HOD's personal timetable
                        { role: 'faculty' } // All faculty timetables in this department
                    ]
                });
            }
        
        } else if (user.role === 'faculty') {
            // Faculty can only see their own timetable.
            // Ensure they are trying to view their own timetable or no facultyId is provided.
            const targetFacultyId = facultyId || user.faculty_id;
            if (!targetFacultyId) {
                 return res.status(400).json({ message: 'Faculty ID not provided for faculty role.' });
            }
            if (targetFacultyId !== user.faculty_id) {
                return res.status(403).json({ message: 'Access denied. Faculty can only view their own timetable.' });
            }

            query.role = 'faculty';
            query.facultyId = targetFacultyId;
            data = await DailyTimetable.find(query);

        } else if (user.role === 'student') {
            // Student can only see their own timetable.
            // Ensure section and semester are provided, or use user's details.
            const targetSection = req.query.section || user.section;
            const targetSemester = req.query.semester || user.semester;

            if (!targetSection || !targetSemester) {
                return res.status(400).json({ message: 'Section and Semester are required for student timetable.' });
            }
            if (targetSection !== user.section || targetSemester !== user.semester) {
                 return res.status(403).json({ message: 'Access denied. Students can only view their own timetable.' });
            }

            query.role = 'student';
            query.section = targetSection;
            query.semester = targetSemester;
            data = await DailyTimetable.find(query);
        } else if (user.role === 'admin') {
            // Admin can search for any role's timetable by providing role, department, facultyId, etc.
            // The existing `role`, `department`, `section`, `semester`, `facultyId` from `req.query`
            // should be used to construct the query.
            if (role) query.role = role;
            if (req.query.section) query.section = req.query.section;
            if (req.query.semester) query.semester = req.query.semester;
            if (req.query.facultyId) query.facultyId = req.query.facultyId;

            data = await DailyTimetable.find(query);
        } else {
            return res.status(403).json({ message: 'Access denied. Unsupported user role.' });
        }


        if (!data.length) {
            console.log(`No timetable found for ${formattedDay}, user role: ${user.role}, filters: ${JSON.stringify(query)}`);
        }

        res.json(data);
    } catch (err) {
        console.error('Timetable fetch error:', err);
        res.status(500).json({ message: 'Error fetching timetable', error: err.message });
    }
};