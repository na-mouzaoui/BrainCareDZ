import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: String,
    userEmail: String,
    userRole: {
      type: String,
      enum: ['admin', 'practitioner', 'receptionist'],
    },
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE',
        'READ',
        'UPDATE',
        'DELETE',
        'LOGIN',
        'LOGOUT',
        'PERMISSION_DENIED',
        'SETTINGS_CHANGED',
        'EXPORT',
        'IMPORT',
      ],
    },
    resource: {
      type: String,
      required: true,
      enum: [
        'USER',
        'CLIENT',
        'APPOINTMENT',
        'INVOICE',
        'PAYMENT',
        'SERVICE',
        'SESSION_NOTE',
        'SETTINGS',
        'SYSTEM',
      ],
    },
    resourceId: String,
    resourceName: String,
    changes: mongoose.Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED'],
      default: 'SUCCESS',
    },
    errorMessage: String,
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);

ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1, createdAt: -1 });
ActivityLogSchema.index({ resource: 1, createdAt: -1 });
ActivityLogSchema.index({ createdAt: -1 });

export default mongoose.model('ActivityLog', ActivityLogSchema);
