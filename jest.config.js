module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/config/**', '!src/app.js', '!src/server.js'],
  verbose: true,
};
