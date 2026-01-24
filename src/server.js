/**
 * Server Entry Point
 * Using JSON files instead of MongoDB
 */

const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');
// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT} in ${config.nodeEnv} mode`);
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ API available at http://localhost:${PORT}/api`);
  console.log(`✅ Using JSON file-based database`);
  console.log(`📁 Data stored in backend/data/ folder\n`);
});
