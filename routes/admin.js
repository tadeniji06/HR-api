// routes/admin.js
const express = require('express');
const WeeklyReport = require('../models/WeeklyReport');
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Get all reports (admin only)
router.get('/reports', [auth, adminOnly], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const userId = req.query.userId;
    const brand = req.query.brand;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (userId) filter.userId = userId;
    if (brand) filter.brand = new RegExp(brand, 'i');

    const reports = await WeeklyReport.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email position')
      .populate('reviewedBy', 'name');

    const total = await WeeklyReport.countDocuments(filter);

    res.json({
      reports,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Admin get reports error:', error);
    res.status(500).json({ error: 'Server error while fetching reports' });
  }
});

// Update report status and add comments (admin only)
router.put('/reports/:reportId', [auth, adminOnly], [
  body('status').isIn(['Under Review', 'Approved', 'Needs Revision']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { status, adminComments } = req.body;

    const report = await WeeklyReport.findById(req.params.reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    report.status = status;
    report.adminComments = adminComments || '';
    report.reviewedAt = new Date();
    report.reviewedBy = req.user._id;

    await report.save();
    await report.populate('userId', 'name email position');
    await report.populate('reviewedBy', 'name');

    res.json({
      message: 'Report updated successfully',
      report
    });

  } catch (error) {
    console.error('Admin update report error:', error);
    res.status(500).json({ error: 'Server error while updating report' });
  }
});

// Get all users (admin only)
router.get('/users', [auth, adminOnly], async (req, res) => {
  try {
    const users = await User.find({ role: 'staff' })
      .select('-password')
      .sort({ name: 1 });

    res.json({ users });

  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Server error while fetching users' });
  }
});

// Dashboard stats (admin only)
router.get('/dashboard', [auth, adminOnly], async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'staff', isActive: true });
    const totalReports = await WeeklyReport.countDocuments();
    const pendingReports = await WeeklyReport.countDocuments({ status: 'Submitted' });
    const approvedReports = await WeeklyReport.countDocuments({ status: 'Approved' });
    
    // Get recent reports
    const recentReports = await WeeklyReport.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name position');

    // Get reports by status
    const reportsByStatus = await WeeklyReport.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get top performing users (by completed reports)
    const topPerformers = await WeeklyReport.aggregate([
      {
        $match: { status: 'Approved' }
      },
      {
        $group: {
          _id: '$userId',
          reportCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          name: '$user.name',
          position: '$user.position',
          reportCount: 1
        }
      },
      {
        $sort: { reportCount: -1 }
      },
      {
        $limit: 5
      }
    ]);

    res.json({
      stats: {
        totalUsers,
        totalReports,
        pendingReports,
        approvedReports
      },
      recentReports,
      reportsByStatus,
      topPerformers
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Server error while fetching dashboard data' });
  }
});

// Export user data as PDF (admin only)
router.get('/users/:userId/export', [auth, adminOnly], async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const reports = await WeeklyReport.find({ userId: req.params.userId })
      .sort({ weekStartDate: -1 })
      .limit(10);

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    const filename = `User_Report_${user.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    doc.pipe(res);

    // PDF Content
    doc.fontSize(20).text('Employee Performance Report', 50, 50);
    doc.fontSize(12);
    
    doc.text(`Name: ${user.name}`, 50, 100);
    doc.text(`Position: ${user.position}`, 50, 120);
    doc.text(`Email: ${user.email}`, 50, 140);
    doc.text(`Department: ${user.department}`, 50, 160);
    doc.text(`Date Joined: ${user.createdAt.toDateString()}`, 50, 180);
    doc.text(`Report Generated: ${new Date().toDateString()}`, 50, 200);

    // Summary stats
    doc.fontSize(14).text('Summary Statistics:', 50, 240);
    doc.fontSize(12);
    const totalReports = reports.length;
    const approvedReports = reports.filter(r => r.status === 'Approved').length;
    const pendingReports = reports.filter(r => r.status === 'Submitted').length;

    doc.text(`Total Reports Submitted: ${totalReports}`, 70, 260);
    doc.text(`Approved Reports: ${approvedReports}`, 70, 280);
    doc.text(`Pending Reports: ${pendingReports}`, 70, 300);
    doc.text(`Approval Rate: ${totalReports > 0 ? Math.round((approvedReports / totalReports) * 100) : 0}%`, 70, 320);

    // Recent reports summary
    if (reports.length > 0) {
      doc.fontSize(14).text('Recent Reports:', 50, 360);
      doc.fontSize(12);
      let yPos = 380;
      
      reports.slice(0, 5).forEach((report, index) => {
        doc.text(`${index + 1}. Week of ${report.weekStartDate.toDateString()}`, 70, yPos);
        doc.text(`   Brand: ${report.brand}`, 70, yPos + 15);
        doc.text(`   Status: ${report.status}`, 70, yPos + 30);
        doc.text(`   Deliverables: ${report.deliverables.length}`, 70, yPos + 45);
        yPos += 70;
      });
    }

    doc.end();

  } catch (error) {
    console.error('User export error:', error);
    res.status(500).json({ error: 'Server error while exporting user data' });
  }
});

module.exports = router;