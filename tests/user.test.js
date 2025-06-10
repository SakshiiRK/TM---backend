const request = require("supertest");
const app = require("../app"); // Express app
const mongoose = require("mongoose");
const User = require("../models/User");
const { connectDB } = require("../config/db"); // real MongoDB connection (not memory server)

const timestamp = Date.now();
const testUser = {
  name: "John Doe",
  email: `john_${timestamp}@example.com`,
  password: "secure123",
  role: "student",
  department: "CSE",
  semester: "5",
  section: "A",
};

describe("User Model Test", () => {
  beforeAll(async () => {
    await connectDB();
    await User.deleteOne({ email: testUser.email }); // cleanup if rerun
  });

  afterAll(async () => {
    await User.deleteOne({ email: testUser.email }); // remove test user
    await mongoose.connection.close();
  });

  it("should create & save a user successfully", async () => {
    const user = new User(testUser);
    const savedUser = await user.save();
    expect(savedUser._id).toBeDefined();
    expect(savedUser.name).toBe(testUser.name);
  });

  it("should not save user without required fields", async () => {
    const user = new User({ email: "missing@example.com" });
    let err;
    try {
      await user.save();
    } catch (error) {
      err = error;
    }
    expect(err).toBeDefined();
  });
});
