import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a service name'],
      trim: true,
    },
    description: String,
    category: {
      type: String,
      enum: ['neurofeedback', 'therapy', 'assessment', 'consultation', 'other'],
      required: true,
    },
    duration: {
      type: Number, // in minutes
      required: true,
      default: 60,
    },
    price: {
      type: Number,
      required: [true, 'Please provide a price'],
      min: 0,
    },
    isActive: {
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

export default mongoose.model('Service', serviceSchema);
