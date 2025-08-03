// agents/story-analyst.js
class StoryAnalystAgent {
  constructor(llmClient) {
    this.llmClient = llmClient;
    this.cache = new Map();
  }

  async analyzeStory(input) {
    try {
      // Check cache
      const cacheKey = this.generateCacheKey(input);
      const cachedResult = this.cache.get(cacheKey);
      
      if (cachedResult && this.isCacheValid(cachedResult)) {
        return cachedResult;
      }

      // Perform analysis
      const analysis = await this.performAnalysis(input);
      
      // Create interactive result
      const interactiveResult = this.createInteractiveAnalysis(analysis, input);
      
      // Cache result
      this.cache.set(cacheKey, interactiveResult);
      
      return interactiveResult;

    } catch (error) {
      console.error('Story analysis failed:', error);
      return this.fallbackAnalysis(input.story);
    }
  }

  async performAnalysis(input) {
    const { story } = input;
    
    // Analyze INVEST criteria
    const investScore = {
      independent: this.analyzeIndependence(story),
      negotiable: this.analyzeNegotiability(story),
      valuable: this.analyzeValue(story),
      estimable: this.analyzeEstimability(story),
      small: this.analyzeSize(story),
      testable: this.analyzeTestability(story)
    };

    // Analyze size
    const sizeAssessment = this.assessSize(story);
    
    // Find quality issues
    const qualityIssues = this.findQualityIssues(story, investScore);
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore(investScore);

    return {
      investScore,
      sizeAssessment,
      qualityIssues,
      overallScore,
      readinessLevel: overallScore >= 80 ? 'ready' : overallScore >= 60 ? 'needs-work' : 'not-ready',
      analysisMetadata: {
        analysisTime: new Date(),
        confidence: 0.85,
        tokensUsed: 250,
        modelVersion: 'story-analyst-v1'
      }
    };
  }

  analyzeIndependence(story) {
    const hasNoDependencies = !story.description.match(/after|before|requires|depends on/i);
    const confidence = 0.8;
    
    return {
      score: hasNoDependencies,
      confidence,
      reasoning: hasNoDependencies 
        ? 'Story appears to be independent of other stories'
        : 'Story contains dependency indicators',
      suggestions: hasNoDependencies ? [] : [{
        type: 'modify',
        field: 'description',
        currentValue: story.description,
        suggestedValue: 'Consider rephrasing to remove dependencies',
        reasoning: 'Independent stories can be developed and delivered separately',
        confidence: 0.7
      }],
      severity: hasNoDependencies ? 'low' : 'medium',
      isEditable: true
    };
  }

  analyzeNegotiability(story) {
    const hasImplementationDetails = story.description.match(/must use|should be implemented|technical requirement/i);
    const score = !hasImplementationDetails;
    
    return {
      score,
      confidence: 0.7,
      reasoning: score 
        ? 'Story focuses on user needs rather than implementation'
        : 'Story contains implementation details that reduce negotiability',
      suggestions: score ? [] : [{
        type: 'modify',
        field: 'description',
        currentValue: story.description,
        suggestedValue: 'Focus on what the user needs, not how to implement it',
        reasoning: 'Negotiable stories allow for creative solutions',
        confidence: 0.8
      }],
      severity: 'low',
      isEditable: true
    };
  }

  analyzeValue(story) {
    const hasUserValue = story.description.toLowerCase().includes('so that');
    const hasUserRole = story.description.match(/as a|as an/i);
    const score = hasUserValue && hasUserRole;
    
    return {
      score,
      confidence: 0.9,
      reasoning: score 
        ? 'Story clearly expresses user value'
        : 'Story needs clearer value proposition',
      suggestions: score ? [] : [{
        type: 'modify',
        field: 'description',
        currentValue: story.description,
        suggestedValue: this.suggestValueStatement(story),
        reasoning: 'Every story should deliver clear value to users',
        confidence: 0.85
      }],
      severity: score ? 'low' : 'high',
      isEditable: true
    };
  }

