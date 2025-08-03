// server/index.js - Node.js/Express backend with Pusher support
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const pusher = require('./utils/pusher-client');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
}));
app.use(express.json({ limit: '10mb' }));

// In-memory storage (replace with Redis in production)
const stories = new Map();
const epics = new Map();
const sessions = new Map();

// Initialize with sample data
const initializeData = () => {
  const epic1 = {
    id: 'epic1',
    title: 'User Management',
    description: 'All user-related functionality',
    order: 1
  };
  
  const epic2 = {
    id: 'epic2',
    title: 'Product Discovery',
    description: 'Search and browse products',
    order: 2
  };
  
  epics.set(epic1.id, epic1);
  epics.set(epic2.id, epic2);
  
  const story1 = {
    id: '1',
    title: 'User can log into the system',
    description: 'Basic authentication functionality',
    content: 'As a user, I can log into the system so that I can access my personal dashboard.',
    epicId: 'epic1',
    priority: 'High',
    effort: 'Small',
    storyPoints: 3,
    acceptanceCriteria: ['Valid credentials allow access', 'Invalid credentials show error'],
    status: 'published',
    lastModified: new Date().toISOString(),
    author: 'system',
    collaborators: []
  };
  
  stories.set(story1.id, story1);
};

initializeData();

// Pusher authentication endpoint
app.post('/api/pusher/auth', (req, res) => {
  console.log('Pusher auth request:', req.body); // Debug log
  
  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;
  
  // Validate required fields
  if (!socketId || !channel) {
    console.log('Missing data:', { socketId, channel }); // Debug log
    return res.status(400).json({ error: 'Missing socket_id or channel_name' });
  }
  
  // For presence channels, add user info
  if (channel.startsWith('presence-')) {
    const user = {
      user_id: req.body.user_id || `user-${Date.now()}`,
      user_info: {
        name: req.body.user_name || 'Anonymous',
        avatar: req.body.user_avatar || '👤',
        color: req.body.user_color || '#3B82F6'
      }
    };
    const auth = pusher.authorizeChannel(socketId, channel, user);
    res.send(auth);
  } else {
    const auth = pusher.authorizeChannel(socketId, channel);
    res.send(auth);
  }
});

// API Routes

