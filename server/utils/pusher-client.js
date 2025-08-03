// server/utils/pusher-client.js
const Pusher = require('pusher');

// Initialize Pusher
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

// Test connection on startup
pusher.trigger('test-channel', 'test-event', {
  message: 'Pusher initialized',
  timestamp: new Date().toISOString()
}).then(() => {
  console.log('Pusher connection successful');
}).catch((error) => {
  console.error('Pusher connection failed:', error);
});

module.exports = pusher;
