import express from 'express';
import { body, validationResult, param } from 'express-validator';
import Service from '../models/Service.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/services
// @desc    Get all services
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: services.length,
      services,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/services/:id
// @desc    Get a specific service
// @access  Private
router.get('/:id', protect, param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.status(200).json({ success: true, service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/services
// @desc    Create a new service
// @access  Private/Admin
router.post(
  '/',
  protect,
  authorize('admin', 'practitioner'),
  [
    body('name', 'Service name is required').notEmpty().trim(),
    body('category', 'Valid category is required').isIn(['neurofeedback', 'therapy', 'assessment', 'consultation', 'other']),
    body('price', 'Valid price is required').isFloat({ min: 0 }),
    body('duration', 'Duration in minutes is required').isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const service = new Service(req.body);
      await service.save();

      res.status(201).json({
        success: true,
        message: 'Service created successfully',
        service,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @route   PUT /api/services/:id
// @desc    Update a service
// @access  Private/Admin
router.put(
  '/:id',
  protect,
  authorize('admin', 'practitioner'),
  param('id').isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      let service = await Service.findById(req.params.id);

      if (!service) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }

      service = await Service.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      res.status(200).json({
        success: true,
        message: 'Service updated successfully',
        service,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @route   DELETE /api/services/:id
// @desc    Delete a service (soft delete)
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin', 'practitioner'), param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    // Soft delete by marking as inactive
    service.isActive = false;
    await service.save();

    res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/services/category/:category
// @desc    Get services by category
// @access  Private
router.get('/category/:category', protect, async (req, res) => {
  try {
    const services = await Service.find({
      category: req.params.category,
      isActive: true,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: services.length,
      services,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