  analyzeEstimability(story) {
    const hasEnoughDetail = story.description.length > 50;
    const hasCriteria = story.acceptanceCriteria && story.acceptanceCriteria.length > 0;
    const score = hasEnoughDetail && hasCriteria;
    
    return {
      score,
      confidence: 0.75,
      reasoning: score 
        ? 'Story has sufficient detail for estimation'
        : 'Story needs more detail to be properly estimated',
      suggestions: score ? [] : [
        !hasCriteria && {
          type: 'add',
          field: 'acceptanceCriteria',
          currentValue: '',
          suggestedValue: 'Given [context], When [action], Then [outcome]',
          reasoning: 'Acceptance criteria help with estimation',
          confidence: 0.9
        }
      ].filter(Boolean),
      severity: 'medium',
      isEditable: true
    };
  }

  analyzeSize(story) {
    const wordCount = story.description.split(' ').length;
    const criteriaCount = story.acceptanceCriteria?.length || 0;
    const complexity = wordCount + (criteriaCount * 10);
    
    const score = complexity < 100;
    
    return {
      score,
      confidence: 0.6,
      reasoning: score 
        ? 'Story appears to be appropriately sized'
        : 'Story may be too large and should be split',
      suggestions: score ? [] : [{
        type: 'split',
        field: 'description',
        currentValue: story.description,
        suggestedValue: 'Consider splitting this story into smaller pieces',
        reasoning: 'Smaller stories are easier to estimate and deliver',
        confidence: 0.8
      }],
      severity: score ? 'low' : 'high',
      isEditable: false
    };
  }

  analyzeTestability(story) {
    const hasCriteria = story.acceptanceCriteria && story.acceptanceCriteria.length > 0;
    const criteriaAreTestable = hasCriteria && story.acceptanceCriteria.every(
      criteria => criteria.match(/given|when|then|should|must|can/i)
    );
    
    const score = hasCriteria && criteriaAreTestable;
    
    return {
      score,
      confidence: 0.85,
      reasoning: score 
        ? 'Story has clear, testable acceptance criteria'
        : 'Story needs testable acceptance criteria',
      suggestions: score ? [] : [{
        type: hasCriteria ? 'modify' : 'add',
        field: 'acceptanceCriteria',
        currentValue: hasCriteria ? story.acceptanceCriteria.join('; ') : '',
        suggestedValue: 'Use Given/When/Then format for clear test scenarios',
        reasoning: 'Testable stories ensure quality delivery',
        confidence: 0.9
      }],
      severity: score ? 'low' : 'high',
      isEditable: true
    };
  }

  assessSize(story) {
    const description = story.description || '';
    const criteriaCount = story.acceptanceCriteria?.length || 0;
    
    // Simple heuristic for size
    const complexity = description.length + (criteriaCount * 50);
    
    let estimatedSize;
    if (complexity < 100) estimatedSize = 'XS';
    else if (complexity < 200) estimatedSize = 'S';
    else if (complexity < 400) estimatedSize = 'M';
    else if (complexity < 600) estimatedSize = 'L';
    else if (complexity < 800) estimatedSize = 'XL';
    else estimatedSize = 'XXL';
    
    return {
      estimatedSize,
      confidence: 0.7,
      complexityFactors: [
        'Description length',
        'Number of acceptance criteria',
        'Implied technical complexity'
      ],
      riskFactors: estimatedSize === 'XL' || estimatedSize === 'XXL' 
        ? ['Size may impact delivery timeline', 'Consider splitting']
        : []
    };
  }

  findQualityIssues(story, investScore) {
    const issues = [];
    
    // Check for missing user role
    if (!story.description.match(/as a|as an/i)) {
      issues.push({
        id: 'missing-user-role',
        issue: 'Story missing user role',
        category: 'structure',
        severity: 'high',
        suggestion: this.suggestUserRole(story),
        autoFixable: true
      });
    }
    
    // Check for missing value statement
    if (!story.description.toLowerCase().includes('so that')) {
      issues.push({
        id: 'missing-value',
        issue: 'Story missing value statement',
        category: 'completeness',
        severity: 'high',
        suggestion: this.suggestValueStatement(story),
        autoFixable: true
      });
    }
    
    // Check for vague language
    const vagueTerms = ['some', 'various', 'multiple', 'etc', 'and so on'];
    const hasVagueLanguage = vagueTerms.some(term => 
      story.description.toLowerCase().includes(term)
    );
    
    if (hasVagueLanguage) {
      issues.push({
        id: 'vague-language',
        issue: 'Story contains vague language',
        category: 'clarity',
        severity: 'medium',
        suggestion: 'Replace vague terms with specific requirements',
        autoFixable: false
      });
    }
    
    return issues;
  }

