// server/index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load .env file from server directory
dotenv.config();

// Debug: Check if environment variables are loaded
console.log('Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  PUSHER_APP_ID: process.env.PUSHER_APP_ID,
  PUSHER_KEY: process.env.PUSHER_KEY,
  PUSHER_SECRET: process.env.PUSHER_SECRET ? 'loaded' : 'NOT LOADED',
  PUSHER_CLUSTER: process.env.PUSHER_CLUSTER,
  USE_MOCK_AI: process.env.USE_MOCK_AI
});

const pusher = require('./services/pusher');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory storage (replace with database in production)
const stories = new Map();
const epics = new Map();

// Initialize with sample data - Updated with parentStoryId
stories.set('1', {
  id: '1',
  title: 'User can log into the system',
  description: 'Basic authentication functionality',
  content: 'As a user, I can log into the system so that I can access my personal dashboard.',
  parentStoryId: null, // null means this is a main story
  epicId: 'epic1',
  priority: 'High',
  effort: 'Small',
  storyPoints: 3,
  acceptanceCriteria: ['Valid credentials allow access', 'Invalid credentials show error'],
  status: 'published',
  version: 1,
  lastModified: new Date()
});

stories.set('main-story', {
  id: 'main-story',
  title: 'Main Story',
  description: 'The main story being edited',
  content: '',
  parentStoryId: null, // This is a main story
  epicId: null,
  priority: 'Medium',
  effort: 'Medium',
  storyPoints: 0,
  acceptanceCriteria: [],
  status: 'draft',
  version: 1,
  lastModified: new Date()
});

epics.set('epic1', {
  id: 'epic1',
  title: 'User Management',
  description: 'All user-related functionality',
  order: 1
});

epics.set('epic2', {
  id: 'epic2',
  title: 'Product Discovery',
  description: 'Search and browse products',
  order: 2
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    pusher: !!pusher,
    claude: !!process.env.CLAUDE_API_KEY,
    mockMode: process.env.USE_MOCK_AI === 'true'
  });
});

// Story routes - Updated with hierarchy support
app.get('/api/stories', (req, res) => {
  const { main, parentId } = req.query;
  
  let filteredStories = Array.from(stories.values());
  
  if (main === 'true') {
    // Return only main stories
    filteredStories = filteredStories.filter(story => story.parentStoryId === null);
  } else if (parentId) {
    // Return only stories for a specific parent
    filteredStories = filteredStories.filter(story => story.parentStoryId === parentId);
  }
  
  res.json(filteredStories);
});

// Get all main stories (stories without parents)
app.get('/api/stories/main', (req, res) => {
  const mainStories = Array.from(stories.values()).filter(
    story => story.parentStoryId === null
  );
  res.json(mainStories);
});

app.get('/api/stories/:id', (req, res) => {
  const story = stories.get(req.params.id);
  if (!story) {
    return res.status(404).json({ error: 'Story not found' });
  }
  res.json(story);
});

// Get all sub-stories for a parent story
app.get('/api/stories/:id/substories', (req, res) => {
  const { id } = req.params;
  const parentStory = stories.get(id);
  
  if (!parentStory) {
    return res.status(404).json({ error: 'Parent story not found' });
  }
  
  const subStories = Array.from(stories.values()).filter(
    story => story.parentStoryId === id
  );
  
  res.json(subStories);
});

app.post('/api/stories', (req, res) => {
  const story = {
    id: `story-${Date.now()}`,
    parentStoryId: null, // Default to main story
    ...req.body,
    createdAt: new Date(),
    lastModified: new Date(),
    version: 1
  };
  stories.set(story.id, story);
  res.status(201).json(story);
});

// Create sub-stories from AI split suggestions
app.post('/api/stories/:id/accept-splits', (req, res) => {
  const { id } = req.params;
  const { splits } = req.body; // Array of split suggestions from AI
  
  const parentStory = stories.get(id);
  if (!parentStory) {
    return res.status(404).json({ error: 'Parent story not found' });
  }
  
  const createdStories = [];
  
  splits.forEach((split, index) => {
    const newStory = {
      id: `story-${Date.now()}-${index}`,
      title: split.title,
      description: split.description || '',
      content: `As a user, I can ${split.title.toLowerCase()}`,
      parentStoryId: id, // Link to parent story
      epicId: parentStory.epicId, // Inherit epic from parent initially
      priority: split.priority || 'Medium',
      effort: split.effort || 'Medium',
      storyPoints: split.storyPoints || 0,
      acceptanceCriteria: split.acceptanceCriteria || [],
      status: 'draft',
      version: 1,
      createdAt: new Date(),
      lastModified: new Date(),
      createdFrom: 'ai-split' // Track that this came from AI
    };
    
    stories.set(newStory.id, newStory);
    createdStories.push(newStory);
  });
  
  // Update parent story to track it has been split
  const updatedParent = {
    ...parentStory,
    hasSplits: true,
    lastModified: new Date()
  };
  stories.set(id, updatedParent);
  
  res.status(201).json({
    parentStory: updatedParent,
    subStories: createdStories
  });
});

