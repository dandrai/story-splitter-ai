// api/index.js - Vercel serverless function wrapper
const app = require('../server/index.js');

// Export the Express app as a Vercel function
module.exports = app;
