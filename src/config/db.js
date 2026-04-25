/**
 * MongoDB Database Configuration
 */

const mongoose = require('mongoose');
const config = require('./env');
const logger = require('./logger');

const connectDB = async () => {
  try {
    // Connection options with timeout settings.
    // serverSelectionTimeoutMS was 5000 — too tight for Atlas ap-south-1
    // over residential/coffee-shop wifi (cold replica-set discovery + TLS
    // handshake often exceeds 5s). Staging deploys sit close to the cluster
    // so 5s worked there. 20s gives local dev enough headroom while still
    // failing fast if Atlas is actually down.
    // Pool size raised for the concurrent-user growth path. With Vercel
    // autoscaling each invocation gets its own pool, so don't go wild — but
    // 10/1 was clearly too tight (connections queue under spikes). 50/5 fits
    // a Mongoose 8 driver against M2/M10 Atlas.
    // useNewUrlParser / useUnifiedTopology are no-ops in driver 4+ — dropped.
    const options = {
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 20000,
      maxPoolSize: 50,
      minPoolSize: 5,
      retryWrites: true,
      w: 'majority',
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