app.put('/api/stories/:id', (req, res) => {
  const { id } = req.params;
  const story = stories.get(id);
  
  if (!story) {
    return res.status(404).json({ error: 'Story not found' });
  }

  const updatedStory = {
    ...story,
    ...req.body,
    id, // Ensure ID doesn't change
    lastModified: new Date(),
    version: (story.version || 0) + 1
  };

  stories.set(id, updatedStory);
  
  // Broadcast update via Pusher
  if (pusher) {
    pusher.trigger(`presence-story-${id}`, 'story-updated', {
      storyId: id,
      changes: updatedStory,
      user: req.body.user || { id: 'system', name: 'System' },
      timestamp: Date.now()
    });
  }

  res.json(updatedStory);
});

app.post('/api/stories/:id/publish', (req, res) => {
  const { id } = req.params;
  const story = stories.get(id);
  
  if (!story) {
    return res.status(404).json({ error: 'Story not found' });
  }

  const publishedStory = {
    ...story,
    status: 'published',
    publishedAt: new Date(),
    lastModified: new Date()
  };

  stories.set(id, publishedStory);
  
  // Broadcast publish event
  if (pusher) {
    pusher.trigger(`presence-story-${id}`, 'story-published', {
      storyId: id,
      user: req.body.user || { id: 'system', name: 'System' },
      timestamp: Date.now()
    });
  }

  res.json(publishedStory);
});

app.delete('/api/stories/:id', (req, res) => {
  const { id } = req.params;
  if (!stories.has(id)) {
    return res.status(404).json({ error: 'Story not found' });
  }
  
  stories.delete(id);
  res.status(204).send();
});

// Epic routes
app.get('/api/epics', (req, res) => {
  res.json(Array.from(epics.values()));
});

app.get('/api/epics/:id', (req, res) => {
  const epic = epics.get(req.params.id);
  if (!epic) {
    return res.status(404).json({ error: 'Epic not found' });
  }
  res.json(epic);
});

app.post('/api/epics', (req, res) => {
  const epic = {
    id: `epic-${Date.now()}`,
    ...req.body,
    createdAt: new Date(),
    lastModified: new Date()
  };
  epics.set(epic.id, epic);
  res.status(201).json(epic);
});

app.put('/api/epics/:id', (req, res) => {
  const { id } = req.params;
  const epic = epics.get(id);
  
  if (!epic) {
    return res.status(404).json({ error: 'Epic not found' });
  }

  const updatedEpic = {
    ...epic,
    ...req.body,
    id, // Ensure ID doesn't change
    lastModified: new Date()
  };

  epics.set(id, updatedEpic);
  res.json(updatedEpic);
});

app.delete('/api/epics/:id', (req, res) => {
  const { id } = req.params;
  if (!epics.has(id)) {
    return res.status(404).json({ error: 'Epic not found' });
  }
  
  epics.delete(id);
  res.status(204).send();
});

