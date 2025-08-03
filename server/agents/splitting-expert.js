// agents/splitting-expert.js
class SplittingExpertAgent {
  constructor(llmClient) {
    this.llmClient = llmClient;
    this.patternDetector = new PatternDetector();
  }

  async generateSplitSuggestions(input) {
    try {
      // Detect applicable patterns
      const applicablePatterns = this.patternDetector.detectPatterns(input.story, input.analysisResult);
      
      if (applicablePatterns.length === 0) {
        return this.createNoSplitResult(input.story, 'Story is already appropriately sized');
      }

      // Generate split suggestions based on patterns
      const suggestions = await this.createSplitSuggestions(input, applicablePatterns);
      
      // Create interactive suggestions
      const interactiveSuggestions = await this.createInteractiveSuggestions(suggestions, input);

      return {
        suggestions: interactiveSuggestions,
        recommendedApproach: this.selectRecommendedApproach(interactiveSuggestions),
        metadata: {
          analysisTime: new Date(),
          confidence: this.calculateOverallConfidence(interactiveSuggestions),
          patternsConsidered: applicablePatterns.map(p => p.type)
        }
      };

    } catch (error) {
      console.error('Split suggestion generation failed:', error);
      return this.createFallbackSuggestions(input);
    }
  }

  async createSplitSuggestions(input, patterns) {
    const suggestions = [];
    
    for (const pattern of patterns) {
      const suggestion = await this.generateSuggestionForPattern(input, pattern);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
    
    return suggestions;
  }

  async generateSuggestionForPattern(input, pattern) {
    switch (pattern.type) {
      case 'workflow-steps':
        return this.generateWorkflowSplits(input, pattern);
      case 'crud-operations':
        return this.generateCRUDSplits(input, pattern);
      case 'business-rules':
        return this.generateBusinessRuleSplits(input, pattern);
      case 'simple-complex':
        return this.generateSimpleComplexSplits(input, pattern);
      default:
        return null;
    }
  }

  generateWorkflowSplits(input, pattern) {
    const { story } = input;
    const steps = this.extractWorkflowSteps(story);
    
    if (steps.length < 2) return null;
    
    const suggestedSplits = steps.map((step, index) => ({
      id: `split-${Date.now()}-${index}`,
      title: step.title,
      description: step.description,
      acceptanceCriteria: step.criteria,
      estimatedSize: this.estimateStepSize(step),
      priority: index + 1,
      rationale: `Step ${index + 1} of the workflow`
    }));
    
    return {
      id: `suggestion-workflow-${Date.now()}`,
      pattern,
      confidence: 0.8,
      reasoning: 'Story contains multiple workflow steps that can be delivered independently',
      suggestedSplits,
      implementationOrder: suggestedSplits.map(s => s.id),
      valueDeliveryStrategy: 'Deliver each workflow step incrementally',
      riskMitigation: ['Ensure each step provides value independently']
    };
  }

  generateCRUDSplits(input, pattern) {
    const { story } = input;
    const operations = this.extractCRUDOperations(story);
    
    if (operations.length < 2) return null;
    
    const suggestedSplits = operations.map((op, index) => ({
      id: `split-${Date.now()}-${index}`,
      title: `${op.entity} - ${op.operation}`,
      description: `As a user, I can ${op.operation.toLowerCase()} ${op.entity}`,
      acceptanceCriteria: this.generateCRUDCriteria(op),
      estimatedSize: op.operation === 'Create' || op.operation === 'Delete' ? 'S' : 'M',
      priority: this.getCRUDPriority(op.operation),
      rationale: `${op.operation} operation for ${op.entity}`
    }));
    
    return {
      id: `suggestion-crud-${Date.now()}`,
      pattern,
      confidence: 0.85,
      reasoning: 'Story involves multiple CRUD operations that can be split',
      suggestedSplits,
      implementationOrder: suggestedSplits.sort((a, b) => a.priority - b.priority).map(s => s.id),
      valueDeliveryStrategy: 'Start with Read operations, then Create, Update, and Delete',
      riskMitigation: ['Ensure data model is well-defined before starting']
    };
  }

  generateBusinessRuleSplits(input, pattern) {
    const { story } = input;
    const rules = this.extractBusinessRules(story);
    
    if (rules.length < 2) return null;
    
    // First split: simple happy path
    const suggestedSplits = [
      {
        id: `split-${Date.now()}-0`,
        title: `${story.title} - Basic Flow`,
        description: `${story.description} (basic scenario without special cases)`,
        acceptanceCriteria: ['Basic functionality works as expected'],
        estimatedSize: 'S',
        priority: 1,
        rationale: 'Core functionality without edge cases'
      }
    ];
    
    // Additional splits for each business rule
    rules.forEach((rule, index) => {
      suggestedSplits.push({
        id: `split-${Date.now()}-${index + 1}`,
        title: `${story.title} - ${rule.name}`,
        description: rule.description,
        acceptanceCriteria: rule.criteria,
        estimatedSize: 'S',
        priority: index + 2,
        rationale: `Handle ${rule.name} scenario`
      });
    });
    
    return {
      id: `suggestion-rules-${Date.now()}`,
      pattern,
      confidence: 0.75,
      reasoning: 'Story contains multiple business rules that can be implemented separately',
      suggestedSplits,
      implementationOrder: suggestedSplits.map(s => s.id),
      valueDeliveryStrategy: 'Implement core functionality first, then add business rules',
      riskMitigation: ['Document all business rules clearly', 'Test edge cases thoroughly']
    };
  }

  generateSimpleComplexSplits(input, pattern) {
    const { story } = input;
    
    // Create a simple version and a complex version
    const suggestedSplits = [
      {
        id: `split-${Date.now()}-0`,
        title: `${story.title} - Basic Version`,
        description: this.simplifyDescription(story.description),
        acceptanceCriteria: this.simplifyAcceptanceCriteria(story.acceptanceCriteria),
        estimatedSize: 'M',
        priority: 1,
        rationale: 'Simplified version with core functionality only'
      },
      {
        id: `split-${Date.now()}-1`,
        title: `${story.title} - Enhanced Features`,
        description: 'Add advanced features and edge case handling',
        acceptanceCriteria: this.extractComplexCriteria(story.acceptanceCriteria),
        estimatedSize: 'M',
        priority: 2,
        rationale: 'Additional features and complexity'
      }
    ];
    
    return {
      id: `suggestion-simple-complex-${Date.now()}`,
      pattern,
      confidence: 0.7,
      reasoning: 'Story is complex and can be split into simple and advanced versions',
      suggestedSplits,
      implementationOrder: suggestedSplits.map(s => s.id),
      valueDeliveryStrategy: 'Deliver simple version first, then enhance',
      riskMitigation: ['Ensure simple version is valuable on its own']
    };
  }

  extractWorkflowSteps(story) {
    const steps = [];
    const description = story.description.toLowerCase();
    
    // Look for sequential indicators
    const sequentialWords = ['first', 'then', 'next', 'after', 'finally'];
    const sentences = description.split(/[.!?]/);
    
    sentences.forEach((sentence, index) => {
      if (sequentialWords.some(word => sentence.includes(word))) {
        steps.push({
          title: `Step ${steps.length + 1}`,
          description: sentence.trim(),
          criteria: [`${sentence.trim()} is completed successfully`]
        });
      }
    });
    
    // If no explicit steps found, try to infer from acceptance criteria
    if (steps.length === 0 && story.acceptanceCriteria) {
      story.acceptanceCriteria.forEach((criteria, index) => {
        if (criteria.toLowerCase().includes('when')) {
          steps.push({
            title: `Scenario ${index + 1}`,
            description: criteria,
            criteria: [criteria]
          });
        }
      });
    }
    
    return steps;
  }

  extractCRUDOperations(story) {
    const operations = [];
    const crudMap = {
      'create': 'Create',
      'add': 'Create',
      'new': 'Create',
      'read': 'Read',
      'view': 'Read',
      'list': 'Read',
      'show': 'Read',
      'update': 'Update',
      'edit': 'Update',
      'modify': 'Update',
      'delete': 'Delete',
      'remove': 'Delete'
    };
    
    const text = (story.description + ' ' + story.title).toLowerCase();
    const entities = this.extractEntities(text);
    
    Object.entries(crudMap).forEach(([keyword, operation]) => {
      if (text.includes(keyword)) {
        entities.forEach(entity => {
          operations.push({ operation, entity });
        });
      }
    });
    
    // Remove duplicates
    return operations.filter((op, index, self) => 
      index === self.findIndex(o => o.operation === op.operation && o.entity === op.entity)
    );
  }

  extractEntities(text) {
    // Simple entity extraction - look for nouns after verbs
    const entities = [];
    const commonEntities = ['user', 'product', 'order', 'item', 'profile', 'account', 'data', 'information'];
    
    commonEntities.forEach(entity => {
      if (text.includes(entity)) {
        entities.push(entity);
      }
    });
    
    return entities.length > 0 ? entities : ['item'];
  }

  extractBusinessRules(story) {
    const rules = [];
    const ruleIndicators = ['if', 'when', 'unless', 'depending on', 'based on'];
    
    const text = story.description + ' ' + (story.acceptanceCriteria?.join(' ') || '');
    
    ruleIndicators.forEach(indicator => {
      const regex = new RegExp(`${indicator}\\s+([^,\\.]+)`, 'gi');
      const matches = text.match(regex);
      
      if (matches) {
        matches.forEach((match, index) => {
          rules.push({
            name: `Rule ${index + 1}`,
            description: match,
            criteria: [`System handles case: ${match}`]
          });
        });
      }
    });
    
    return rules;
  }

  generateCRUDCriteria(operation) {
    const criteria = [];
    
    switch (operation.operation) {
      case 'Create':
        criteria.push(`User can create new ${operation.entity}`);
        criteria.push(`Required fields are validated`);
        criteria.push(`Success message is displayed`);
        break;
      case 'Read':
        criteria.push(`User can view ${operation.entity} details`);
        criteria.push(`All relevant information is displayed`);
        break;
      case 'Update':
        criteria.push(`User can edit existing ${operation.entity}`);
        criteria.push(`Changes are saved successfully`);
        criteria.push(`Validation prevents invalid updates`);
        break;
      case 'Delete':
        criteria.push(`User can delete ${operation.entity}`);
        criteria.push(`Confirmation is required before deletion`);
        criteria.push(`Deleted items are removed from view`);
        break;
    }
    
    return criteria;
  }

  getCRUDPriority(operation) {
    const priorities = {
      'Read': 1,
      'Create': 2,
      'Update': 3,
      'Delete': 4
    };
    return priorities[operation] || 5;
  }

  simplifyDescription(description) {
    // Remove complex clauses and conditionals
    return description
      .replace(/\s*(if|when|unless|depending on|based on)[^,\.]+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  simplifyAcceptanceCriteria(criteria) {
    if (!criteria || criteria.length === 0) {
      return ['Basic functionality works as expected'];
    }
    
    // Take only the most essential criteria
    return criteria.slice(0, 2).map(c => 
      c.replace(/\s*(edge case|special case|exception)/gi, '').trim()
    );
  }

  extractComplexCriteria(criteria) {
    if (!criteria || criteria.length === 0) {
      return ['Handle edge cases and exceptions'];
    }
    
    // Focus on complex scenarios
    const complexCriteria = criteria.filter(c => 
      c.match(/edge case|special case|exception|complex|advanced/i)
    );
    
    return complexCriteria.length > 0 ? complexCriteria : ['Handle advanced scenarios'];
  }

  estimateStepSize(step) {
    const complexity = step.description.length + (step.criteria.length * 20);
    
    if (complexity < 50) return 'XS';
    if (complexity < 100) return 'S';
    if (complexity < 200) return 'M';
    return 'L';
  }

  async createInteractiveSuggestions(suggestions, input) {
    return suggestions.map(suggestion => ({
      ...suggestion,
      userState: {
        status: 'suggested',
        editHistory: []
      },
      preview: {
        beforeAfter: {
          original: input.story,
          splits: suggestion.suggestedSplits.map(draft => this.draftToStory(draft))
        },
        storyBoardImpact: this.calculateStoryBoardImpact(suggestion, input)
      },
      validation: {
        canApply: true,
        warnings: [],
        conflicts: []
      }
    }));
  }

  draftToStory(draft) {
    return {
      id: draft.id,
      title: draft.title,
      description: draft.description,
      acceptanceCriteria: draft.acceptanceCriteria,
      estimatedSize: draft.estimatedSize,
      status: 'draft',
      version: 1,
      lastModified: new Date()
    };
  }

  calculateStoryBoardImpact(suggestion, input) {
    const changes = [];
    
    // Mark original as split
    changes.push({
      type: 'modify',
      storyId: input.story.id || 'original',
      changes: { 
        status: 'split',
        title: `${input.story.title} (SPLIT)`
      }
    });
    
    // Add new stories
    suggestion.suggestedSplits.forEach((split, index) => {
      changes.push({
        type: 'add',
        storyId: split.id,
        position: { x: index * 200, y: 100 },
        parentId: input.story.id,
        changes: this.draftToStory(split)
      });
    });
    
    return changes;
  }

  selectRecommendedApproach(suggestions) {
    if (suggestions.length === 0) {
      return {
        primarySuggestion: 'no-split',
        reasoning: 'Story is already appropriately sized'
      };
    }
    
    // Select highest confidence suggestion
    const best = suggestions.reduce((prev, current) => 
      current.confidence > prev.confidence ? current : prev
    );
    
    return {
      primarySuggestion: best.id,
      reasoning: best.reasoning
    };
  }

  calculateOverallConfidence(suggestions) {
    if (suggestions.length === 0) return 0.9;
    
    const avgConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length;
    return Math.round(avgConfidence * 100) / 100;
  }

  createNoSplitResult(story, reason) {
    return {
      suggestions: [],
      recommendedApproach: {
        primarySuggestion: 'no-split',
        reasoning: reason
      },
      metadata: {
        analysisTime: new Date(),
        confidence: 0.9,
        patternsConsidered: []
      }
    };
  }

  createFallbackSuggestions(input) {
    return {
      suggestions: [],
      recommendedApproach: {
        primarySuggestion: 'manual',
        reasoning: 'Automated splitting unavailable - manual splitting recommended'
      },
      metadata: {
        analysisTime: new Date(),
        confidence: 0.3,
        patternsConsidered: ['manual']
      }
    };
  }
}

class PatternDetector {
  detectPatterns(story, analysisResult) {
    const patterns = [];
    
    if (this.hasWorkflowSteps(story)) {
      patterns.push({
        type: 'workflow-steps',
        name: 'Workflow Steps',
        description: 'Split by user journey steps'
      });
    }
    
    if (this.hasCRUDOperations(story)) {
      patterns.push({
        type: 'crud-operations',
        name: 'CRUD Operations',
        description: 'Split by Create, Read, Update, Delete operations'
      });
    }
    
    if (this.hasBusinessRules(story)) {
      patterns.push({
        type: 'business-rules',
        name: 'Business Rule Variations',
        description: 'Split by different business rule scenarios'
      });
    }
    
    if (analysisResult.sizeAssessment.estimatedSize === 'XL' || 
        analysisResult.sizeAssessment.estimatedSize === 'XXL') {
      patterns.push({
        type: 'simple-complex',
        name: 'Simple/Complex',
        description: 'Start with simple core, add complexity later'
      });
    }
    
    return patterns;
  }
  
  hasWorkflowSteps(story) {
    const indicators = ['then', 'after', 'before', 'first', 'next', 'finally', 'step'];
    const text = (story.description + ' ' + (story.acceptanceCriteria?.join(' ') || '')).toLowerCase();
    return indicators.some(indicator => text.includes(indicator));
  }
  
  hasCRUDOperations(story) {
    const crudWords = ['create', 'add', 'view', 'read', 'list', 'edit', 'update', 'delete', 'remove'];
    const text = story.description.toLowerCase();
    return crudWords.filter(word => text.includes(word)).length >= 2;
  }
  
  hasBusinessRules(story) {
    const ruleIndicators = ['if', 'when', 'unless', 'depending', 'based on'];
    const text = (story.description + ' ' + (story.acceptanceCriteria?.join(' ') || '')).toLowerCase();
    return ruleIndicators.some(indicator => text.includes(indicator));
  }
}

module.exports = { SplittingExpertAgent };
