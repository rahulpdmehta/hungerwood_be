/**
 * Server Entry Point
 * Using MongoDB for data persistence
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
    if (config.mongoUri && config.mongoUri !== 'mongodb://localhost:27017/hungerwood') {
      console.log(`✅ Using MongoDB database`);
      console.log(`📊 Database: ${config.mongoUri.replace(/\/\/.*@/, '//***@')}\n`);
    } else {
      console.log(`⚠️  MongoDB not configured - using default URI`);
      console.log(`📊 Set MONGO_URI environment variable to connect to MongoDB\n`);
    }
  });
}
