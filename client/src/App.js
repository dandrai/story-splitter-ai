import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Sparkles, FileText, Users, CheckCircle, Split, RefreshCw, Download, Upload, Zap, Plus, Trash2, Edit3, Move, GripVertical, Layout, LayoutGrid, Globe, Eye, Loader2, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import Pusher from 'pusher-js';
import './App.css';

// Context for managing global application state
const StoryContext = React.createContext();

// API Service for backend communication
class APIService {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  }

  // Story management
  async getStory(id) {
    return this.request(`/stories/${id}`);
  }

  async createStory(story) {
    return this.request('/stories', {
      method: 'POST',
      body: story,
    });
  }

  async updateStory(id, story) {
    return this.request(`/stories/${id}`, {
      method: 'PUT',
      body: story,
    });
  }

  async publishStory(id) {
    return this.request(`/stories/${id}/publish`, {
      method: 'POST',
    });
  }

  // AI Agent calls
  async callAgent(agentType, storyData) {
    return this.request(`/agents/${agentType}`, {
      method: 'POST',
      body: storyData,
    });
  }
}

// Pusher-based real-time collaboration
const usePusherCollaboration = (channelName) => {
  const [pusher, setPusher] = useState(null);
  const [channel, setChannel] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    // Initialize Pusher with auth endpoint
    const pusherClient = new Pusher('c3f5b6a224f131c7e678', {
      cluster: 'us2',
      encrypted: true,
      authEndpoint: '/api/pusher/auth',
      auth: {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    });

    const channelInstance = pusherClient.subscribe(channelName);

    // Connection events
    pusherClient.connection.bind('connected', () => {
      setIsConnected(true);
      console.log('Connected to Pusher');
    });

    pusherClient.connection.bind('disconnected', () => {
      setIsConnected(false);
      console.log('Disconnected from Pusher');
    });

    // Channel events
    channelInstance.bind('user-joined', (data) => {
      setConnectedUsers(prev => [...prev.filter(u => u.id !== data.user.id), data.user]);
    });

    channelInstance.bind('user-left', (data) => {
      setConnectedUsers(prev => prev.filter(u => u.id !== data.userId));
    });

    channelInstance.bind('story-updated', (data) => {
      window.dispatchEvent(new CustomEvent('collaborative-story-update', {
        detail: data
      }));
    });

    channelInstance.bind('user-typing', (data) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (data.isTyping) {
          newSet.add(`${data.user.id}-${data.storyId}`);
        } else {
          newSet.delete(`${data.user.id}-${data.storyId}`);
        }
        return newSet;
      });
    });

    setPusher(pusherClient);
    setChannel(channelInstance);

    // Set current user (would come from auth in real app)
    const user = {
      id: 'user-' + Math.random().toString(36).substr(2, 9),
      name: 'You',
      color: '#3B82F6',
      avatar: '👤'
    };
    setCurrentUser(user);

    return () => {
      channelInstance.unbind_all();
      channelInstance.unsubscribe();
      pusherClient.disconnect();
    };
  }, [channelName]);

  const sendStoryUpdate = useCallback(async (storyId, changes) => {
    if (!channel || !currentUser) return;

    try {
      await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: channelName,
          event: 'story-updated',
          data: {
            storyId,
            changes,
            user: currentUser,
            timestamp: Date.now()
          }
        })
      });
    } catch (error) {
      console.error('Failed to send story update:', error);
    }
  }, [channel, currentUser, channelName]);

  const sendTypingIndicator = useCallback(async (storyId, isTyping) => {
    if (!channel || !currentUser) return;

    try {
      await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: channelName,
          event: 'user-typing',
          data: {
            storyId,
            isTyping,
            user: currentUser
          }
        })
      });
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
    }
  }, [channel, currentUser, channelName]);

  return { 
    sendStoryUpdate,
    sendTypingIndicator,
    isConnected, 
    connectedUsers,
    currentUser,
    typingUsers
  };
};