// Story Management
app.post('/api/stories', async (req, res) => {
  try {
    const story = {
      id: uuidv4(),
      ...req.body,
      lastModified: new Date().toISOString(),
      status: 'draft',
      collaborators: []
    };
    stories.set(story.id, story);
    
    // Trigger Pusher event
    await pusher.trigger('stories', 'story-created', {
      story,
      timestamp: new Date().toISOString()
    });
    
    res.json(story);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stories/:id', (req, res) => {
  try {
    const story = stories.get(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    res.json(story);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stories/:id', async (req, res) => {
  try {
    const story = stories.get(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    const updatedStory = {
      ...story,
      ...req.body,
      id: req.params.id,
      lastModified: new Date().toISOString()
    };
    
    stories.set(req.params.id, updatedStory);
    
    // Trigger Pusher event
    await pusher.trigger(`private-story-${req.params.id}`, 'story-updated', {
      storyId: req.params.id,
      changes: req.body,
      userId: req.body.userId || 'api',
      timestamp: new Date().toISOString()
    });
    
    res.json(updatedStory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stories/:id/publish', async (req, res) => {
  try {
    // Handle special case for main story editor
    if (req.params.id === 'main-story') {
      // For now, just return success without storing
      await pusher.trigger(`private-story-main-story`, 'story-published', {
        storyId: 'main-story',
        userId: req.body.userId || 'api',
        timestamp: new Date().toISOString()
      });
      
      return res.json({
        id: 'main-story',
        content: req.body.content,
        status: 'published',
        lastModified: new Date().toISOString()
      });
    }
    
    const story = stories.get(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    const publishedStory = {
      ...story,
      status: 'published',
      lastModified: new Date().toISOString()
    };
    
    stories.set(req.params.id, publishedStory);
    
    // Trigger Pusher event
    await pusher.trigger(`private-story-${req.params.id}`, 'story-published', {
      storyId: req.params.id,
      userId: req.body.userId || 'api',
      timestamp: new Date().toISOString()
    });
    
    res.json(publishedStory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Epic Management
app.get('/api/epics', (req, res) => {
  try {
    const epicList = Array.from(epics.values()).sort((a, b) => a.order - b.order);
    res.json(epicList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/epics', async (req, res) => {
  try {
    const epic = {
      id: uuidv4(),
      ...req.body,
      order: epics.size + 1
    };
    epics.set(epic.id, epic);
    
    await pusher.trigger('epics', 'epic-created', {
      epic,
      timestamp: new Date().toISOString()
    });
    
    res.json(epic);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all stories
app.get('/api/stories', (req, res) => {
  try {
    const storyList = Array.from(stories.values());
    res.json(storyList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Agent Integration
const { StoryAnalystAgent } = require('./agents/story-analyst');
const { SplittingExpertAgent } = require('./agents/splitting-expert');
const { LLMClient } = require('./utils/llm-client');

const llmClient = new LLMClient();
const storyAnalyst = new StoryAnalystAgent(llmClient);
const splittingExpert = new SplittingExpertAgent(llmClient);

app.post('/api/agents/analyze', async (req, res) => {
  try {
    const { story, context } = req.body;
    
    const input = {
      story: {
        id: story.id || uuidv4(),
        title: story.title,
        description: story.content,
        acceptanceCriteria: story.acceptanceCriteria || [],
        status: 'draft',
        version: 1,
        lastModified: new Date()
      },
      invocationContext: {
        trigger: 'manual',
        relatedStories: context.relatedStories || []
      },
      projectContext: {
        domain: 'web-application',
        teamExperience: 'intermediate',
        projectPhase: 'mvp'
      }
    };
    
    const result = await storyAnalyst.analyzeStory(input);
    
    const response = formatAgentResponse(result, 'Story Analyst');
    res.json(response);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
});

app.post('/api/agents/split', async (req, res) => {
  try {
    const { story, context } = req.body;
    
    // First analyze the story
    const analysisInput = {
      story: {
        id: story.id || uuidv4(),
        title: story.title,
        description: story.content,
        acceptanceCriteria: story.acceptanceCriteria || [],
        status: 'draft',
        version: 1,
        lastModified: new Date()
      },
      invocationContext: {
        trigger: 'manual'
      }
    };
    
    const analysisResult = await storyAnalyst.analyzeStory(analysisInput);
    
    // Then generate split suggestions
    const splitInput = {
      story: analysisInput.story,
      analysisResult: analysisResult,
      invocationContext: {
        trigger: 'manual',
        userPreferences: {
          maxSplits: 5,
          preserveOriginal: false
        }
      },
      projectContext: {
        domain: 'web-application',
        teamExperience: 'intermediate',
        projectPhase: 'mvp'
      }
    };
    
    const splitResult = await splittingExpert.generateSplitSuggestions(splitInput);
    
    const response = formatSplitResponse(splitResult, 'Splitting Expert');
    res.json(response);
  } catch (error) {
    console.error('Split error:', error);
    res.status(500).json({ error: 'Split suggestion failed', details: error.message });
  }
});

app.post('/api/agents/coach', async (req, res) => {
  try {
    // Mock coaching response
    const response = {
      id: `coach-${Date.now()}`,
      object: 'analysis',
      created: Date.now(),
      model: 'story-agent-v1',
      choices: [{
        message: {
          role: 'assistant',
          content: 'Based on agile best practices, here are some coaching tips for your story...',
          function_call: null
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 200,
        total_tokens: 350
      },
      metadata: {
        agent: 'Coaching Assistant',
        tips: [
          'Consider starting with "As a [user type]" to clearly identify the user',
          'Add a "so that" clause to explain the business value',
          'Break down complex workflows into smaller, testable pieces',
          'Define clear acceptance criteria using Given/When/Then format'
        ]
      }
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Coaching failed', details: error.message });
  }
});

app.post('/api/agents/review', async (req, res) => {
  try {
    // Mock review response
    const response = {
      id: `review-${Date.now()}`,
      object: 'analysis',
      created: Date.now(),
      model: 'story-agent-v1',
      choices: [{
        message: {
          role: 'assistant',
          content: 'Quality review complete. Your story meets most INVEST criteria with some areas for improvement.',
          function_call: null
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 180,
        completion_tokens: 250,
        total_tokens: 430
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
          'Add specific acceptance criteria to make the story testable',
          'Include estimation details or break down complex parts',
          'Consider edge cases in your acceptance criteria'
        ]
      }
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Review failed', details: error.message });
  }
});

// Helper functions
function formatAgentResponse(result, agentName) {
  return {
    id: `msg-${Date.now()}`,
    object: 'analysis',
    created: Date.now(),
    model: 'story-agent-v1',
    choices: [{
      message: {
        role: 'assistant',
        content: generateAnalysisContent(result),
        function_call: null
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: result.analysisMetadata?.tokensUsed || 200,
      completion_tokens: 300,
      total_tokens: 500
    },
    metadata: {
      agent: agentName,
      suggestions: extractSuggestions(result),
      criteria: extractCriteria(result.investScore),
      score: calculateScore(result.investScore)
    }
  };
}

function formatSplitResponse(result, agentName) {
  const bestSuggestion = result.suggestions[0];
  
  return {
    id: `msg-${Date.now()}`,
    object: 'analysis',
    created: Date.now(),
    model: 'story-agent-v1',
    choices: [{
      message: {
        role: 'assistant',
        content: `I've identified the ${bestSuggestion?.pattern.name || 'workflow steps'} pattern for splitting this story. ${result.recommendedApproach.reasoning}`,
        function_call: null
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 300,
      completion_tokens: 400,
      total_tokens: 700
    },
    metadata: {
      agent: agentName,
      splits: bestSuggestion ? bestSuggestion.suggestedSplits.map(split => ({
        title: split.title,
        description: split.description,
        priority: getPriorityLabel(split.priority),
        effort: split.estimatedSize === 'XS' || split.estimatedSize === 'S' ? 'Small' : 
                split.estimatedSize === 'M' ? 'Medium' : 'Large',
        storyPoints: getStoryPoints(split.estimatedSize),
        acceptanceCriteria: split.acceptanceCriteria,
        reasoning: split.rationale
      })) : []
    }
  };
}

function generateAnalysisContent(result) {
  const issues = result.qualityIssues || [];
  const suggestions = result.improvementSuggestions || [];
  
  let content = `Analysis complete. `;
  
  if (issues.length > 0) {
    content += `Found ${issues.length} quality issues. `;
  }
  
  if (suggestions.length > 0) {
    content += `I have ${suggestions.length} suggestions to improve this story.`;
  } else {
    content += `This story is well-structured.`;
  }
  
  return content;
}

function extractSuggestions(result) {
  const suggestions = [];
  
  if (result.improvementSuggestions) {
    result.improvementSuggestions.forEach(s => {
      suggestions.push(s.reasoning || s.suggestedValue);
    });
  }
  
  if (result.qualityIssues) {
    result.qualityIssues.forEach(issue => {
      if (issue.suggestion) {
        suggestions.push(issue.issue);
      }
    });
  }
  
  return suggestions.slice(0, 5);
}

function extractCriteria(investScore) {
  if (!investScore) return null;
  
  return {
    Independent: investScore.independent?.score || false,
    Negotiable: investScore.negotiable?.score || false,
    Valuable: investScore.valuable?.score || false,
    Estimable: investScore.estimable?.score || false,
    Small: investScore.small?.score || false,
    Testable: investScore.testable?.score || false
  };
}

function calculateScore(investScore) {
  if (!investScore) return 0;
  
  const criteria = Object.values(investScore);
  const passed = criteria.filter(c => c.score).length;
  return Math.round((passed / criteria.length) * 100);
}

function getPriorityLabel(priority) {
  if (priority === 1) return 'High';
  if (priority === 2) return 'Medium';
  return 'Low';
}

function getStoryPoints(size) {
  switch (size) {
    case 'XS': return 1;
    case 'S': return 2;
    case 'M': return 3;
    case 'L': return 5;
    case 'XL': return 8;
    default: return 0;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    pusher: {
      configured: !!process.env.PUSHER_APP_ID,
      cluster: process.env.PUSHER_CLUSTER || 'not-set'
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Pusher configured: ${!!process.env.PUSHER_APP_ID}`);
});