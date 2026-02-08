/**
 * Training → Persona Refinement System
 *
 * Analyzes training sessions to identify issues and automatically
 * update the agent persona for continuous improvement.
 */

export interface TrainingSession {
  id: string;
  scenario: string;
  userMessage: string;
  agentResponse: string;
  feedback: {
    rating: number;
    issues: TrainingIssue[];
    comments?: string;
  };
  timestamp: string;
}

export interface TrainingIssue {
  type: 'verbosity' | 'accuracy' | 'brand-alignment' | 'tone' | 'off-topic' | 'repetition';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestedFix?: string;
}

export interface PersonaRefinement {
  category: 'verbosity' | 'accuracy' | 'brand-alignment' | 'tone';
  adjustment: string;
  reasoning: string;
  confidence: number;
}

interface VerbosityControl {
  maxResponseLength: number;
  preferBulletPoints: boolean;
  avoidRepetition: boolean;
  conversationalPacing: string;
}

interface TrainingInsight {
  date: string;
  issue: string;
  adjustment: string;
  category: string;
}

interface PersonaWithTraining {
  trainingInsights?: TrainingInsight[];
  verbosityControl?: VerbosityControl;
  accuracyRules?: string[];
  brandAlignmentNotes?: string;
  dynamicToneRegister?: string;
  [key: string]: unknown;
}

/**
 * Analyzes a training session and generates persona refinements
 */
export function analyzeTrainingSession(session: TrainingSession): PersonaRefinement[] {
  const refinements: PersonaRefinement[] = [];

  for (const issue of session.feedback.issues) {
    switch (issue.type) {
      case 'verbosity':
        refinements.push(analyzeVerbosityIssue(session, issue));
        break;
      case 'accuracy':
        refinements.push(analyzeAccuracyIssue(session, issue));
        break;
      case 'brand-alignment':
        refinements.push(analyzeBrandAlignmentIssue(session, issue));
        break;
      case 'tone':
        refinements.push(analyzeToneIssue(session, issue));
        break;
      case 'repetition':
        refinements.push(analyzeRepetitionIssue(session, issue));
        break;
    }
  }

  return refinements.filter(r => r.confidence > 0.6);
}

/**
 * Analyzes verbosity issues ("too gabby")
 */
function analyzeVerbosityIssue(session: TrainingSession, issue: TrainingIssue): PersonaRefinement {
  const responseLength = session.agentResponse.split(' ').length;
  const hasMultipleParagraphs = session.agentResponse.split('\n\n').length > 2;

  let adjustment = '';
  let confidence = 0.7;

  if (responseLength > 300) {
    adjustment = `Reduce maxResponseLength to ${Math.floor(responseLength * 0.7)} words`;
    confidence = 0.9;
  } else if (hasMultipleParagraphs) {
    adjustment = 'Enable preferBulletPoints and set conversationalPacing to "concise"';
    confidence = 0.8;
  } else {
    adjustment = 'Enable avoidRepetition flag';
    confidence = 0.6;
  }

  return {
    category: 'verbosity',
    adjustment,
    reasoning: `Response was ${responseLength} words. User feedback: "${issue.description}"`,
    confidence
  };
}

/**
 * Analyzes accuracy issues
 */
function analyzeAccuracyIssue(session: TrainingSession, issue: TrainingIssue): PersonaRefinement {
  // Extract what was inaccurate
  const inaccurateTopic = extractTopicFromIssue(issue.description);

  const rule = (issue.suggestedFix !== '' && issue.suggestedFix != null)
    ? issue.suggestedFix
    : `Always verify ${inaccurateTopic} from authoritative source before responding`;

  return {
    category: 'accuracy',
    adjustment: `Add accuracy rule: "${rule}"`,
    reasoning: `Inaccuracy detected in: ${issue.description}`,
    confidence: issue.severity === 'high' ? 0.95 : 0.75
  };
}

/**
 * Analyzes brand alignment issues
 */
function analyzeBrandAlignmentIssue(session: TrainingSession, issue: TrainingIssue): PersonaRefinement {
  return {
    category: 'brand-alignment',
    adjustment: `Brand alignment note: ${issue.description}. ${(issue.suggestedFix !== '' && issue.suggestedFix != null) ? issue.suggestedFix : 'Adjust tone to match brand voice'}`,
    reasoning: `Brand misalignment: ${issue.description}`,
    confidence: 0.8
  };
}

/**
 * Analyzes tone issues
 */
function analyzeToneIssue(session: TrainingSession, issue: TrainingIssue): PersonaRefinement {
  let adjustment = '';

  if (issue.description.toLowerCase().includes('aggressive')) {
    adjustment = 'Tone adjustment: Reduce sales pressure. Focus on value delivery over closing.';
  } else if (issue.description.toLowerCase().includes('formal')) {
    adjustment = 'Tone adjustment: Be more conversational and approachable.';
  } else if (issue.description.toLowerCase().includes('casual')) {
    adjustment = 'Tone adjustment: Increase professionalism and formality.';
  } else {
    adjustment = `Tone adjustment: ${issue.description}`;
  }

  return {
    category: 'tone',
    adjustment,
    reasoning: issue.description,
    confidence: 0.75
  };
}

/**
 * Analyzes repetition issues
 */
function analyzeRepetitionIssue(session: TrainingSession, issue: TrainingIssue): PersonaRefinement {
  return {
    category: 'verbosity',
    adjustment: 'Enable avoidRepetition flag and reduce response length by 20%',
    reasoning: `Agent repeated information: ${issue.description}`,
    confidence: 0.85
  };
}

/**
 * Applies refinements to a persona object
 */
