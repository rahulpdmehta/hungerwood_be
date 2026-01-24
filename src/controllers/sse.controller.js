/**
 * SSE Controller
 * Handles Server-Sent Events for real-time order status updates
 */

const orderEventManager = require('../services/event.service');
const JsonDB = require('../utils/jsonDB');
const logger = require('../config/logger');
const { getCurrentISO } = require('../utils/dateFormatter');
const config = require('../config/env');

const ordersDB = new JsonDB('orders.json');

/**
 * Stream order status updates via SSE
 * @route GET /api/orders/:id/stream
 * @access Public (with optional authentication)
 */
exports.streamOrderStatus = async (req, res) => {
    const { id } = req.params;

    try {
        // Verify order exists
        const order = ordersDB.findById(id);
        if (!order) {
            logger.warn(`SSE connection attempt for non-existent order: ${id}`);
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        logger.info(`SSE connection initiated for order ${id}`);

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

        // CORS headers for SSE
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        // Flush headers immediately
        res.flushHeaders();

        // Send initial order data
        const initialData = {
            type: 'initial',
            order: order,
            timestamp: getCurrentISO()
        };
        res.write(`data: ${JSON.stringify(initialData)}\n\n`);

        // Register client for updates
        const registered = orderEventManager.addClient(id, res);

        if (!registered) {
            logger.error(`Failed to register SSE client for order ${id}: Max connections reached`);
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'Max connections reached' })}\n\n`);
            return res.end();
        }

        // Send connection confirmation
        const confirmData = {
            type: 'connected',
            message: 'Real-time updates active',
            timestamp: getCurrentISO()
        };
        res.write(`data: ${JSON.stringify(confirmData)}\n\n`);

        // Heartbeat to keep connection alive
        const heartbeatInterval = config.sseHeartbeatInterval || 30000;
        const heartbeat = setInterval(() => {
            try {
                // Send comment as heartbeat (doesn't trigger onmessage)
                res.write(`: heartbeat ${Date.now()}\n\n`);
            } catch (error) {
                logger.error(`Heartbeat failed for order ${id}:`, error);
                clearInterval(heartbeat);
                orderEventManager.removeClient(id, res);
            }
        }, heartbeatInterval);

        // Cleanup on client disconnect
        req.on('close', () => {
            logger.info(`SSE client disconnected from order ${id}`);
            clearInterval(heartbeat);
            orderEventManager.removeClient(id, res);
        });

        // Handle errors
        req.on('error', (error) => {
            logger.error(`SSE connection error for order ${id}:`, error);
            clearInterval(heartbeat);
            orderEventManager.removeClient(id, res);
        });

    } catch (error) {
        logger.error(`SSE controller error for order ${id}:`, error);

        // Try to send error message if possible
        try {
            res.write(`data: ${JSON.stringify({
                type: 'error',
                message: 'Internal server error'
            })}\n\n`);
        } catch (writeError) {
            logger.error('Failed to write error to SSE stream:', writeError);
        }

        res.end();
    }
};

/**
 * Get SSE connection statistics
 * @route GET /api/sse/stats
 * @access Private (Admin only)
 */
exports.getSSEStats = async (req, res) => {
    try {
        const stats = {
            totalConnections: orderEventManager.getTotalClientCount(),
            activeOrders: orderEventManager.getActiveOrders(),
            orderCount: orderEventManager.getActiveOrders().length,
            timestamp: getCurrentISO()
        };

        logger.info('SSE stats requested:', stats);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Failed to get SSE stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get SSE statistics'
        });
    }
};
