// client/src/services/WebSocketService.js
import Pusher from 'pusher-js';

class WebSocketService {
  constructor() {
    this.pusher = null;
    this.channel = null;
    this.callbacks = new Map();
    this.retryCount = 0;
    this.maxRetries = 3;
    this.reconnectTimeout = null;
  }

  async connect(storyId, callbacks = {}) {
    try {
      // Store callbacks
      this.callbacks = new Map(Object.entries(callbacks));
      
      // Enable Pusher logging in development
      if (process.env.NODE_ENV === 'development') {
        Pusher.logToConsole = true;
      }

      // Initialize Pusher with proper auth configuration
      this.pusher = new Pusher(process.env.REACT_APP_PUSHER_KEY, {
        cluster: process.env.REACT_APP_PUSHER_CLUSTER,
        encrypted: true,
        authEndpoint: 'http://localhost:3001/api/pusher/auth',
        auth: {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      });

      // Set up connection state handlers
      this.pusher.connection.bind('connected', () => {
        console.log('Connected to Pusher');
        this.retryCount = 0;
        if (this.callbacks.has('onConnect')) {
          this.callbacks.get('onConnect')();
        }
      });

      this.pusher.connection.bind('error', (error) => {
        console.error('Pusher connection error:', error);
        this.handleConnectionError();
      });

      this.pusher.connection.bind('disconnected', () => {
        console.log('Disconnected from Pusher');
        if (this.callbacks.has('onDisconnect')) {
          this.callbacks.get('onDisconnect')();
        }
      });

      // Subscribe to channel
      const channelName = `presence-story-${storyId}`;
      this.channel = this.pusher.subscribe(channelName);

      // Handle subscription success
      this.channel.bind('pusher:subscription_succeeded', (members) => {
        console.log('Successfully subscribed to channel:', channelName);
        console.log('Members:', members);
        
        if (this.callbacks.has('onUserPresence')) {
          const users = [];
          members.each((member) => {
            users.push(member.info);
          });
          this.callbacks.get('onUserPresence')(users);
        }
      });

      // Handle subscription error
      this.channel.bind('pusher:subscription_error', (error) => {
        console.error('Subscription error:', error);
        this.handleConnectionError();
      });

      // Set up event listeners
      this.setupEventListeners();

      return true;
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.handleConnectionError();
      return false;
    }
  }

  setupEventListeners() {
    if (!this.channel) return;

    // Member added
    this.channel.bind('pusher:member_added', (member) => {
      console.log('Member added:', member);
      if (this.callbacks.has('onUserJoined')) {
        this.callbacks.get('onUserJoined')(member.info);
      }
    });

    // Member removed
    this.channel.bind('pusher:member_removed', (member) => {
      console.log('Member removed:', member);
      if (this.callbacks.has('onUserLeft')) {
        this.callbacks.get('onUserLeft')(member.id);
      }
    });

    // Custom events
    this.channel.bind('story-updated', (data) => {
      console.log('Story updated:', data);
      if (this.callbacks.has('onStoryUpdate')) {
        this.callbacks.get('onStoryUpdate')(data);
      }
    });

    this.channel.bind('user-typing', (data) => {
      console.log('User typing:', data);
      if (this.callbacks.has('onUserTyping')) {
        this.callbacks.get('onUserTyping')(data);
      }
    });

    this.channel.bind('story-published', (data) => {
      console.log('Story published:', data);
      if (this.callbacks.has('onStoryPublished')) {
        this.callbacks.get('onStoryPublished')(data);
      }
    });

    this.channel.bind('agent-response', (data) => {
      console.log('Agent response:', data);
      if (this.callbacks.has('onAgentResponse')) {
        this.callbacks.get('onAgentResponse')(data);
      }
    });
  }

  handleConnectionError() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`Retrying connection (${this.retryCount}/${this.maxRetries})...`);
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      this.reconnectTimeout = setTimeout(() => {
        this.reconnect();
      }, this.retryCount * 2000);
    } else {
      console.error('Max retries reached. Please check your connection.');
      if (this.callbacks.has('onError')) {
        this.callbacks.get('onError')('Connection failed after maximum retries');
      }
    }
  }

  async reconnect() {
    this.disconnect();
    if (this.channel) {
      const storyId = this.channel.name.replace('presence-story-', '');
      const callbacks = Object.fromEntries(this.callbacks);
      await this.connect(storyId, callbacks);
    }
  }

  sendStoryUpdate(storyId, changes) {
    if (!this.channel) {
      console.warn('No channel connection');
      return;
    }

    const event = {
      storyId,
      changes,
      timestamp: Date.now(),
      userId: this.pusher.connection.socket_id
    };

    // Trigger client event
    this.channel.trigger('client-story-update', event);
  }

  sendTypingIndicator(storyId, isTyping) {
    if (!this.channel) {
      console.warn('No channel connection');
      return;
    }

    const event = {
      storyId,
      isTyping,
      userId: this.pusher.connection.socket_id,
      timestamp: Date.now()
    };

    // Trigger client event
    this.channel.trigger('client-typing', event);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.channel) {
      this.pusher.unsubscribe(this.channel.name);
      this.channel = null;
    }

    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
    }

    this.callbacks.clear();
    this.retryCount = 0;
  }

  isConnected() {
    return this.pusher?.connection?.state === 'connected';
  }

  getCurrentUser() {
    if (!this.channel || !this.channel.members || !this.channel.members.me) {
      return null;
    }
    return this.channel.members.me.info;
  }

  getConnectedUsers() {
    if (!this.channel || !this.channel.members) {
      return [];
    }
    
    const users = [];
    this.channel.members.each((member) => {
      users.push(member.info);
    });
    return users;
  }
}

export default new WebSocketService();