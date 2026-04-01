import express from 'express';
import { body, validationResult, param, query } from 'express-validator';
import Invoice from '../models/Invoice.js';
import Appointment from '../models/Appointment.js';
import Client from '../models/Client.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Generate invoice number
function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `INV-${year}${month}-${random}`;
}

// @route   GET /api/invoices
// @desc    Get invoices with filtering
// @access  Private
router.get('/', protect, query('status').optional(), async (req, res) => {
  try {
    let query = {};

    if (req.user.role !== 'admin') {
      query.practitioner = req.user.id;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    const invoices = await Invoice.find(query)
      .populate('client', 'firstName lastName email')
      .populate('practitioner', 'name email')
      .populate('appointments')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: invoices.length,
      invoices,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/invoices/:id
// @desc    Get a specific invoice
// @access  Private
router.get('/:id', protect, param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client', 'firstName lastName email phone')
      .populate('practitioner', 'name email')
      .populate('appointments');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.practitioner._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this invoice' });
    }

    res.status(200).json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/invoices
// @desc    Create a new invoice
// @access  Private
router.post(
  '/',
  protect,
  [
    body('clientId', 'Valid client ID is required').notEmpty().isMongoId(),
    body('appointmentIds', 'At least one appointment is required')
      .isArray({ min: 1 }),
    body('dueDate', 'Due date is required').isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { clientId, appointmentIds, dueDate, notes } = req.body;

      // Verify client exists
      const client = await Client.findById(clientId);
      if (!client) {
        return res.status(404).json({ success: false, message: 'Client not found' });
      }

      // Verify all appointments exist and calculate total
      const appointments = await Appointment.find({ _id: { $in: appointmentIds } })
        .populate('service');

      if (appointments.length === 0) {
        return res.status(404).json({ success: false, message: 'No appointments found' });
      }

      // Calculate total amount
      const items = appointments.map((apt) => ({
        description: apt.service.name,
        amount: apt.service.price,
        quantity: 1,
        appointmentId: apt._id,
      }));

      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      const tax = Math.round(subtotal * 0.1 * 100) / 100; // 10% tax
      const total = subtotal + tax;

      const invoice = new Invoice({
        invoiceNumber: generateInvoiceNumber(),
        client: clientId,
        practitioner: req.user.id,
        appointments: appointmentIds,
        items,
        subtotal,
        tax,
        total,
        dueDate: new Date(dueDate),
        notes,
        status: 'draft',
      });

      await invoice.save();
      await invoice.populate('client', 'firstName lastName email');
      await invoice.populate('practitioner', 'name email');

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        invoice,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @route   PUT /api/invoices/:id
// @desc    Update an invoice
// @access  Private
router.put('/:id', protect, param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    let invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.practitioner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this invoice' });
    }

    invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
      .populate('client', 'firstName lastName email')
      .populate('practitioner', 'name email');

    res.status(200).json({
      success: true,
      message: 'Invoice updated successfully',
      invoice,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/invoices/:id/send
// @desc    Send invoice to client
// @access  Private
router.put('/:id/send', protect, param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    let invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.practitioner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to send this invoice' });
    }

    // TODO: Implement email sending here
    // For now, just update the status
    invoice.status = 'sent';
    invoice.sentDate = new Date();
    await invoice.save();

    await invoice.populate('client', 'firstName lastName email');
    await invoice.populate('practitioner', 'name email');

    res.status(200).json({
      success: true,
      message: 'Invoice sent successfully',
      invoice,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/invoices/:id/mark-paid
// @desc    Mark invoice as paid
// @access  Private
router.put('/:id/mark-paid', protect, param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    let invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.practitioner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this invoice' });
    }

    invoice.status = 'paid';
    invoice.paidDate = new Date();
    await invoice.save();

    await invoice.populate('client', 'firstName lastName email');
    await invoice.populate('practitioner', 'name email');

    res.status(200).json({
      success: true,
      message: 'Invoice marked as paid',
      invoice,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/invoices/:id
// @desc    Delete an invoice
// @access  Private
router.delete('/:id', protect, param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.practitioner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this invoice' });
    }

    // Only allow deletion of draft invoices
    if (invoice.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft invoices can be deleted',
      });
    }

    await Invoice.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/invoices/client/:clientId
// @desc    Get invoices for a specific client
// @access  Private
router.get('/client/:clientId', protect, param('clientId').isMongoId(), async (req, res) => {
  try {
    const query = {
      client: req.params.clientId,
    };

    if (req.user.role !== 'admin') {
      query.practitioner = req.user.id;
    }

    const invoices = await Invoice.find(query)
      .populate('practitioner', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: invoices.length,
      invoices,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
