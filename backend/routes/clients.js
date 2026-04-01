import express from 'express';
import { body, validationResult, param } from 'express-validator';
import Client from '../models/Client.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/clients
// @desc    Get all clients for the logged-in user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const query = req.user.role === 'admin' 
      ? {}
      : { practitioner: req.user.id };

    const clients = await Client.find(query)
      .populate('practitioner', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: clients.length,
      clients,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/clients/:id
// @desc    Get a specific client
// @access  Private
router.get('/:id', protect, param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const client = await Client.findById(req.params.id)
      .populate('practitioner', 'name email phone specializations');

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Check authorization
    if (client.practitioner._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this client' });
    }

    res.status(200).json({ success: true, client });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/clients
// @desc    Create a new client
// @access  Private
router.post(
  '/',
  protect,
  [
    body('firstName', 'First name is required').notEmpty().trim(),
    body('lastName', 'Last name is required').notEmpty().trim(),
    body('phone', 'Valid phone number is required').notEmpty().trim(),
    body('email', 'Valid email is required').isEmail().optional({ checkFalsy: true }),
    body('dateOfBirth', 'Valid date is required').isISO8601().optional({ checkFalsy: true }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const clientData = {
        ...req.body,
        practitioner: req.user.id,
      };

      const client = new Client(clientData);
      await client.save();

      await client.populate('practitioner', 'name email');

      res.status(201).json({
        success: true,
        message: 'Client created successfully',
        client,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @route   PUT /api/clients/:id
// @desc    Update a client
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
      let client = await Client.findById(req.params.id);

      if (!client) {
        return res.status(404).json({ success: false, message: 'Client not found' });
      }

      // Check authorization
      if (client.practitioner.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorized to update this client' });
      }

      // Update client
      client = await Client.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate('practitioner', 'name email');

      res.status(200).json({
        success: true,
        message: 'Client updated successfully',
        client,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @route   DELETE /api/clients/:id
// @desc    Delete a client (soft delete by archiving)
// @access  Private
router.delete('/:id', protect, param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Check authorization
    if (client.practitioner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this client' });
    }

    // Soft delete by archiving
    client.status = 'archived';
    await client.save();

    res.status(200).json({
      success: true,
      message: 'Client archived successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/clients/search/:query
// @desc    Search clients by name or email
// @access  Private
router.get('/search/:query', protect, async (req, res) => {
  try {
    const searchQuery = req.params.query;
    const query = req.user.role === 'admin'
      ? {
          $or: [
            { firstName: { $regex: searchQuery, $options: 'i' } },
            { lastName: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } },
          ],
        }
      : {
          practitioner: req.user.id,
          $or: [
            { firstName: { $regex: searchQuery, $options: 'i' } },
            { lastName: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } },
          ],
        };

    const clients = await Client.find(query)
      .populate('practitioner', 'name')
      .limit(10);

    res.status(200).json({
      success: true,
      count: clients.length,
      clients,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
