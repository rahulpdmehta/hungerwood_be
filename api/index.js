/**
 * Vercel Serverless Function Entry Point
 * This file is used when deploying to Vercel
 */

try {
  const app = require('../src/app');
  module.exports = app;
} catch (error) {
  console.error('Error loading app:', error);
  // Export a minimal error handler
  const express = require('express');
  const errorApp = express();
  errorApp.use((req, res) => {
    res.status(500).json({
      success: false,
      message: 'Server initialization error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  });
  module.exports = errorApp;
}
