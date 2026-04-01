import express from 'express';
import { body, validationResult, param } from 'express-validator';
import SessionNote from '../models/SessionNote.js';
import Appointment from '../models/Appointment.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/session-notes
// @desc    Get all session notes
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const query = req.user.role === 'admin' 
      ? {}
      : { practitioner: req.user.id };

    const notes = await SessionNote.find(query)
      .populate('client', 'firstName lastName')
      .populate('practitioner', 'name')
      .populate('appointment')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: notes.length,
      notes,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/session-notes/:id
// @desc    Get a specific session note
// @access  Private
router.get('/:id', protect, param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const note = await SessionNote.findById(req.params.id)
      .populate('client', 'firstName lastName email phone')
      .populate('practitioner', 'name email')
      .populate('appointment');

    if (!note) {
      return res.status(404).json({ success: false, message: 'Session note not found' });
    }

    // Check authorization
    if (note.practitioner._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this note' });
    }

    res.status(200).json({ success: true, note });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/session-notes
// @desc    Create a new session note
// @access  Private
router.post(
  '/',
  protect,
  [
    body('clientId', 'Valid client ID is required').notEmpty().isMongoId(),
    body('appointmentId', 'Valid appointment ID is required').notEmpty().isMongoId(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { clientId, appointmentId, ...noteData } = req.body;

      // Verify appointment exists
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({ success: false, message: 'Appointment not found' });
      }

      // Check authorization
      if (appointment.practitioner.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorized to create notes for this appointment' });
      }

      const sessionNote = new SessionNote({
        ...noteData,
        client: clientId,
        practitioner: req.user.id,
        appointment: appointmentId,
      });

      await sessionNote.save();
      await sessionNote.populate('client', 'firstName lastName');
      await sessionNote.populate('practitioner', 'name');
      await sessionNote.populate('appointment');

      // Link session note to appointment
      appointment.sessionNote = sessionNote._id;
      await appointment.save();

      res.status(201).json({
        success: true,
        message: 'Session note created successfully',
        note: sessionNote,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @route   PUT /api/session-notes/:id
// @desc    Update a session note
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
      let note = await SessionNote.findById(req.params.id);

      if (!note) {
        return res.status(404).json({ success: false, message: 'Session note not found' });
      }

      // Check authorization
      if (note.practitioner.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorized to update this note' });
      }

      note = await SessionNote.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedAt: new Date() },
        { new: true, runValidators: true }
      )
        .populate('client', 'firstName lastName')
        .populate('practitioner', 'name')
        .populate('appointment');

      res.status(200).json({
        success: true,
        message: 'Session note updated successfully',
        note,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @route   DELETE /api/session-notes/:id
// @desc    Delete a session note
// @access  Private
router.delete('/:id', protect, param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const note = await SessionNote.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ success: false, message: 'Session note not found' });
    }

    // Check authorization
    if (note.practitioner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this note' });
    }

    await SessionNote.findByIdAndDelete(req.params.id);

    // Remove reference from appointment
    if (note.appointment) {
      await Appointment.findByIdAndUpdate(note.appointment, { sessionNote: null });
    }

    res.status(200).json({
      success: true,
      message: 'Session note deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/session-notes/client/:clientId
// @desc    Get all session notes for a client
// @access  Private
router.get('/client/:clientId', protect, param('clientId').isMongoId(), async (req, res) => {
  try {
    const query = {
      client: req.params.clientId,
    };

    if (req.user.role !== 'admin') {
      query.practitioner = req.user.id;
    }

    const notes = await SessionNote.find(query)
      .populate('practitioner', 'name')
      .populate('appointment')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: notes.length,
      notes,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
