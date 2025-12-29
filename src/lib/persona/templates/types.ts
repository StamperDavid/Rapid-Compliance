import 'server-only';

import type { ResearchIntelligence } from '@/types/scraper-intelligence';

export interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  
  coreIdentity: {
    title: string;
    positioning: string;
    tone: string;
  };
  
  cognitiveLogic: {
    framework: string;
    reasoning: string;
    decisionProcess: string;
  };
  
  knowledgeRAG: {
    static: string[];
    dynamic: string[];
  };
  
  learningLoops: {
    patternRecognition: string;
    adaptation: string;
    feedbackIntegration: string;
  };
  
  tacticalExecution: {
    primaryAction: string;
    conversionRhythm: string;
    secondaryActions: string[];
  };

  research?: ResearchIntelligence;
}