// AI Agent routes
app.post('/api/agents/:agentType', async (req, res) => {
  const { agentType } = req.params;
  const { story, context } = req.body;

  console.log(`AI Agent request: ${agentType}`, { 
    story: story?.title,
    hasContent: !!story?.content,
    contentLength: story?.content?.length 
  });

  try {
    // Check if mock mode is enabled
    const useMockAI = process.env.USE_MOCK_AI === 'true';
    
    if (!useMockAI && !process.env.CLAUDE_API_KEY) {
      console.error('No Claude API key configured and mock mode is disabled');
      return res.status(503).json({ 
        error: 'AI service not configured. Please set USE_MOCK_AI=true or provide API keys.' 
      });
    }

    if (useMockAI) {
      // Mock responses that match the OpenAI/Claude format
      const mockResponses = {
        analyze: {
          id: `msg-${Date.now()}`,
          object: 'analysis',
          created: Math.floor(Date.now() / 1000), // Unix timestamp
          model: 'claude-3-mock',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: `Analysis complete for "${story.title || 'your story'}". This story shows good structure with clear user value. The format follows the "As a [user], I can [action] so that [benefit]" pattern effectively.`,
              function_call: null
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 150,
            total_tokens: 250
          },
          metadata: {
            agent: 'Story Analyst',
            suggestions: [
              'Consider adding more specific acceptance criteria',
              'Break down complex workflows into smaller steps',
              'Define clear user personas and their needs'
            ],
            criteria: {
              Independent: true,
              Negotiable: true,
              Valuable: true,
              Estimable: false,
              Small: true,
              Testable: false
            },
            score: 67
          }
        },
        split: {
          id: `msg-${Date.now()}`,
          object: 'analysis',
          created: Math.floor(Date.now() / 1000),
          model: 'claude-3-mock',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: `I've analyzed your story and identified opportunities to split it into smaller, more manageable pieces.`,
              function_call: null
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 150,
            total_tokens: 250
          },
          metadata: {
            agent: 'Splitting Expert',
            splits: [
              { 
                title: 'Basic functionality', 
                priority: 'High', 
                effort: 'Small',
                description: 'Core feature implementation'
              },
              { 
                title: 'Enhanced features', 
                priority: 'Medium', 
                effort: 'Medium',
                description: 'Additional functionality'
              },
              { 
                title: 'Advanced options', 
                priority: 'Low', 
                effort: 'Large',
                description: 'Power user features'
              }
            ]
          }
        },
        coach: {
          id: `msg-${Date.now()}`,
          object: 'analysis',
          created: Math.floor(Date.now() / 1000),
          model: 'claude-3-mock',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: `Here are some tips to improve your user story writing skills.`,
              function_call: null
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 150,
            total_tokens: 250
          },
          metadata: {
            agent: 'Coaching Assistant',
            tips: [
              'Focus on user value in each story',
              'Keep stories independently deliverable',
              'Ensure stories can be tested end-to-end',
              'Write from the user\'s perspective',
              'Include clear acceptance criteria'
            ]
          }
        },
        review: {
          id: `msg-${Date.now()}`,
          object: 'analysis',
          created: Math.floor(Date.now() / 1000),
          model: 'claude-3-mock',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: `Quality review complete. Your story meets most INVEST criteria but could be improved.`,
              function_call: null
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 150,
            total_tokens: 250
          },
          metadata: {
            agent: 'Quality Reviewer',
            criteria: {
              Independent: true,
              Negotiable: true,
              Valuable: true,
              Estimable: false,
              Small: true,
              Testable: false
            },
            score: 67,
            suggestions: [
              'Add specific acceptance criteria for better testability',
              'Include effort estimates for better planning',
              'Consider edge cases and error scenarios'
            ]
          }
        }
      };

      const response = mockResponses[agentType] || mockResponses.analyze;
      
      // Add a small delay to simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Sending mock AI response:', response.metadata.agent);
      res.json(response);
    } else {
      // TODO: Implement real AI agent calls here
      // This is where you'll call actual Claude/OpenAI APIs
      
      // For now, return an error
      res.status(501).json({ 
        error: 'Real AI integration not yet implemented',
        message: 'Please use mock mode (USE_MOCK_AI=true) for now'
      });
    }
    
  } catch (error) {
    console.error('AI Agent error:', error);
    res.status(500).json({ error: 'AI analysis failed', details: error.message });
  }
});

// Pusher authentication endpoint
app.post('/api/pusher/auth', (req, res) => {
  console.log('Pusher auth request headers:', req.headers);
  console.log('Pusher auth request body:', req.body);
  
  try {
    // Check if Pusher credentials are loaded
    if (!process.env.PUSHER_SECRET) {
      console.error('PUSHER_SECRET not found in environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error: Pusher secret not configured' 
      });
    }

    // Pusher sends socketId as socket_id and channel as channel_name
    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;
    
    console.log('Parsed data:', { socketId, channel });
    
    if (!socketId || !channel) {
      console.error('Missing required fields:', { socketId, channel });
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: req.body 
      });
    }

    // Check if pusher is properly initialized
    if (!pusher) {
      console.error('Pusher not initialized');
      return res.status(500).json({ error: 'Pusher service not available' });
    }

    // Different handling for different channel types
    if (channel.startsWith('presence-')) {
      // Presence channel - requires user data
      const presenceData = {
        user_id: socketId,
        user_info: {
          id: req.body.user_id || `user-${socketId.substring(0, 8)}`,
          name: req.body.user_name || `User ${Math.floor(Math.random() * 1000)}`,
          color: req.body.user_color || '#' + Math.floor(Math.random()*16777215).toString(16),
          avatar: req.body.user_avatar || '👤',
          isOnline: true
        }
      };

      const auth = pusher.authenticate(socketId, channel, presenceData);
      console.log('Presence auth successful for channel:', channel);
      res.json(auth);
      
    } else if (channel.startsWith('private-')) {
      // Private channel - no user data needed
      const auth = pusher.authenticate(socketId, channel);
      console.log('Private auth successful for channel:', channel);
      res.json(auth);
      
    } else {
      // Public channels don't need authentication
      console.log('Public channel, no auth needed:', channel);
      res.json({ auth: '' });
    }
    
  } catch (error) {
    console.error('Pusher auth error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message 
    });
  }
});

// Trigger Pusher event (for testing)
app.post('/api/pusher/trigger', async (req, res) => {
  const { channel, event, data } = req.body;

  if (!channel || !event || !data) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await pusher.trigger(channel, event, data);
    res.json({ success: true });
  } catch (error) {
    console.error('Pusher trigger error:', error);
    res.status(500).json({ error: 'Failed to trigger event' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  console.log('404 - Route not found:', req.method, req.path);
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Pusher configured:', !!pusher);
  console.log('Claude API key detected:', !!process.env.CLAUDE_API_KEY);
  console.log('Mock AI mode:', process.env.USE_MOCK_AI === 'true');
});