export function applyRefinementsToPersona(
  persona: PersonaWithTraining,
  refinements: PersonaRefinement[]
): { updatedPersona: PersonaWithTraining; changes: string[] } {
  const updatedPersona: PersonaWithTraining = { ...persona };
  const changes: string[] = [];

  for (const refinement of refinements) {
    switch (refinement.category) {
      case 'verbosity':
        applyVerbosityRefinement(updatedPersona, refinement, changes);
        break;
      case 'accuracy':
        applyAccuracyRefinement(updatedPersona, refinement, changes);
        break;
      case 'brand-alignment':
        applyBrandAlignmentRefinement(updatedPersona, refinement, changes);
        break;
      case 'tone':
        applyToneRefinement(updatedPersona, refinement, changes);
        break;
    }
  }

  // Add to training insights history
  updatedPersona.trainingInsights ??= [];

  for (const refinement of refinements) {
    updatedPersona.trainingInsights.push({
      date: new Date().toISOString(),
      issue: refinement.reasoning,
      adjustment: refinement.adjustment,
      category: refinement.category
    });
  }

  // Keep only last 20 insights
  updatedPersona.trainingInsights = updatedPersona.trainingInsights.slice(-20);

  return { updatedPersona, changes };
}

function applyVerbosityRefinement(persona: PersonaWithTraining, refinement: PersonaRefinement, changes: string[]) {
  persona.verbosityControl ??= {
    maxResponseLength: 500,
    preferBulletPoints: false,
    avoidRepetition: false,
    conversationalPacing: 'balanced'
  };

  if (refinement.adjustment.includes('maxResponseLength')) {
    const match = refinement.adjustment.match(/(\d+) words/);
    if (match) {
      persona.verbosityControl.maxResponseLength = parseInt(match[1]);
      changes.push(`Reduced max response length to ${match[1]} words`);
    }
  }

  if (refinement.adjustment.includes('preferBulletPoints')) {
    persona.verbosityControl.preferBulletPoints = true;
    changes.push('Enabled bullet point preference');
  }

  if (refinement.adjustment.includes('avoidRepetition')) {
    persona.verbosityControl.avoidRepetition = true;
    changes.push('Enabled repetition avoidance');
  }

  if (refinement.adjustment.includes('concise')) {
    persona.verbosityControl.conversationalPacing = 'concise';
    changes.push('Changed pacing to concise');
  }
}

function applyAccuracyRefinement(persona: PersonaWithTraining, refinement: PersonaRefinement, changes: string[]) {
  persona.accuracyRules ??= [];

  const ruleMatch = refinement.adjustment.match(/Add accuracy rule: "(.+)"/);
  if (ruleMatch) {
    const rule = ruleMatch[1];
    if (!persona.accuracyRules.includes(rule)) {
      persona.accuracyRules.push(rule);
      changes.push(`Added accuracy rule: ${rule}`);
    }
  }
}

function applyBrandAlignmentRefinement(persona: PersonaWithTraining, refinement: PersonaRefinement, changes: string[]) {
  persona.brandAlignmentNotes ??= '';

  const note = refinement.adjustment;
  if (!persona.brandAlignmentNotes.includes(note)) {
    persona.brandAlignmentNotes += (persona.brandAlignmentNotes ? '\n\n' : '') + note;
    changes.push('Added brand alignment note');
  }
}

function applyToneRefinement(persona: PersonaWithTraining, refinement: PersonaRefinement, changes: string[]) {
  persona.dynamicToneRegister ??= '';

  const toneAdjustment = refinement.adjustment;
  if (!persona.dynamicToneRegister.includes(toneAdjustment)) {
    persona.dynamicToneRegister += (persona.dynamicToneRegister ? ' ' : '') + toneAdjustment;
    changes.push('Updated tone register');
  }
}

function extractTopicFromIssue(description: string): string {
  // Simple extraction - in production, use NLP
  const words = description.toLowerCase().split(' ');
  const topics = ['pricing', 'features', 'integration', 'security', 'compliance', 'performance'];

  for (const topic of topics) {
    if (words.includes(topic)) {
      return topic;
    }
  }

  return 'this topic';
}

/**
 * Batch process multiple training sessions
 */
export function batchProcessTrainingSessions(
  sessions: TrainingSession[]
): {
  refinements: PersonaRefinement[];
  summary: {
    totalSessions: number;
    issuesFound: number;
    refinementsMade: number;
    confidenceScore: number;
  };
} {
  const allRefinements: PersonaRefinement[] = [];
  let totalIssues = 0;

  for (const session of sessions) {
    if (session.feedback.issues.length > 0) {
      totalIssues += session.feedback.issues.length;
      const sessionRefinements = analyzeTrainingSession(session);
      allRefinements.push(...sessionRefinements);
    }
  }

  // Deduplicate and merge similar refinements
  const mergedRefinements = mergeRefinements(allRefinements);

  const avgConfidence = mergedRefinements.reduce((sum, r) => sum + r.confidence, 0) /
    (mergedRefinements.length || 1);

  return {
    refinements: mergedRefinements,
    summary: {
      totalSessions: sessions.length,
      issuesFound: totalIssues,
      refinementsMade: mergedRefinements.length,
      confidenceScore: avgConfidence
    }
  };
}

function mergeRefinements(refinements: PersonaRefinement[]): PersonaRefinement[] {
  // Group by category and adjustment type
  const grouped = new Map<string, PersonaRefinement[]>();

  for (const refinement of refinements) {
    const key = `${refinement.category}:${refinement.adjustment.substring(0, 50)}`;
    const group = grouped.get(key);
    if (group) {
      group.push(refinement);
    } else {
      grouped.set(key, [refinement]);
    }
  }

  // Merge similar refinements, taking the highest confidence
  return Array.from(grouped.values()).map(group => {
    const sorted = group.sort((a, b) => b.confidence - a.confidence);
    return sorted[0];
  });
}
