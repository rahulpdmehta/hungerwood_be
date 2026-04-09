/**
 * Vercel Serverless Function Entry Point
 * This file is used when deploying to Vercel
 */

// Set Vercel environment flags EARLY before any modules are loaded
// This ensures all file system operations detect Vercel correctly
process.env.VERCEL = '1';
process.env.VERCEL_ENV = process.env.VERCEL_ENV || 'production';

// Also set AWS_LAMBDA_FUNCTION_NAME if not set (for compatibility)
if (!process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.VERCEL) {
  // We're in a serverless environment
  process.env.AWS_LAMBDA_FUNCTION_NAME = 'vercel';
}

console.log('Vercel environment detected:', {
  VERCEL: process.env.VERCEL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  __dirname: __dirname
});

let app;
try {
  console.log('Loading app...');
  app = require('../src/app');
  console.log('App loaded successfully');
} catch (error) {
  console.error('Error loading app:', error);
  console.error('Error stack:', error.stack);
  
  // Export a minimal error handler
  const express = require('express');
  const errorApp = express();
  errorApp.use(express.json());
  errorApp.use((req, res) => {
    console.error('Request failed due to initialization error');
    res.status(500).json({
      success: false,
      message: 'Server initialization error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  });
  app = errorApp;
}

module.exports = app;
