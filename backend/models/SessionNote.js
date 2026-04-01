import mongoose from 'mongoose';

const sessionNoteSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    practitioner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    presentingConcerns: String,
    sessionGoals: String,
    observations: String,
    interventions: String,
    clientResponse: String,
    homework: String,
    treatmentPlan: String,
    progressNotes: String,
    neuroFeedbackMetrics: {
      baseline: mongoose.Schema.Types.Mixed,
      results: mongoose.Schema.Types.Mixed,
      improvements: String,
    },
    followUpNotes: String,
    nextSessionDate: Date,
    billable: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model('SessionNote', sessionNoteSchema);
