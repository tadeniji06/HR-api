const express = require('express');
const User = require('../models/User');
const WeeklyReport = require('../models/WeeklyReport');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error while fetching profile' });
  }
});

// Update user profile
router.put('/profile', [auth], [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('position').optional().notEmpty().withMessage('Position cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { name, position } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (position) user.position = position;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        position: user.position,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error while updating profile' });
  }
});

// Get user's dashboard stats
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user's report statistics
    const totalReports = await WeeklyReport.countDocuments({ userId });
    const approvedReports = await WeeklyReport.countDocuments({ userId, status: 'Approved' });
    const pendingReports = await WeeklyReport.countDocuments({ userId, status: 'Submitted' });
    const needsRevision = await WeeklyReport.countDocuments({ userId, status: 'Needs Revision' });

    // Get recent reports
    const recentReports = await WeeklyReport.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('weekStartDate brand status createdAt');

    // Check if current week report exists
    const getCurrentWeekDates = () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      
      return {
        start: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()),
        end: new Date(friday.getFullYear(), friday.getMonth(), friday.getDate(), 23, 59, 59)
      };
    };

    const weekDates = getCurrentWeekDates();
    const currentWeekReport = await WeeklyReport.findOne({
      userId,
      weekStartDate: weekDates.start,
      weekEndDate: weekDates.end
    });

    res.json({
      stats: {
        totalReports,
        approvedReports,
        pendingReports,
        needsRevision,
        approvalRate: totalReports > 0 ? Math.round((approvedReports / totalReports) * 100) : 0
      },
      recentReports,
      currentWeekReport: currentWeekReport ? {
        id: currentWeekReport._id,
        status: currentWeekReport.status,
        brand: currentWeekReport.brand,
        submittedAt: currentWeekReport.submittedAt
      } : null,
      weekDates
    });

  } catch (error) {
    console.error('User dashboard error:', error);
    res.status(500).json({ error: 'Server error while fetching dashboard data' });
  }
});

module.exports = router;