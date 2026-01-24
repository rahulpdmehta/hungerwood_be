/**
 * MongoDB Database Configuration
 */

const mongoose = require('mongoose');
const config = require('./env');
const logger = require('./logger');

const connectDB = async () => {
  try {
    // Connection options with timeout settings
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      connectTimeoutMS: 10000, // Give up initial connection after 10s
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 1, // Maintain at least 1 socket connection
      retryWrites: true,
      w: 'majority'
    };

    const conn = await mongoose.connect(config.mongoUri, options);

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
      if (err.message.includes('IP')) {
        logger.error('⚠️  This error usually means your IP is not whitelisted in MongoDB Atlas.');
        logger.error('⚠️  Go to MongoDB Atlas → Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)');
      }
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Error connecting to MongoDB:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      logger.error('⚠️  MongoDB Atlas IP Whitelist Issue:');
      logger.error('   1. Go to MongoDB Atlas Dashboard → Network Access');
      logger.error('   2. Click "Add IP Address"');
      logger.error('   3. Click "Allow Access from Anywhere" (0.0.0.0/0)');
      logger.error('   4. Wait 1-2 minutes, then redeploy');
    } else if (error.message.includes('authentication')) {
      logger.error('⚠️  MongoDB Authentication Failed:');
      logger.error('   Check your MONGO_URI username and password');
    } else if (error.message.includes('timeout')) {
      logger.error('⚠️  MongoDB Connection Timeout:');
      logger.error('   - Check if your IP is whitelisted in MongoDB Atlas');
      logger.error('   - Verify MONGO_URI is set correctly in Vercel environment variables');
      logger.error('   - Check MongoDB Atlas cluster status');
    }
    
    // In development, don't exit - allow app to continue (Mongoose will buffer operations)
    // In production/Vercel, exit if connection fails
    if (config.nodeEnv === 'production' || process.env.VERCEL) {
      logger.error('❌ Exiting due to MongoDB connection failure in production');
      process.exit(1);
    }
    // Re-throw error so caller can handle it
    throw error;
  }
};

module.exports = connectDB;