  calculateOverallScore(investScore) {
    const scores = Object.values(investScore);
    const passedCount = scores.filter(s => s.score).length;
    return Math.round((passedCount / scores.length) * 100);
  }

  createInteractiveAnalysis(analysis, input) {
    const improvementSuggestions = this.generateImprovementSuggestions(analysis, input.story);
    const improvedStory = this.applyAllSuggestionsToStory(input.story, improvementSuggestions);
    
    return {
      ...analysis,
      improvementSuggestions,
      preview: {
        originalStory: input.story,
        improvedStory,
        storyBoardImpact: this.calculateStoryBoardImpact(input.story, improvedStory)
      },
      userState: {
        status: 'suggested',
        appliedSuggestions: [],
        editHistory: []
      },
      validation: {
        canApply: true,
        warnings: [],
        conflicts: []
      },
      shouldTriggerOtherAgents: {
        splitter: analysis.sizeAssessment.estimatedSize === 'XL' || 
                  analysis.sizeAssessment.estimatedSize === 'XXL',
        coach: analysis.overallScore < 60,
        reviewer: true
      }
    };
  }

  generateImprovementSuggestions(analysis, story) {
    const suggestions = [];
    let suggestionId = 0;
    
    // Generate from INVEST criteria
    Object.entries(analysis.investScore).forEach(([criterion, result]) => {
      if (!result.score && result.suggestions) {
        result.suggestions.forEach(suggestion => {
          suggestions.push({
            id: `suggestion-${++suggestionId}`,
            ...suggestion
          });
        });
      }
    });
    
    // Generate from quality issues
    analysis.qualityIssues.forEach(issue => {
      if (issue.autoFixable && issue.suggestion) {
        suggestions.push({
          id: `suggestion-${++suggestionId}`,
          type: 'modify',
          field: this.inferFieldFromIssue(issue),
          currentValue: this.getCurrentValue(story, this.inferFieldFromIssue(issue)),
          suggestedValue: issue.suggestion,
          reasoning: issue.issue,
          confidence: 0.8
        });
      }
    });
    
    return suggestions;
  }

  suggestUserRole(story) {
    // Simple heuristic to suggest a user role
    if (story.title.toLowerCase().includes('admin')) {
      return 'As an administrator, ' + story.description;
    } else if (story.title.toLowerCase().includes('customer') || story.title.toLowerCase().includes('user')) {
      return 'As a user, ' + story.description;
    }
    return 'As a [user type], ' + story.description;
  }

  suggestValueStatement(story) {
    const base = story.description;
    if (!base.match(/as a|as an/i)) {
      return this.suggestUserRole(story) + ' so that [value statement]';
    }
    return base + ' so that [value statement]';
  }

  applyAllSuggestionsToStory(story, suggestions) {
    let updatedStory = { ...story };
    
    suggestions.forEach(suggestion => {
      if (suggestion.confidence > 0.6) {
        updatedStory = this.applySuggestionToStory(updatedStory, suggestion);
      }
    });
    
    return updatedStory;
  }

  applySuggestionToStory(story, suggestion) {
    const updatedStory = { ...story };
    
    switch (suggestion.field) {
      case 'title':
        updatedStory.title = suggestion.suggestedValue;
        break;
      case 'description':
        updatedStory.description = suggestion.suggestedValue;
        break;
      case 'acceptanceCriteria':
        if (suggestion.type === 'add') {
          updatedStory.acceptanceCriteria = [
            ...(updatedStory.acceptanceCriteria || []),
            suggestion.suggestedValue
          ];
        }
        break;
    }
    
    return updatedStory;
  }

