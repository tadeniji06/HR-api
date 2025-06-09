const express = require("express");
const WeeklyReport = require("../models/WeeklyReport");
const { auth } = require("../middleware/auth");
const { body, validationResult } = require("express-validator");
const PDFDocument = require("pdfkit");

const router = express.Router();

// Get current week dates
const getCurrentWeekDates = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  return {
    start: new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate()
    ),
    end: new Date(
      friday.getFullYear(),
      friday.getMonth(),
      friday.getDate(),
      23,
      59,
      59
    ),
  };
};

router.post(
  "/",
  [auth],
  [
    body("brand").trim().notEmpty().withMessage("Brand is required"),
    body("deliverables")
      .isArray({ min: 1 })
      .withMessage("At least one deliverable is required"),
    body("nextWeekTargets")
      .isArray({ min: 1 })
      .withMessage("At least one target for next week is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const {
        brand,
        deliverables,
        nextWeekTargets,
        additionalNotes,
        kpis,
      } = req.body;
      const weekDates = getCurrentWeekDates();

      // 🆕 Always create a new report — don't check if one already exists
      const newReport = new WeeklyReport({
        userId: req.user._id,
        weekStartDate: weekDates.start,
        weekEndDate: weekDates.end,
        brand,
        deliverables,
        nextWeekTargets,
        additionalNotes: additionalNotes || "",
        kpis: kpis || {},
        status: "Submitted",
        submittedAt: new Date(),
      });

      await newReport.save();
      await newReport.populate("userId", "name email position");

      res.json({
        message: "Weekly report submitted successfully",
        report: newReport,
      });
    } catch (error) {
      console.error("Report creation error:", error);
      res
        .status(500)
        .json({ error: "Server error while creating report" });
    }
  }
);

// Get user's reports
router.get("/my-reports", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reports = await WeeklyReport.find({ userId: req.user._id })
      .sort({ weekStartDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email position")
      .populate("reviewedBy", "name");

    const total = await WeeklyReport.countDocuments({
      userId: req.user._id,
    });

    res.json({
      reports,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get reports error:", error);
    res.status(500).json({ error: "Server error while fetching reports" });
  }
});

// Get current week report
router.get("/current-week", auth, async (req, res) => {
  try {
    const weekDates = getCurrentWeekDates();

    const report = await WeeklyReport.findOne({
      userId: req.user._id,
      weekStartDate: weekDates.start,
      weekEndDate: weekDates.end,
    }).populate("userId", "name email position");

    res.json({ report });
  } catch (error) {
    console.error("Get current week report error:", error);
    res
      .status(500)
      .json({ error: "Server error while fetching current week report" });
  }
});

// Export report as PDF
router.get("/:reportId/export", auth, async (req, res) => {
  try {
    const report = await WeeklyReport.findOne({
      _id: req.params.reportId,
      userId: req.user._id,
    }).populate("userId", "name email position");

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Create PDF
    const doc = new PDFDocument();
    const filename = `Weekly_Report_${report.userId.name.replace(
      /\s+/g,
      "_"
    )}_${report.weekStartDate.toISOString().split("T")[0]}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    doc.pipe(res);

    // PDF Content
    doc.fontSize(20).text("Weekly Report", 50, 50);
    doc.fontSize(12);

    doc.text(`Employee: ${report.userId.name}`, 50, 100);
    doc.text(`Position: ${report.userId.position}`, 50, 120);
    doc.text(`Email: ${report.userId.email}`, 50, 140);
    doc.text(
      `Week: ${report.weekStartDate.toDateString()} - ${report.weekEndDate.toDateString()}`,
      50,
      160
    );
    doc.text(`Brand: ${report.brand}`, 50, 180);
    doc.text(`Status: ${report.status}`, 50, 200);

    // Deliverables
    doc.fontSize(14).text("Deliverables Completed:", 50, 240);
    doc.fontSize(12);
    let yPos = 260;
    report.deliverables.forEach((deliverable, index) => {
      doc.text(`${index + 1}. ${deliverable.title}`, 70, yPos);
      doc.text(
        `   Description: ${deliverable.description}`,
        70,
        yPos + 15
      );
      doc.text(`   Status: ${deliverable.status}`, 70, yPos + 30);
      yPos += 60;
    });

    // Next Week Targets
    yPos += 20;
    doc.fontSize(14).text("Next Week Targets:", 50, yPos);
    doc.fontSize(12);
    yPos += 20;
    report.nextWeekTargets.forEach((target, index) => {
      doc.text(`${index + 1}. ${target.title}`, 70, yPos);
      doc.text(`   Description: ${target.description}`, 70, yPos + 15);
      doc.text(
        `   Due Date: ${new Date(target.dueDate).toDateString()}`,
        70,
        yPos + 30
      );
      doc.text(`   Priority: ${target.priority}`, 70, yPos + 45);
      yPos += 70;
    });

    // KPIs
    if (report.kpis && Object.keys(report.kpis).length > 0) {
      yPos += 20;
      doc.fontSize(14).text("KPIs:", 50, yPos);
      doc.fontSize(12);
      yPos += 20;

      if (report.kpis.engagementRate)
        doc.text(
          `Engagement Rate: ${report.kpis.engagementRate}%`,
          70,
          yPos
        ),
          (yPos += 20);
      if (report.kpis.reach)
        doc.text(`Reach: ${report.kpis.reach}`, 70, yPos), (yPos += 20);
      if (report.kpis.conversions)
        doc.text(`Conversions: ${report.kpis.conversions}`, 70, yPos),
          (yPos += 20);
    }

    // Additional Notes
    if (report.additionalNotes) {
      yPos += 20;
      doc.fontSize(14).text("Additional Notes:", 50, yPos);
      doc.fontSize(12).text(report.additionalNotes, 70, yPos + 20);
    }

    doc.end();
  } catch (error) {
    console.error("PDF export error:", error);
    res.status(500).json({ error: "Server error while exporting PDF" });
  }
});

module.exports = router;
