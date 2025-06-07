const mongoose = require('mongoose');

const deliverableSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Completed', 'In Progress', 'Pending', 'Cancelled'],
    default: 'Completed'
  },
  completionDate: {
    type: Date,
    default: Date.now
  }
});

const targetSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  }
});

const weeklyReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  weekStartDate: {
    type: Date,
    required: true
  },
  weekEndDate: {
    type: Date,
    required: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  deliverables: [deliverableSchema],
  nextWeekTargets: [targetSchema],
  additionalNotes: {
    type: String,
    default: ''
  },
  kpis: {
    engagementRate: {
      type: Number,
      default: 0
    },
    reach: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    },
    customMetrics: [{
      name: String,
      value: Number,
      unit: String
    }]
  },
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Under Review', 'Approved', 'Needs Revision'],
    default: 'Draft'
  },
  adminComments: {
    type: String,
    default: ''
  },
  submittedAt: {
    type: Date
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient queries
weeklyReportSchema.index({ userId: 1, weekStartDate: -1 });
weeklyReportSchema.index({ status: 1 });
weeklyReportSchema.index({ brand: 1 });

module.exports = mongoose.model('WeeklyReport', weeklyReportSchema);