// Story Card Component
const StoryCard = ({ story, onEdit, onDelete, isDragging }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(story.title);

  const handleSave = () => {
    onEdit(story.id, { ...story, title: editText });
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditText(story.title);
      setIsEditing(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'border-l-red-500 bg-red-50';
      case 'Medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'Low': return 'border-l-green-500 bg-green-50';
      default: return 'border-l-blue-500 bg-blue-50';
    }
  };

  const getEffortColor = (effort) => {
    switch (effort) {
      case 'Small': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Large': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div
      className={`bg-white border-l-4 rounded-lg shadow-sm transition-all duration-200 ${getPriorityColor(story.priority)} hover:shadow-md ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1">
            <div className="cursor-grab active:cursor-grabbing">
              <GripVertical size={14} className="text-gray-400" />
            </div>
            {isEditing ? (
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="flex-1 text-sm font-medium text-gray-800 bg-transparent border-none resize-none focus:outline-none"
                autoFocus
                rows={2}
              />
            ) : (
              <h3 className="flex-1 text-sm font-medium text-gray-800 leading-tight">
                {story.title}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Edit3 size={12} />
            </button>
            <button
              onClick={() => onDelete(story.id)}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {story.description && (
          <p className="text-xs text-gray-600 mb-2 leading-relaxed">
            {story.description}
          </p>
        )}

        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-xs font-medium rounded ${getEffortColor(story.effort)}`}>
            {story.effort}
          </span>
          <span className="text-xs text-gray-500">
            {story.storyPoints ? `${story.storyPoints} pts` : 'Unestimated'}
          </span>
          {story.status === 'published' && (
            <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
              <Globe size={10} className="inline mr-1" />
              Published
            </span>
          )}
        </div>

        {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-600">
              <span className="font-medium">AC:</span> {story.acceptanceCriteria.length} criteria
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Epic Card Component
const EpicCard = ({ epic, onEdit, onDelete, onAddStory }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(epic.title);

  const handleSave = () => {
    onEdit(epic.id, { ...epic, title: editText });
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditText(epic.title);
      setIsEditing(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-sm">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          {isEditing ? (
            <input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm font-semibold bg-transparent border-none focus:outline-none text-white placeholder-blue-200"
              autoFocus
            />
          ) : (
            <h2 className="text-sm font-semibold">{epic.title}</h2>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAddStory(epic.id)}
              className="p-1 text-blue-200 hover:text-white transition-colors"
              title="Add story"
            >
              <Plus size={12} />
            </button>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-1 text-blue-200 hover:text-white transition-colors"
            >
              <Edit3 size={12} />
            </button>
            <button
              onClick={() => onDelete(epic.id)}
              className="p-1 text-blue-200 hover:text-white transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        {epic.description && (
          <p className="text-xs text-blue-100 opacity-90">{epic.description}</p>
        )}
      </div>
    </div>
  );
};

// Story Mapping Board Component
const StoryMappingBoard = ({ stories, epics, onUpdateStory, onDeleteStory, onUpdateEpic, onDeleteEpic, onAddStory, onAddEpic }) => {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const storiesByEpic = stories.reduce((acc, story) => {
    const epicId = story.epicId || 'unassigned';
    if (!acc[epicId]) acc[epicId] = [];
    acc[epicId].push(story);
    return acc;
  }, {});

  Object.keys(storiesByEpic).forEach(epicId => {
    storiesByEpic[epicId].sort((a, b) => {
      const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  });

  const handleDragStart = (e, item, type) => {
    setDraggedItem({ ...item, type });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, epicId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(epicId);
  };

  const handleDrop = (e, targetEpicId) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (draggedItem && draggedItem.type === 'story' && draggedItem.epicId !== targetEpicId) {
      onUpdateStory(draggedItem.id, { ...draggedItem, epicId: targetEpicId });
    }
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverColumn(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Layout size={20} />
            Story Mapping Board
          </h2>
          <button
            onClick={onAddEpic}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={14} />
            Add Epic
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Organize your user stories along the user journey backbone
        </p>
      </div>

      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex gap-4 overflow-x-auto">
          {epics.map((epic) => (
            <div key={epic.id} className="min-w-[280px] flex-shrink-0">
              <EpicCard 
                epic={epic} 
                onEdit={onUpdateEpic}
                onDelete={onDeleteEpic}
                onAddStory={onAddStory}
              />
            </div>
          ))}
          <div className="min-w-[280px] flex-shrink-0">
            <button
              onClick={onAddEpic}
              className="w-full h-full min-h-[80px] border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Add Epic
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="flex gap-4 min-w-max">
          {epics.map((epic) => (
            <div
              key={epic.id}
              className={`min-w-[280px] flex-shrink-0 ${
                dragOverColumn === epic.id ? 'bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, epic.id)}
              onDrop={(e) => handleDrop(e, epic.id)}
            >
              <div className="space-y-3">
                {(storiesByEpic[epic.id] || []).map((story) => (
                  <div
                    key={story.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, story, 'story')}
                    onDragEnd={handleDragEnd}
                    className={draggedItem?.id === story.id ? 'opacity-50' : ''}
                  >
                    <StoryCard
                      story={story}
                      onEdit={onUpdateStory}
                      onDelete={onDeleteStory}
                      isDragging={draggedItem?.id === story.id}
                    />
                  </div>
                ))}
                
                <button
                  onClick={() => onAddStory(epic.id)}
                  className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Plus size={14} />
                  Add Story
                </button>
              </div>
            </div>
          ))}

          <div
            className={`min-w-[280px] flex-shrink-0 ${
              dragOverColumn === 'unassigned' ? 'bg-gray-100 border-2 border-dashed border-gray-400 rounded-lg' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, 'unassigned')}
            onDrop={(e) => handleDrop(e, 'unassigned')}
          >
            <div className="mb-3 p-3 bg-gray-200 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700">Unassigned Stories</h3>
              <p className="text-xs text-gray-600 mt-1">Stories not yet mapped to an epic</p>
            </div>
            
            <div className="space-y-3">
              {(storiesByEpic['unassigned'] || []).map((story) => (
                <div
                  key={story.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, story, 'story')}
                  onDragEnd={handleDragEnd}
                  className={draggedItem?.id === story.id ? 'opacity-50' : ''}
                >
                  <StoryCard
                    story={story}
                    onEdit={onUpdateStory}
                    onDelete={onDeleteStory}
                    isDragging={draggedItem?.id === story.id}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Story Editor Component
const StoryEditor = ({ 
  onStoryChange, 
  currentStory, 
  publishedStory,
  onPublish,
  connectedUsers = [], 
  currentUser, 
  typingUsers = new Set(), 
  sendTypingIndicator = () => {}, 
  isPublishing = false 
}) => {
  const [story, setStory] = useState(currentStory || '');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedVersion, setLastSavedVersion] = useState(currentStory || '');
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    const handleCollaborativeUpdate = (event) => {
      const { changes, user } = event.detail;
      if (user.id !== currentUser?.id) {
        setStory(changes.content || story);
        setLastSavedVersion(changes.content || story);
        showCollaborativeUpdate(user, changes);
      }
    };

    window.addEventListener('collaborative-story-update', handleCollaborativeUpdate);
    return () => window.removeEventListener('collaborative-story-update', handleCollaborativeUpdate);
  }, [story, currentUser]);

  const showCollaborativeUpdate = (user, changes) => {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300';
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${user.avatar}</span>
        <span>${user.name} updated the story</span>
      </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
  };

  const handleChange = (e) => {
    const newStory = e.target.value;
    setStory(newStory);
    setIsDirty(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    sendTypingIndicator('main-story', true);
    
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator('main-story', false);
    }, 1000);
    
    clearTimeout(window.storyTimeout);
    window.storyTimeout = setTimeout(() => {
      onStoryChange(newStory);
      setLastSavedVersion(newStory);
      setIsDirty(false);
    }, 500);
  };

  const currentTypingUsers = connectedUsers.filter(user => 
    user.id !== currentUser?.id && 
    typingUsers.has(`${user.id}-main-story`)
  );

  const hasChanges = story !== publishedStory;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FileText size={20} />
            Story Editor
          </h2>
          
          {currentTypingUsers.length > 0 && (
            <div className="flex items-center gap-1 text-sm text-blue-600">
              <div className="flex">
                {currentTypingUsers.slice(0, 3).map(user => (
                  <span key={user.id} className="text-lg" title={`${user.name} is typing`}>
                    {user.avatar}
                  </span>
                ))}
              </div>
              <span className="text-xs">
                {currentTypingUsers.length === 1 
                  ? `${currentTypingUsers[0].name} is typing...`
                  : `${currentTypingUsers.length} people are typing...`
                }
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <RefreshCw size={12} className="animate-spin" />
              Auto-saving...
            </span>
          )}
          {!isDirty && lastSavedVersion && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle size={12} />
              Saved
            </span>
          )}
          
          {hasChanges && (
            <button
              onClick={onPublish}
              disabled={isPublishing || isDirty}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isPublishing ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Globe size={12} />
                  Publish
                </>
              )}
            </button>
          )}
          
          <span className="text-xs text-gray-500">
            {story.length} characters
          </span>
        </div>
      </div>
      
      <div className="flex-1 p-4 relative">
        <textarea
          ref={textareaRef}
          value={story}
          onChange={handleChange}
          placeholder="Enter your user story here...

Example:
As a content manager, I can publish a news story to the corporate website so that our audience stays informed about company updates.

The AI agents will help you analyze, split, and improve this story according to INVEST criteria and agile best practices."
          className="w-full h-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm leading-relaxed"
        />
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-600">
          <p className="mb-1"><strong>Tips:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Use the format: "As a [user], I can [action] so that [benefit]"</li>
            <li>Focus on user value rather than technical implementation</li>
            <li>Keep stories vertical (end-to-end functionality)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// AI Insights Panel Component
const AIInsights = ({ 
  messages, 
  onSendMessage, 
  isConnected, 
  connectedUsers = [], 
  currentUser,
  currentStory,
  stories = [],
  epics = []
}) => {
  const [activeAgent, setActiveAgent] = useState('analyze');
  const [loadingAgent, setLoadingAgent] = useState(null);
  const [error, setError] = useState(null);
  
  const agents = [
    { id: 'analyze', name: 'Story Analyst', icon: Sparkles, color: 'blue' },
    { id: 'split', name: 'Splitting Expert', icon: Split, color: 'green' },
    { id: 'coach', name: 'Coaching Assistant', icon: Users, color: 'purple' },
    { id: 'review', name: 'Quality Reviewer', icon: CheckCircle, color: 'orange' }
  ];

  const handleAgentAction = async (agentId) => {
    if (!currentStory.trim()) {
      setError('Please enter a story before requesting AI analysis.');
      return;
    }

    setActiveAgent(agentId);
    setLoadingAgent(agentId);
    setError(null);
    
    try {
      const storyData = {
        story: {
          content: currentStory,
          title: currentStory.split('\n')[0] || 'Untitled Story',
          acceptanceCriteria: []
        },
        context: {
          epics: epics,
          relatedStories: stories
        },
        requestType: agentId
      };

      await onSendMessage(agentId, storyData);
    } catch (err) {
      setError(`AI Agent (${agents.find(a => a.id === agentId)?.name}) temporarily unavailable. Please try again later.`);
    } finally {
      setLoadingAgent(null);
    }
  };

  const renderMessage = (message) => {
    const agent = agents.find(a => a.name === message.agent) || agents[0];
    
    return (
      <div key={message.id} className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-2 rounded-full bg-${agent.color}-100`}>
            <agent.icon size={16} className={`text-${agent.color}-600`} />
          </div>
          <span className="font-medium text-gray-800">{message.agent}</span>
          <span className="text-xs text-gray-500">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
        
        <div className="text-sm text-gray-700 mb-3">
          {message.content}
        </div>

        {message.suggestions && (
          <div className="mb-3">
            <h4 className="font-medium text-gray-800 mb-2">Suggestions:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              {message.suggestions.map((suggestion, idx) => (
                <li key={idx}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}

        {message.splits && (
          <div className="mb-3">
            <h4 className="font-medium text-gray-800 mb-2">Recommended Splits:</h4>
            <div className="space-y-2">
              {message.splits.map((split, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded border">
                  <div className="font-medium text-gray-800">{split.title}</div>
                  <div className="flex gap-4 mt-1 text-xs">
                    <span className={`px-2 py-1 rounded ${
                      split.priority === 'High' ? 'bg-red-100 text-red-700' :
                      split.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {split.priority} Priority
                    </span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      {split.effort} Effort
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {message.tips && (
          <div className="mb-3">
            <h4 className="font-medium text-gray-800 mb-2">Coaching Tips:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              {message.tips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {message.criteria && (
          <div className="mb-3">
            <h4 className="font-medium text-gray-800 mb-2">INVEST Criteria Assessment:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(message.criteria).map(([criterion, passed]) => (
                <div key={criterion} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${passed ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className={passed ? 'text-green-700' : 'text-red-700'}>
                    {criterion}
                  </span>
                </div>
              ))}
            </div>
            {message.score && (
              <div className="mt-2 text-sm font-medium">
                Overall Score: <span className="text-blue-600">{message.score}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const ConnectedUsers = ({ users, currentUser }) => (
    <div className="border-t border-gray-200 p-3 bg-gray-50">
      <h4 className="text-xs font-medium text-gray-700 mb-2">Connected Users</h4>
      <div className="flex flex-wrap gap-2">
        {users.map(user => (
          <div
            key={user.id}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              user.id === currentUser?.id 
                ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                : 'bg-green-100 text-green-800'
            }`}
          >
            <span>{user.avatar}</span>
            <span className="font-medium">
              {user.id === currentUser?.id ? 'You' : user.name}
            </span>
            <div className={`w-2 h-2 rounded-full bg-green-500`} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Zap size={20} />
          AI Insights
        </h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-2">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => handleAgentAction(agent.id)}
              disabled={!isConnected || loadingAgent === agent.id}
              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                activeAgent === agent.id
                  ? `bg-${agent.color}-50 border-${agent.color}-200 text-${agent.color}-700`
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              } ${!isConnected || loadingAgent === agent.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2">
                {loadingAgent === agent.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <agent.icon size={16} />
                )}
                <span>{agent.name}</span>
              </div>
            </button>
          ))}
        </div>
        
        <div className="mt-3 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-600">
            {isConnected ? 'Connected to AI agents' : 'Connecting...'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">No insights yet</p>
            <p className="text-sm text-gray-500">
              Click on an AI agent above to get started with story analysis and improvement
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(renderMessage)}
          </div>
        )}
      </div>

      <ConnectedUsers users={connectedUsers} currentUser={currentUser} />
    </div>
  );
};

// Split Panel Layout Component
const SplitPanel = ({ leftPanel, rightPanel, minLeftWidth = 300, minRightWidth = 300 }) => {
  const [leftWidth, setLeftWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    const container = e.currentTarget.parentElement;
    const rect = container.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;
    
    const minLeftPercent = (minLeftWidth / rect.width) * 100;
    const minRightPercent = (minRightWidth / rect.width) * 100;
    
    if (newLeftWidth >= minLeftPercent && newLeftWidth <= (100 - minRightPercent)) {
      setLeftWidth(newLeftWidth);
    }
  }, [isDragging, minLeftWidth, minRightWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex h-full">
      <div style={{ width: `${leftWidth}%` }} className="min-w-0">
        {leftPanel}
      </div>
      
      <div 
        className="w-1 bg-gray-300 cursor-col-resize hover:bg-gray-400 transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown}
      />
      
      <div style={{ width: `${100 - leftWidth}%` }} className="min-w-0">
        {rightPanel}
      </div>
    </div>
  );
};

// Header component
const Header = ({ onExport, onImport, viewToggle, isConnected }) => {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Story Splitter AI</h1>
            <p className="text-sm text-gray-600 flex items-center gap-2">
              Intelligent user story analysis and splitting
              {isConnected ? (
                <Wifi size={14} className="text-green-500" />
              ) : (
                <WifiOff size={14} className="text-red-500" />
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {viewToggle}
          <div className="flex items-center gap-3">
            <button 
              onClick={onImport}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Upload size={16} />
              Import
            </button>
            <button 
              onClick={onExport}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

// Main Application Component
const StoryEditorApp = () => {
  const [currentStory, setCurrentStory] = useState('');
  const [publishedStory, setPublishedStory] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeView, setActiveView] = useState('editor');
  const [messages, setMessages] = useState([]);
  
  const [stories, setStories] = useState([
    {
      id: '1',
      title: 'User can log into the system',
      description: 'Basic authentication functionality',
      content: 'As a user, I can log into the system so that I can access my personal dashboard.',
      epicId: 'epic1',
      priority: 'High',
      effort: 'Small',
      storyPoints: 3,
      acceptanceCriteria: ['Valid credentials allow access', 'Invalid credentials show error'],
      status: 'published'
    },
    {
      id: '2', 
      title: 'User can view their profile',
      description: 'Display user information and settings',
      content: 'As a user, I can view my profile so that I can see my current information and settings.',
      epicId: 'epic1',
      priority: 'Medium',
      effort: 'Medium',
      storyPoints: 5,
      acceptanceCriteria: ['Profile shows current information', 'Settings are editable'],
      status: 'draft'
    },
    {
      id: '3',
      title: 'User can search for products',
      description: 'Product search with filters',
      content: 'As a customer, I can search for products so that I can find items I want to purchase.',
      epicId: 'epic2',
      priority: 'High',
      effort: 'Large',
      storyPoints: 8,
      acceptanceCriteria: ['Search returns relevant results', 'Filters work correctly'],
      status: 'draft'
    }
  ]);

  const [epics, setEpics] = useState([
    {
      id: 'epic1',
      title: 'User Management',
      description: 'All user-related functionality',
      order: 1
    },
    {
      id: 'epic2', 
      title: 'Product Discovery',
      description: 'Search and browse products',
      order: 2
    }
  ]);

  const apiService = new APIService();
  
  const { 
    sendStoryUpdate,
    sendTypingIndicator,
    isConnected, 
    connectedUsers,
    currentUser,
    typingUsers
  } = usePusherCollaboration('story-collaboration');

  const handleStoryChange = useCallback((newStory) => {
    setCurrentStory(newStory);
    sendStoryUpdate('main-story', { content: newStory });
  }, [sendStoryUpdate]);

  const handlePublish = async () => {
    if (!currentStory.trim()) return;
    
    setIsPublishing(true);
    try {
      const result = await apiService.publishStory('main-story');
      setPublishedStory(currentStory);
      
      // Update the main story in stories array if it exists
      const mainStoryId = '1'; // This would be dynamic
      setStories(prev => prev.map(story => 
        story.id === mainStoryId 
          ? { ...story, content: currentStory, status: 'published' }
          : story
      ));
      
      // Notify other users
      sendStoryUpdate('main-story', { content: currentStory, status: 'published' });
      
    } catch (error) {
      console.error('Publish failed:', error);
      alert('Failed to publish story: ' + error.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSendMessage = async (agentType, storyData) => {
    try {
      const response = await apiService.callAgent(agentType, storyData);
      
      const message = {
        id: response.id || 'msg-' + Date.now(),
        timestamp: response.created || Date.now(),
        agent: response.metadata?.agent || {
          analyze: 'Story Analyst',
          split: 'Splitting Expert', 
          coach: 'Coaching Assistant',
          review: 'Quality Reviewer'
        }[agentType],
        content: response.choices?.[0]?.message?.content || 'No response',
        suggestions: response.metadata?.suggestions,
        splits: response.metadata?.splits,
        tips: response.metadata?.tips,
        criteria: response.metadata?.criteria,
        score: response.metadata?.score
      };

      setMessages(prev => [...prev, message]);
      
    } catch (error) {
      throw error;
    }
  };

  // Story management functions
  const handleUpdateStory = (storyId, updatedStory) => {
    setStories(prev => prev.map(story => 
      story.id === storyId ? updatedStory : story
    ));
  };

  const handleDeleteStory = (storyId) => {
    setStories(prev => prev.filter(story => story.id !== storyId));
  };

  const handleAddStory = (epicId) => {
    const newStory = {
      id: `story-${Date.now()}`,
      title: 'New User Story',
      description: '',
      content: 'As a user, I can [action] so that [benefit].',
      epicId: epicId === 'unassigned' ? null : epicId,
      priority: 'Medium',
      effort: 'Medium',
      storyPoints: 0,
      acceptanceCriteria: [],
      status: 'draft'
    };
    setStories(prev => [...prev, newStory]);
  };

  // Epic management functions
  const handleUpdateEpic = (epicId, updatedEpic) => {
    setEpics(prev => prev.map(epic =>
      epic.id === epicId ? updatedEpic : epic
    ));
  };

  const handleDeleteEpic = (epicId) => {
    setEpics(prev => prev.filter(epic => epic.id !== epicId));
    setStories(prev => prev.map(story =>
      story.epicId === epicId ? { ...story, epicId: null } : story
    ));
  };

  const handleAddEpic = () => {
    const newEpic = {
      id: `epic-${Date.now()}`,
      title: 'New Epic',
      description: 'Epic description',
      order: epics.length + 1
    };
    setEpics(prev => [...prev, newEpic]);
  };

  const handleExport = () => {
    const data = {
      currentStory,
      publishedStory,
      stories,
      epics,
      insights: messages,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'story-analysis.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            if (data.currentStory) setCurrentStory(data.currentStory);
            if (data.publishedStory) setPublishedStory(data.publishedStory);
            if (data.stories) setStories(data.stories);
            if (data.epics) setEpics(data.epics);
            if (data.insights) setMessages(data.insights);
          } catch (error) {
            alert('Invalid file format');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const ViewToggle = () => (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => setActiveView('editor')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
          activeView === 'editor' 
            ? 'bg-white text-gray-900 shadow-sm' 
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Edit3 size={14} />
        Editor
      </button>
      <button
        onClick={() => setActiveView('board')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
          activeView === 'board' 
            ? 'bg-white text-gray-900 shadow-sm' 
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <LayoutGrid size={14} />
        Board
      </button>
    </div>
  );

  return (
    <StoryContext.Provider value={{ currentStory, publishedStory, messages, stories, epics }}>
      <div className="h-screen flex flex-col bg-gray-100">
        <Header 
          onExport={handleExport} 
          onImport={handleImport}
          viewToggle={<ViewToggle />}
          isConnected={isConnected}
        />
        
        <main className="flex-1 min-h-0">
          {activeView === 'editor' ? (
            <SplitPanel
              leftPanel={
                <StoryEditor 
                  onStoryChange={handleStoryChange} 
                  currentStory={currentStory}
                  publishedStory={publishedStory}
                  onPublish={handlePublish}
                  connectedUsers={connectedUsers}
                  currentUser={currentUser}
                  typingUsers={typingUsers}
                  sendTypingIndicator={sendTypingIndicator}
                  isPublishing={isPublishing}
                />
              }
              rightPanel={
                <AIInsights 
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isConnected={isConnected}
                  connectedUsers={connectedUsers}
                  currentUser={currentUser}
                  currentStory={currentStory}
                  stories={stories}
                  epics={epics}
                />
              }
            />
          ) : (
            <StoryMappingBoard
              stories={stories}
              epics={epics}
              onUpdateStory={handleUpdateStory}
              onDeleteStory={handleDeleteStory}
              onUpdateEpic={handleUpdateEpic}
              onDeleteEpic={handleDeleteEpic}
              onAddStory={handleAddStory}
              onAddEpic={handleAddEpic}
            />
          )}
        </main>
      </div>
    </StoryContext.Provider>
  );
};

export default StoryEditorApp;