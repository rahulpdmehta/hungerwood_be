/**
 * Server Entry Point
 * Using JSON files instead of MongoDB
 * 
 * Supports both:
 * - Local development: starts Express server
 * - Vercel deployment: exports app as serverless function
 */

const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');

// Check if running on Vercel
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

if (isVercel) {
  // Export app for Vercel serverless function
  module.exports = app;
} else {
  // Start server for local development
  const PORT = config.port;
  app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT} in ${config.nodeEnv} mode`);
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`✅ API available at http://localhost:${PORT}/api`);
    console.log(`✅ Using JSON file-based database`);
    console.log(`📁 Data stored in backend/data/ folder\n`);
  });
}
