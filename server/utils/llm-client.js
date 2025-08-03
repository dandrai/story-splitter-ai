// server/utils/llm-client.js
class LLMClient {
  constructor() {
    // Check for API keys
    this.hasClaudeKey = !!process.env.CLAUDE_API_KEY;
    this.hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    
    if (this.hasClaudeKey) {
      console.log('Claude API key detected');
      this.preferredProvider = 'claude';
    } else if (this.hasOpenAIKey) {
      console.log('OpenAI API key detected');
      this.preferredProvider = 'openai';
    } else {
      console.log('No AI API keys found, using mock responses');
      this.preferredProvider = 'mock';
    }
  }

  async analyze(options) {
    const { prompt, temperature = 0.1, maxTokens = 2000 } = options;

    try {
      switch (this.preferredProvider) {
        case 'claude':
          return await this.callClaude(prompt, temperature, maxTokens);
        case 'openai':
          return await this.callOpenAI(prompt, temperature, maxTokens);
        default:
          return await this.mockResponse(prompt);
      }
    } catch (error) {
      console.error('LLM API error:', error);
      // Fallback to mock on error
      return await this.mockResponse(prompt);
    }
  }

  async callClaude(prompt, temperature, maxTokens) {
    // This would use the Anthropic SDK in production
    // For now, return mock response
    console.log('Claude API call would happen here');
    return this.mockResponse(prompt);
  }

  async callOpenAI(prompt, temperature, maxTokens) {
    // This would use the OpenAI SDK in production
    // For now, return mock response
    console.log('OpenAI API call would happen here');
    return this.mockResponse(prompt);
  }

  async mockResponse(prompt) {
    // Enhanced mock that analyzes the prompt
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay

    // Extract story content from prompt
    const storyMatch = prompt.match(/Story.*?:.*?"(.*?)"/s);
    const storyContent = storyMatch ? storyMatch[1] : '';

    // Analyze based on content
    const hasUserRole = storyContent.toLowerCase().includes('as a');
    const hasValue = storyContent.toLowerCase().includes('so that');
    const wordCount = storyContent.split(' ').length;

    return JSON.stringify({
      investScore: {
        independent: {
          score: !storyContent.includes('after') && !storyContent.includes('depends'),
          confidence: 0.8,
          reasoning: 'Analyzed for dependency indicators',
          suggestions: []
        },
        negotiable: {
          score: !storyContent.includes('must use'),
          confidence: 0.7,
          reasoning: 'Checked for implementation constraints',
          suggestions: []
        },
        valuable: {
          score: hasUserRole && hasValue,
          confidence: 0.9,
          reasoning: hasValue ? 'Clear value statement found' : 'Missing value statement',
          suggestions: hasValue ? [] : ['Add "so that" clause to explain value']
        },
        estimable: {
          score: wordCount > 10 && wordCount < 100,
          confidence: 0.7,
          reasoning: 'Story has appropriate level of detail',
          suggestions: wordCount < 10 ? ['Add more detail'] : []
        },
        small: {
          score: wordCount < 50,
          confidence: 0.6,
          reasoning: 'Story size assessment',
          suggestions: wordCount > 50 ? ['Consider splitting this story'] : []
        },
        testable: {
          score: storyContent.includes('can'),
          confidence: 0.8,
          reasoning: 'Story describes testable behavior',
          suggestions: ['Add specific acceptance criteria']
        }
      },
      sizeAssessment: {
        estimatedSize: wordCount < 20 ? 'S' : wordCount < 40 ? 'M' : 'L',
        confidence: 0.7
      },
      qualityIssues: [],
      overallScore: hasUserRole && hasValue ? 75 : 50
    });
  }
}

module.exports = { LLMClient };
