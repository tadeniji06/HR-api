const mongoose = require("mongoose");
const User = require("../models/User");
require("dotenv").config();

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("Admin user already exists");
      process.exit(0);
    }

    // Create admin user
    const adminUser = new User({
      name: "System Administrator",
      email: "admin@company.com",
      password: "Admin123!",
      position: "Administrator",
      role: "admin",
    });

    await adminUser.save();
    console.log("Admin user created successfully");
    console.log("Email: admin@company.com");
    console.log("Password: Admin123!");
    console.log("Please change these credentials after first login");

    process.exit(0);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  }
};

createAdminUser();
