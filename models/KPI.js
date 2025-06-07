const mongoose = require('mongoose');

const kpiSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WeeklyReport',
    required: true
  },
  metrics: {
    socialMediaFollowers: {
      type: Number,
      default: 0
    },
    engagementRate: {
      type: Number,
      default: 0
    },
    reach: {
      type: Number,
      default: 0
    },
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    },
    contentCreated: {
      type: Number,
      default: 0
    },
    campaignsLaunched: {
      type: Number,
      default: 0
    }
  },
  customKPIs: [{
    name: {
      type: String,
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      default: ''
    },
    target: {
      type: Number,
      default: 0
    }
  }],
  period: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('KPI', kpiSchema);