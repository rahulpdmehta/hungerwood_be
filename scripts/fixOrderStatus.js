/**
 * Fix Order Status Script
 * Updates all 'pending' orders to 'RECEIVED' status
 */

const path = require('path');
const JsonDB = require('../src/utils/jsonDB');

const ordersDB = new JsonDB('orders.json');

async function fixOrderStatuses() {
  try {
    console.log('🔍 Checking orders with invalid status...\n');
    
    const allOrders = ordersDB.findAll();
    let updatedCount = 0;
    
    allOrders.forEach(order => {
      // Fix lowercase 'pending' to 'RECEIVED'
      if (order.status === 'pending') {
        ordersDB.update(order._id, {
          status: 'RECEIVED',
          statusHistory: [
            {
              status: 'RECEIVED',
              timestamp: order.createdAt || new Date().toISOString(),
              updatedBy: order.user
            }
          ]
        });
        updatedCount++;
        console.log(`✅ Updated order ${order.orderNumber}: pending → RECEIVED`);
      }
    });
    
    console.log(`\n✨ Fixed ${updatedCount} orders with invalid status`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Error fixing order statuses:', error);
    process.exit(1);
  }
}

// Run the script
fixOrderStatuses();
