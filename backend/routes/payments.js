import express from 'express';
import Payment from '../models/Payment.js';
import Client from '../models/Client.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get all payments
router.get('/', auth, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('client', 'firstName lastName')
      .populate('invoice', 'invoiceNumber totalAmount')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      data: {
        payments,
        total: await Payment.countDocuments(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get payment by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('client')
      .populate('invoice');

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create payment
router.post('/', auth, async (req, res) => {
  try {
    const { clientId, invoiceId, amount, paymentMethod, notes } = req.body;

    // Validate required fields
    if (!clientId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Client ID and amount are required',
      });
    }

    // Verify client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
      });
    }

    // Verify invoice exists if provided
    if (invoiceId) {
      const Invoice = await import('../models/Invoice.js');
      const invoice = await Invoice.default.findById(invoiceId);
      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found',
        });
      }
    }

    const payment = new Payment({
      client: clientId,
      invoice: invoiceId || null,
      amount,
      paymentMethod: paymentMethod || 'cash',
      status: 'completed',
      notes,
      processedDate: new Date(),
    });

    await payment.save();
    await payment.populate('client', 'firstName lastName');
    await payment.populate('invoice', 'invoiceNumber totalAmount');

    res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update payment
router.put('/:id', auth, async (req, res) => {
  try {
    const { amount, paymentMethod, status, notes } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    if (amount !== undefined) payment.amount = amount;
    if (paymentMethod !== undefined) payment.paymentMethod = paymentMethod;
    if (status !== undefined) payment.status = status;
    if (notes !== undefined) payment.notes = notes;

    await payment.save();
    await payment.populate('client', 'firstName lastName');
    await payment.populate('invoice', 'invoiceNumber totalAmount');

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete payment
router.delete('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    res.json({
      success: true,
      message: 'Payment deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
