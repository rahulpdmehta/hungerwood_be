/**
 * Order Event Manager Service
 * Manages Server-Sent Events (SSE) connections for real-time order status updates
 */

const EventEmitter = require('events');
const logger = require('../config/logger');

class OrderEventManager extends EventEmitter {
    constructor() {
        super();
        this.clients = new Map(); // orderId -> Set of response objects
        this.maxClients = 100;

        logger.info('OrderEventManager initialized');
    }

    /**
     * Add a client to receive updates for a specific order
     * @param {string} orderId - The order ID to subscribe to
     * @param {object} res - Express response object for SSE
     */
    addClient(orderId, res) {
        if (!this.clients.has(orderId)) {
            this.clients.set(orderId, new Set());
        }

        const clientSet = this.clients.get(orderId);

        // Check max connections
        if (clientSet.size >= this.maxClients) {
            logger.warn(`Max connections reached for order ${orderId}`);
            return false;
        }

        clientSet.add(res);
        logger.info(`Client connected to order ${orderId}. Total clients: ${clientSet.size}`);
        return true;
    }

    /**
     * Remove a client from receiving updates
     * @param {string} orderId - The order ID
     * @param {object} res - Express response object
     */
    removeClient(orderId, res) {
        if (this.clients.has(orderId)) {
            const clientSet = this.clients.get(orderId);
            clientSet.delete(res);

            logger.info(`Client disconnected from order ${orderId}. Remaining: ${clientSet.size}`);

            // Clean up empty sets
            if (clientSet.size === 0) {
                this.clients.delete(orderId);
                logger.info(`No more clients for order ${orderId}, cleaned up`);
            }
        }
    }

    /**
     * Broadcast order update to all connected clients for that order
     * @param {string} orderId - The order ID
     * @param {object} orderData - The order data to broadcast
     */
    broadcastOrderUpdate(orderId, orderData) {
        if (!this.clients.has(orderId)) {
            logger.debug(`No clients connected for order ${orderId}`);
            return;
        }

        const clientSet = this.clients.get(orderId);
        const message = `data: ${JSON.stringify(orderData)}\n\n`;

        logger.info(`Broadcasting update to ${clientSet.size} clients for order ${orderId}`);

        // Send to all connected clients
        clientSet.forEach(res => {
            try {
                res.write(message);
            } catch (error) {
                logger.error(`Failed to send update to client for order ${orderId}:`, error);
                // Remove failed client
                this.removeClient(orderId, res);
            }
        });
    }

    /**
     * Get the number of active connections for an order
     * @param {string} orderId - The order ID
     * @returns {number} Number of active connections
     */
    getClientCount(orderId) {
        return this.clients.has(orderId) ? this.clients.get(orderId).size : 0;
    }

    /**
     * Get total number of active connections across all orders
     * @returns {number} Total number of connections
     */
    getTotalClientCount() {
        let total = 0;
        this.clients.forEach(clientSet => {
            total += clientSet.size;
        });
        return total;
    }

    /**
     * Get all active order IDs with connections
     * @returns {Array<string>} Array of order IDs
     */
    getActiveOrders() {
        return Array.from(this.clients.keys());
    }
}

// Export singleton instance
module.exports = new OrderEventManager();
