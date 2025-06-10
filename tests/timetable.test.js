const mongoose = require('mongoose');
const DailyTimetable = require('../models/DailyTimetable');
const { connectDB } = require('../config/db'); // same connectDB used for Mongo

const testTimetable = {
  day: 'Monday',
  department: 'CSE',
  role: 'faculty',
  facultyId: 'FAC123',
  oddEvenTerm: 'Odd',
  duration: '9am-5pm',
  timetableSlots: [
    {
      time: '9:00 AM',
      courseCode: 'CS101',
      courseName: 'Intro to CS',
      facultyName: 'Dr. Smith',
      roomNo: 'B101',
      roundingsTime: '9:55 AM',
    },
  ],
};

describe('Timetable Model Test', () => {
  beforeAll(async () => {
    await connectDB();
    await DailyTimetable.deleteMany({ facultyId: testTimetable.facultyId });
  });

  afterAll(async () => {
    await DailyTimetable.deleteMany({ facultyId: testTimetable.facultyId });
    await mongoose.connection.close();
  });

  it('should create and save a timetable document', async () => {
    const timetable = new DailyTimetable(testTimetable);
    const saved = await timetable.save();
    expect(saved._id).toBeDefined();
    expect(saved.day).toBe('Monday');
    expect(saved.department).toBe('CSE');
  });

  it('should fail to save if required fields are missing', async () => {
    const timetable = new DailyTimetable({
      role: 'faculty', // missing required fields like `day`
    });

    let err;
    try {
      await timetable.save();
    } catch (error) {
      err = error;
    }

    expect(err).toBeDefined();
  });
});
