/**
 * Winston Logger Configuration
 */

const winston = require('winston');
const config = require('./env');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Check if running on Vercel (read-only filesystem)
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// Create transports array
const transports = [
  // Console transport (always available)
  new winston.transports.Console({
    format: consoleFormat
  })
];

// Only add file transports if not on Vercel
if (!isVercel) {
  transports.push(
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  );
}

// Create logger
const logger = winston.createLogger({
  level: config.nodeEnv === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports,
  // Don't exit on error
  exitOnError: false
});

module.exports = logger;
