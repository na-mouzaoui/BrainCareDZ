import express from 'express';
import { body, validationResult, param, query } from 'express-validator';
import Appointment from '../models/Appointment.js';
import Client from '../models/Client.js';
import Service from '../models/Service.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/appointments
// @desc    Get appointments (with filtering)
// @access  Private
router.get('/', protect, query('startDate').optional().isISO8601(), query('endDate').optional().isISO8601(), async (req, res) => {
  try {
    let query = {};

    // Filter by practitioner if not admin
    if (req.user.role !== 'admin') {
      query.practitioner = req.user.id;
    }

    // Filter by date range if provided
    if (req.query.startDate || req.query.endDate) {
      query.startTime = {};
      if (req.query.startDate) {
        query.startTime.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.startTime.$lte = new Date(req.query.endDate);
      }
    }

    const appointments = await Appointment.find(query)
      .populate('client', 'firstName lastName email phone')
      .populate('practitioner', 'name email')
      .populate('service', 'name price duration')
      .sort({ startTime: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/appointments/:id
// @desc    Get a specific appointment
// @access  Private
router.get('/:id', protect, param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('client', 'firstName lastName email phone')
      .populate('practitioner', 'name email')
      .populate('service', 'name price duration')
      .populate('sessionNote');

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Check authorization
    if (appointment.practitioner._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this appointment' });
    }

    res.status(200).json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/appointments
// @desc    Create a new appointment
// @access  Private
router.post(
  '/',
  protect,
  [
    body('clientId', 'Valid client ID is required').notEmpty().isMongoId(),
    body('serviceId', 'Valid service ID is required').notEmpty().isMongoId(),
    body('startTime', 'Valid start time is required').isISO8601(),
    body('endTime', 'Valid end time is required').isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { clientId, serviceId, startTime, endTime, notes } = req.body;

      // Verify client exists and belongs to practitioner
      const client = await Client.findById(clientId);
      if (!client) {
        return res.status(404).json({ success: false, message: 'Client not found' });
      }

      if (client.practitioner.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorized to book for this client' });
      }

      // Verify service exists
      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }

      // Check for conflicts
      const conflict = await Appointment.findOne({
        practitioner: req.user.id,
        status: { $in: ['scheduled', 'completed'] },
        $or: [
          {
            startTime: { $lt: new Date(endTime) },
            endTime: { $gt: new Date(startTime) },
          },
        ],
      });

      if (conflict) {
        return res.status(400).json({ success: false, message: 'Time slot conflict with existing appointment' });
      }

      const appointment = new Appointment({
        client: clientId,
        practitioner: req.user.id,
        service: serviceId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        notes,
      });

      await appointment.save();
      await appointment.populate('client', 'firstName lastName email phone');
      await appointment.populate('practitioner', 'name email');
      await appointment.populate('service', 'name price duration');

      res.status(201).json({
        success: true,
        message: 'Appointment created successfully',
        appointment,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @route   PUT /api/appointments/:id
// @desc    Update an appointment
// @access  Private
router.put(
  '/:id',
  protect,
  param('id').isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      let appointment = await Appointment.findById(req.params.id);

      if (!appointment) {
        return res.status(404).json({ success: false, message: 'Appointment not found' });
      }

      // Check authorization
      if (appointment.practitioner.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorized to update this appointment' });
      }

      // Check for conflicts if time is being changed
      if (req.body.startTime || req.body.endTime) {
        const newStart = req.body.startTime ? new Date(req.body.startTime) : appointment.startTime;
        const newEnd = req.body.endTime ? new Date(req.body.endTime) : appointment.endTime;

        const conflict = await Appointment.findOne({
          _id: { $ne: req.params.id },
          practitioner: req.user.id,
          status: { $in: ['scheduled', 'completed'] },
          $or: [
            {
              startTime: { $lt: newEnd },
              endTime: { $gt: newStart },
            },
          ],
        });

        if (conflict) {
          return res.status(400).json({ success: false, message: 'Time slot conflict with existing appointment' });
        }
      }

      appointment = await Appointment.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedAt: new Date() },
        { new: true, runValidators: true }
      )
        .populate('client', 'firstName lastName email phone')
        .populate('practitioner', 'name email')
        .populate('service', 'name price duration');

      res.status(200).json({
        success: true,
        message: 'Appointment updated successfully',
        appointment,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @route   DELETE /api/appointments/:id
// @desc    Cancel an appointment
// @access  Private
router.delete('/:id', protect, param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Check authorization
    if (appointment.practitioner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this appointment' });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/appointments/:id/complete
// @desc    Mark appointment as completed
// @access  Private
router.put('/:id/complete', protect, param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Check authorization
    if (appointment.practitioner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to complete this appointment' });
    }

    appointment.status = 'completed';
    await appointment.save();

    // Update client session count
    await Client.findByIdAndUpdate(
      appointment.client,
      {
        $inc: { sessionCount: 1 },
        lastSessionDate: new Date(),
      }
    );

    await appointment.populate('client', 'firstName lastName email phone');
    await appointment.populate('practitioner', 'name email');
    await appointment.populate('service', 'name price duration');

    res.status(200).json({
      success: true,
      message: 'Appointment marked as completed',
      appointment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @route   GET /api/appointments/availability/:date
// @desc    Get available time slots for a date
// @access  Private
router.get('/availability/:date', protect, async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      practitioner: req.user.id,
      status: { $in: ['scheduled', 'completed'] },
      startTime: { $gte: dayStart, $lte: dayEnd },
    }).sort({ startTime: 1 });

    // Generate available slots (9 AM to 5 PM, 30-minute intervals)
    const slots = [];
    const dayStartTime = new Date(date);
    dayStartTime.setHours(9, 0, 0, 0);
    const dayEndTime = new Date(date);
    dayEndTime.setHours(17, 0, 0, 0);

    for (let time = new Date(dayStartTime); time < dayEndTime; time.setMinutes(time.getMinutes() + 30)) {
      const slotEnd = new Date(time);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30);

      const isBooked = appointments.some((apt) => apt.startTime < slotEnd && apt.endTime > time);

      slots.push({
        startTime: new Date(time),
        endTime: slotEnd,
        available: !isBooked,
      });
    }

    res.status(200).json({
      success: true,
      date,
      slots,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