  calculateStoryBoardImpact(original, updated) {
    const changes = [];
    
    if (original.title !== updated.title || 
        original.description !== updated.description ||
        JSON.stringify(original.acceptanceCriteria) !== JSON.stringify(updated.acceptanceCriteria)) {
      changes.push({
        type: 'modify',
        storyId: original.id,
        changes: {
          title: updated.title,
          description: updated.description,
          acceptanceCriteria: updated.acceptanceCriteria
        },
        visualIndicators: {
          qualityScore: this.calculateSimpleQualityScore(updated),
          badges: this.getQualityBadges(this.calculateSimpleQualityScore(updated)),
          highlights: this.getChangedFields(original, updated)
        }
      });
    }
    
    return changes;
  }

  calculateSimpleQualityScore(story) {
    let score = 0;
    
    if (story.title && story.title.length > 5) score += 20;
    if (story.description && story.description.length > 20) score += 20;
    if (story.description && story.description.toLowerCase().includes('as a')) score += 10;
    if (story.description && story.description.toLowerCase().includes('so that')) score += 10;
    if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) score += 20;
    if (story.acceptanceCriteria && story.acceptanceCriteria.length > 2) score += 10;
    if (story.estimatedSize) score += 10;
    
    return score;
  }

  getQualityBadges(score) {
    if (score >= 80) return ['excellent'];
    if (score >= 60) return ['good'];
    if (score >= 40) return ['needs-work'];
    return ['incomplete'];
  }

  getChangedFields(original, updated) {
    const changes = [];
    
    if (original.title !== updated.title) changes.push('title');
    if (original.description !== updated.description) changes.push('description');
    if (JSON.stringify(original.acceptanceCriteria) !== JSON.stringify(updated.acceptanceCriteria)) {
      changes.push('acceptanceCriteria');
    }
    
    return changes;
  }

  inferFieldFromIssue(issue) {
    if (issue.id.includes('title')) return 'title';
    if (issue.id.includes('criteria')) return 'acceptanceCriteria';
    return 'description';
  }

  getCurrentValue(story, field) {
    switch (field) {
      case 'title': return story.title;
      case 'description': return story.description;
      case 'acceptanceCriteria': return story.acceptanceCriteria?.join('; ') || '';
      default: return '';
    }
  }

  generateCacheKey(input) {
    const story = input.story;
    const content = story.title + story.description + (story.acceptanceCriteria?.join('') || '');
    return `analyst_${story.id}_${this.hashContent(content)}_${story.version}`;
  }

  hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  isCacheValid(cachedResult) {
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const age = Date.now() - cachedResult.analysisMetadata.analysisTime.getTime();
    return age < maxAge;
  }

  fallbackAnalysis(story) {
    return {
      investScore: {
        independent: { score: true, confidence: 0.5, reasoning: 'Unable to analyze', suggestions: [], severity: 'low', isEditable: false },
        negotiable: { score: true, confidence: 0.5, reasoning: 'Unable to analyze', suggestions: [], severity: 'low', isEditable: false },
        valuable: { score: false, confidence: 0.5, reasoning: 'Unable to analyze', suggestions: [], severity: 'medium', isEditable: false },
        estimable: { score: false, confidence: 0.5, reasoning: 'Unable to analyze', suggestions: [], severity: 'medium', isEditable: false },
        small: { score: true, confidence: 0.5, reasoning: 'Unable to analyze', suggestions: [], severity: 'low', isEditable: false },
        testable: { score: false, confidence: 0.5, reasoning: 'Unable to analyze', suggestions: [], severity: 'high', isEditable: false }
      },
      sizeAssessment: {
        estimatedSize: 'M',
        confidence: 0.3,
        complexityFactors: ['Unable to analyze'],
        riskFactors: []
      },
      qualityIssues: [],
      overallScore: 50,
      readinessLevel: 'needs-work',
      improvementSuggestions: [],
      preview: {
        originalStory: story,
        improvedStory: story,
        storyBoardImpact: []
      },
      userState: {
        status: 'suggested',
        appliedSuggestions: [],
        editHistory: []
      },
      validation: {
        canApply: false,
        warnings: ['Analysis failed - using fallback'],
        conflicts: []
      },
      analysisMetadata: {
        analysisTime: new Date(),
        confidence: 0.3,
        tokensUsed: 0,
        modelVersion: 'fallback'
      },
      shouldTriggerOtherAgents: {
        splitter: false,
        coach: true,
        reviewer: false
      }
    };
  }
}

module.exports = { StoryAnalystAgent };
