// client/src/hooks/usePusherCollaboration.js
import { useState, useEffect, useCallback, useRef } from 'react';
import Pusher from 'pusher-js';

const usePusherCollaboration = () => {
  const [pusher, setPusher] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const channelsRef = useRef(new Map());
  
  const [currentUser] = useState(() => {
    const storedUserId = localStorage.getItem('userId');
    const userId = storedUserId || `user-${Math.random().toString(36).substr(2, 9)}`;
    
    if (!storedUserId) {
      localStorage.setItem('userId', userId);
    }
    
    return {
      id: userId,
      name: 'You',
      color: '#3B82F6',
      avatar: '👤'
    };
  });

  useEffect(() => {
    // Initialize Pusher
    const pusherClient = new Pusher(process.env.REACT_APP_PUSHER_KEY, {
      cluster: process.env.REACT_APP_PUSHER_CLUSTER,
      authEndpoint: `${process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001'}/api/pusher/auth`,
      auth: {
        params: {
          user_id: currentUser.id,
          user_name: currentUser.name,
          user_avatar: currentUser.avatar,
          user_color: currentUser.color
        }
      }
    });

    // Enable Pusher logging in development
    if (process.env.NODE_ENV === 'development') {
      Pusher.logToConsole = true;
    }

    // Connection state handlers
    pusherClient.connection.bind('connected', () => {
      console.log('Pusher connected');
      setIsConnected(true);
    });

    pusherClient.connection.bind('disconnected', () => {
      console.log('Pusher disconnected');
      setIsConnected(false);
    });

    pusherClient.connection.bind('error', (err) => {
      console.error('Pusher connection error:', err);
      setIsConnected(false);
    });

    // Subscribe to main presence channel
    const presenceChannel = pusherClient.subscribe('presence-main');
    
    presenceChannel.bind('pusher:subscription_succeeded', (members) => {
      const users = [];
      members.each((member) => {
        users.push({
          id: member.id,
          ...member.info
        });
      });
      setConnectedUsers(users);
    });

    presenceChannel.bind('pusher:member_added', (member) => {
      setConnectedUsers(prev => [...prev, {
        id: member.id,
        ...member.info
      }]);
    });

    presenceChannel.bind('pusher:member_removed', (member) => {
      setConnectedUsers(prev => prev.filter(u => u.id !== member.id));
    });

    setPusher(pusherClient);

    return () => {
      // Cleanup channels
      channelsRef.current.forEach(channel => {
        channel.unbind_all();
        channel.unsubscribe();
      });
      
      presenceChannel.unbind_all();
      presenceChannel.unsubscribe();
      pusherClient.disconnect();
    };
  }, [currentUser]);

  // Subscribe to a specific story channel
  const subscribeToStory = useCallback((storyId, callback) => {
    if (!pusher) return () => {};

    // Use private channel for story updates (to support client events)
    const channelName = `private-story-${storyId}`;
    let channel = channelsRef.current.get(channelName);
    
    if (!channel) {
      channel = pusher.subscribe(channelName);
      channelsRef.current.set(channelName, channel);
    }

    // Bind to story update events
    channel.bind('story-updated', callback);
    channel.bind('story-published', callback);

    // Return unsubscribe function
    return () => {
      channel.unbind('story-updated', callback);
      channel.unbind('story-published', callback);
    };
  }, [pusher]);

  // Subscribe to epic updates
  const subscribeToEpics = useCallback((callback) => {
    if (!pusher) return () => {};

    const channel = pusher.subscribe('epics');
    
    channel.bind('epic-created', callback);
    channel.bind('epic-updated', callback);
    channel.bind('epic-deleted', callback);

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [pusher]);

  // Send story update (via REST API, which triggers Pusher)
  const sendStoryUpdate = useCallback(async (storyId, changes) => {
    // Story updates are sent via REST API
    // The backend will trigger Pusher events
    // This is handled in the main App component
  }, []);

  // Send typing indicator using client events
  const sendTypingIndicator = useCallback((storyId, isTyping) => {
    if (!pusher || !isConnected) return;

    const channel = channelsRef.current.get(`private-story-${storyId}`);
    if (!channel) return;

    // Use client events for typing indicators
    channel.trigger(`client-typing`, {
      userId: currentUser.id,
      isTyping
    });

    // Update local typing state
    setTypingUsers(prev => {
      const newMap = new Map(prev);
      if (isTyping) {
        newMap.set(currentUser.id, true);
      } else {
        newMap.delete(currentUser.id);
      }
      return newMap;
    });
  }, [pusher, isConnected, currentUser]);

  // Listen for typing indicators from other users
  useEffect(() => {
    if (!pusher) return;

    const handleTyping = (data) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        if (data.isTyping && data.userId !== currentUser.id) {
          newMap.set(data.userId, true);
        } else {
          newMap.delete(data.userId);
        }
        return newMap;
      });

      // Auto-clear typing indicator after 2 seconds
      if (data.isTyping) {
        setTimeout(() => {
          setTypingUsers(prev => {
            const newMap = new Map(prev);
            newMap.delete(data.userId);
            return newMap;
          });
        }, 2000);
      }
    };

    // Subscribe to typing events on all story channels
    channelsRef.current.forEach(channel => {
      channel.bind('client-typing', handleTyping);
    });

    return () => {
      channelsRef.current.forEach(channel => {
        channel.unbind('client-typing', handleTyping);
      });
    };
  }, [pusher, currentUser]);

  return {
    sendStoryUpdate,
    sendTypingIndicator,
    isConnected,
    connectedUsers,
    currentUser,
    typingUsers,
    subscribeToStory,
    subscribeToEpics
  };
};

export default usePusherCollaboration;