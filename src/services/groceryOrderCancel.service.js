const walletService = require('./wallet.service');
const logger = require('../config/logger');

/**
 * Issue wallet + Razorpay refunds for a cancelled grocery order, then
 * mark its payment status as REFUNDED if applicable.
 *
 * Idempotent if the caller has already saved status=CANCELLED — this only
 * deals with refunds and payment-status mutation.
 */
async function refundCancelledOrder(order) {
  if (order.walletUsed > 0) {
    try {
      await walletService.refundToWallet(
        order.user,
        order.walletUsed,
        order._id,
        `Refund for cancelled grocery order #${order.orderId}`,
        { section: 'grocery' }
      );
    } catch (e) {
      logger.error('grocery cancel: wallet refund failed', e);
    }
  }

  if (
    order.paymentMethod === 'RAZORPAY' &&
    order.paymentStatus === 'COMPLETED' &&
    order.paymentDetails?.razorpayPaymentId
  ) {
    const paidViaRazorpay = order.totalAmount - (order.walletUsed || 0);
    if (paidViaRazorpay > 0) {
      try {
        const Razorpay = require('razorpay');
        const config = require('../config/env');
        if (config.razorpayKeyId && config.razorpayKeySecret) {
          const rp = new Razorpay({
            key_id: config.razorpayKeyId,
            key_secret: config.razorpayKeySecret,
          });
          const refund = await rp.payments.refund(
            order.paymentDetails.razorpayPaymentId,
            { amount: Math.round(paidViaRazorpay * 100) }
          );
          logger.info(`↩️ Razorpay refund on cancel: ${refund.id} for grocery order ${order.orderId}`);
          order.paymentStatus = 'REFUNDED';
        } else {
          logger.error(`CRITICAL: Cannot refund grocery order ${order.orderId} — Razorpay not configured`);
        }
      } catch (refErr) {
        logger.error(`CRITICAL: Razorpay refund failed for cancelled grocery order ${order.orderId}`, refErr);
      }
    }
  }
}

module.exports = { refundCancelledOrder };
