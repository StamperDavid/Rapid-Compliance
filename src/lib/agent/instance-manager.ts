/**
 * Agent Instance Manager
 * 
 * Handles the lifecycle of ephemeral agent instances spawned from Golden Master.
 * Each customer interaction gets a fresh instance that loads their memory.
 */

import type {
  AgentInstance,
  CustomerMemory,
  GoldenMaster,
  CustomerSession,
  ConversationMessage,
  AgentNote,
  InstanceLifecycleService
} from '@/types/agent-memory';
import { logger } from '@/lib/logger/logger';

export class AgentInstanceManager implements InstanceLifecycleService {
  /**
   * Spawn a new agent instance for a customer session
   * 
   * Flow:
   * 1. Get active Golden Master for org
   * 2. Check if customer exists, create or load memory
   * 3. Create new session record
   * 4. Spawn instance with Golden Master config + customer memory
   * 5. Return ready-to-use instance
   */
  async spawnInstance(customerId: string, orgId: string): Promise<AgentInstance> {
    logger.info('Spawning agent instance', { customerId, orgId });
    
    // 1. Get active Golden Master
    const goldenMaster = await this.getActiveGoldenMaster(orgId);
    if (!goldenMaster) {
      logger.error('No active Golden Master found', { orgId });
      throw new Error('No active Golden Master found. Please deploy a Golden Master first.');
    }
    
    // 2. Load or create customer memory
    let customerMemory = await this.getCustomerMemory(customerId, orgId);
    if (!customerMemory) {
      logger.info('New customer detected, creating memory record', { customerId, orgId });
      customerMemory = await this.createCustomerMemory(customerId, orgId);
    }
    
    // 3. Create new session
    const sessionId = this.generateSessionId();
    const newSession: CustomerSession = {
      sessionId,
      startTime: new Date().toISOString(),
      goldenMasterVersion: goldenMaster.version,
      messageCount: 0,
      outcome: 'ongoing',
      sentiment: 'neutral',
      sentimentScore: 0,
      flaggedForTraining: false
    };
    
    // Add session to customer memory
    customerMemory.sessions.push(newSession);
    customerMemory.lastInteraction = newSession.startTime;
    customerMemory.totalInteractions += 1;
    
    await this.saveCustomerMemory(customerMemory);
    
    // 4. Compile system prompt with customer context
    const systemPrompt = this.compileSystemPrompt(goldenMaster, customerMemory);
    
    // 5. Create instance
    const instance: AgentInstance = {
      instanceId: this.generateInstanceId(),
      sessionId,
      customerId,
      orgId,
      goldenMasterId: goldenMaster.id,
      goldenMasterVersion: goldenMaster.version,
      systemPrompt,
      knowledgeBase: goldenMaster.knowledgeBase?.documents?.map(d => d.id) ?? [],
      customerMemory,
      status: 'active',
      spawnedAt: new Date().toISOString(),
      currentContext: [],
      messageCount: 0,
      lastActivityAt: new Date().toISOString(),
      escalationTriggered: false,
      humanTookOver: false
    };
    
    // Store instance in active instances (Redis/Memory cache)
    await this.storeActiveInstance(instance);
    
    logger.info('Agent instance spawned successfully', {
      instanceId: instance.instanceId,
      sessionId: instance.sessionId,
      customerId,
      goldenMasterVersion: instance.goldenMasterVersion,
    });
    return instance;
  }
  
  /**
   * Compile system prompt by combining Golden Master config with customer context
   */
  private compileSystemPrompt(goldenMaster: GoldenMaster, customerMemory: CustomerMemory): string {
    // Handle both nested and flat structures for backwards compatibility
    // Extract string values to avoid empty strings in prompt (Explicit Ternary for STRINGS)
    const bc = goldenMaster.businessContext;
    const businessName = (bc?.businessName !== '' && bc?.businessName != null) ? bc.businessName : 'Your Business';
    const industry = (bc?.industry !== '' && bc?.industry != null) ? bc.industry : 'General';
    const problemSolved = (bc?.problemSolved !== '' && bc?.problemSolved != null) ? bc.problemSolved : '';
    const uniqueValue = (bc?.uniqueValue !== '' && bc?.uniqueValue != null) ? bc.uniqueValue : '';
    // Products come from knowledge base product catalog
    const catalogProducts = goldenMaster.knowledgeBase?.productCatalog?.products ?? [];
    const topProducts = catalogProducts.map((p) => `${p.name}: $${p.price} - ${p.description}`).join('\n');
    const pricingStrategy = (bc?.priceRange !== '' && bc?.priceRange != null) ? bc.priceRange : '';
    const discountPolicy = (bc?.discountPolicy !== '' && bc?.discountPolicy != null) ? bc.discountPolicy : '';
    const returnPolicy = (bc?.returnPolicy !== '' && bc?.returnPolicy != null) ? bc.returnPolicy : '';
    const warrantyTerms = (bc?.warrantyTerms !== '' && bc?.warrantyTerms != null) ? bc.warrantyTerms : '';
    const geographicCoverage = '';  // Not in OnboardingData, use empty string
    const deliveryTimeframes = '';  // Not in OnboardingData, use empty string
    const typicalSalesFlow = (bc?.typicalSalesFlow !== '' && bc?.typicalSalesFlow != null) ? bc.typicalSalesFlow : '';
    const discoveryQuestions = (bc?.discoveryQuestions !== '' && bc?.discoveryQuestions != null) ? bc.discoveryQuestions : '';
    const commonObjections = (bc?.commonObjections !== '' && bc?.commonObjections != null) ? bc.commonObjections : '';
    const priceObjections = (bc?.priceObjections !== '' && bc?.priceObjections != null) ? bc.priceObjections : '';
    const timeObjections = '';  // Not in OnboardingData - part of objectionHandling
    const competitorObjections = '';  // Not in OnboardingData - part of objectionHandling
    const requiredDisclosures = (bc?.requiredDisclosures !== '' && bc?.requiredDisclosures != null) ? bc.requiredDisclosures : '';
    const prohibitedTopics = (bc?.prohibitedTopics !== '' && bc?.prohibitedTopics != null) ? bc.prohibitedTopics : '';

    const businessContext: Record<string, unknown> = goldenMaster.businessContext ?? {
      businessName,
      industry,
      problemSolved,
      uniqueValue,
      topProducts,
      pricingStrategy,
      discountPolicy,
      returnPolicy,
      warrantyTerms,
      geographicCoverage,
      deliveryTimeframes,
      typicalSalesFlow,
      discoveryQuestions,
      commonObjections,
      priceObjections,
      timeObjections,
      competitorObjections,
      requiredDisclosures,
      prohibitedTopics
    };
    
    // Extract agent persona strings (Explicit Ternary for STRINGS)
    const ap = goldenMaster.agentPersona;
    const personaName = (ap?.name !== '' && ap?.name != null) ? ap.name : 'AI Assistant';
    const personaTone = (ap?.tone !== '' && ap?.tone != null) ? ap.tone : 'Professional and helpful';
    const personaGreeting = (ap?.greeting !== '' && ap?.greeting != null) ? ap.greeting : 'Hello! How can I help you today?';
    const personaClosingMessage = (ap?.closingMessage !== '' && ap?.closingMessage != null) ? ap.closingMessage : 'Thanks for chatting!';

    const agentPersona = goldenMaster.agentPersona ?? {
      name: personaName,
      tone: personaTone,
      greeting: personaGreeting,
      closingMessage: personaClosingMessage,
      objectives: ap?.objectives ?? [],
      escalationRules: ap?.escalationRules ?? []
    };
    
    // Extract behavior config (STRING for responseLength, NUMBERS for aggressiveness/level - use ?? for numbers)
    const bhv = goldenMaster.behaviorConfig;
    const questionFrequency = bhv?.questionFrequency ?? 3;
    const responseLength = (bhv?.responseLength !== '' && bhv?.responseLength != null) ? bhv.responseLength : 'balanced';

    const behaviorConfig = goldenMaster.behaviorConfig ?? {
      closingAggressiveness: bhv?.closingAggressiveness ?? 5,
      questionFrequency,
      responseLength,
      proactiveLevel: bhv?.proactiveLevel ?? 5,
      idleTimeoutMinutes: 30
    };
    
    // Include training learnings in system prompt (from Golden Master)
    const trainingNotes = goldenMaster.trainedScenarios ?? [];
    // Extract training completion string to avoid empty strings in prompt
    const trainingCompletedDisplay = (goldenMaster.trainingCompletedAt !== '' && goldenMaster.trainingCompletedAt != null) ? goldenMaster.trainingCompletedAt : 'Not yet';
    const _recentLearnings = trainingNotes.length > 0
      ? `Trained on ${trainingNotes.length} scenarios. Training completed: ${trainingCompletedDisplay}.`
      : '';
    
    const _updatedGuidelines = ''; // From training feedback if available
    const _behavioralChanges = ''; // From training feedback if available
    
    // Extract agentPersona.name to avoid putting complex logic in template (Template Extraction Rule)
    const displayAgentName = (agentPersona.name !== '' && agentPersona.name != null) ? agentPersona.name : 'AI Assistant';
    // Extract requiredDisclosures to avoid putting coalescing in template
    const disclosuresText = (businessContext.requiredDisclosures !== '' && businessContext.requiredDisclosures != null) ? businessContext.requiredDisclosures : '';
    
    let prompt = `You are an AI sales and customer service agent for ${businessContext.businessName}.

# Your Role & Objectives
${agentPersona.objectives.join('\n')}

# Business Context
Industry: ${businessContext.industry}
What we do: ${businessContext.problemSolved}
What makes us unique: ${businessContext.uniqueValue}

# Products/Services
${businessContext.topProducts}

# Pricing Strategy
${businessContext.pricingStrategy}
${businessContext.discountPolicy}

# Policies
Return Policy: ${businessContext.returnPolicy}
Warranty: ${businessContext.warrantyTerms}
Shipping: ${businessContext.geographicCoverage}
Delivery Time: ${businessContext.deliveryTimeframes}

# Your Sales Process
${businessContext.typicalSalesFlow}

Discovery Questions to Ask:
${businessContext.discoveryQuestions}

# Objection Handling
${businessContext.commonObjections}

Price Objections: ${businessContext.priceObjections}
Time Objections: ${businessContext.timeObjections}
Competitor Objections: ${businessContext.competitorObjections}

# Your Personality
Name: ${displayAgentName}
Tone: ${agentPersona.tone}
Greeting: "${agentPersona.greeting}"
Closing: "${agentPersona.closingMessage}"

# Behavioral Guidelines
- Closing Aggressiveness: ${behaviorConfig.closingAggressiveness}/10
- Ask ${behaviorConfig.questionFrequency} discovery questions before recommending
- Response Length: ${behaviorConfig.responseLength}
- Proactive Level: ${behaviorConfig.proactiveLevel}/10

# When to Escalate to Human
${agentPersona.escalationRules.join('\n')}

# Compliance & Legal
${disclosuresText}
Prohibited Topics: ${businessContext.prohibitedTopics}
`;

    // Add customer-specific context if returning customer
    if (customerMemory.totalInteractions > 0) {
      // Extract customer strings to avoid empty strings in prompt (Explicit Ternary for STRINGS)
      const customerName = (customerMemory.name !== '' && customerMemory.name != null) ? customerMemory.name : 'Unknown';
      const customerEmail = (customerMemory.email !== '' && customerMemory.email != null) ? customerMemory.email : 'Not provided';
      const customerBudget = (customerMemory.preferences.budget !== '' && customerMemory.preferences.budget != null) ? customerMemory.preferences.budget : 'Unknown';
      const customerInterests = (customerMemory.preferences.interests.join(', ') !== '' && customerMemory.preferences.interests.join(', ') != null) ? customerMemory.preferences.interests.join(', ') : 'None recorded';
      const customerPreferredTone = (customerMemory.preferences.preferredTone !== '' && customerMemory.preferences.preferredTone != null) ? customerMemory.preferences.preferredTone : 'Not specified';
      
      prompt += `

# CUSTOMER CONTEXT - This is a returning customer!

Customer Name: ${customerName}
Email: ${customerEmail}
First Seen: ${new Date(customerMemory.firstSeen).toLocaleDateString()}
Total Interactions: ${customerMemory.totalInteractions}
Lead Status: ${customerMemory.leadInfo.status}
Lifetime Value: $${customerMemory.lifetimeValue.toFixed(2)}

## Customer Preferences
Budget: ${customerBudget}
Interests: ${customerInterests}
Communication Preference: ${customerPreferredTone}

## Purchase History
${customerMemory.purchaseHistory.length > 0 
  ? customerMemory.purchaseHistory.map(p => 
      `- Order ${p.orderId}: $${p.totalAmount} on ${new Date(p.orderDate).toLocaleDateString()} (${p.status})`
    ).join('\n')
  : 'No previous purchases'
}

## Agent Notes (Insights from previous interactions)
${customerMemory.agentNotes.length > 0
  ? customerMemory.agentNotes.map(note => 
      `- [${note.category}] ${note.content}`
    ).join('\n')
  : 'No notes yet'
}

## Important Flags
${customerMemory.contextFlags.hasActiveCart ? '⚠️ Customer has items in cart!' : ''}
${customerMemory.contextFlags.hasOpenTicket ? '⚠️ Customer has an open support ticket!' : ''}
${customerMemory.contextFlags.isVIP ? '⭐ VIP Customer - provide premium service!' : ''}
${customerMemory.contextFlags.hasComplaint ? '⚠️ Customer has previous complaint - be extra attentive!' : ''}

## Recent Conversation Summary
${this.summarizeRecentConversations(customerMemory)}

**IMPORTANT**: Use this context to provide personalized, continuous service. Reference their previous interactions naturally. Don't mention you're looking at their history - just use it to be helpful.
`;
    }

    return prompt;
  }
  
  /**
   * Summarize recent conversations for context
   */
  private summarizeRecentConversations(customerMemory: CustomerMemory): string {
    const recentSessions = customerMemory.sessions.slice(-3); // Last 3 sessions
    if (recentSessions.length === 0) {return 'First interaction with this customer';}
    
    return recentSessions.map(session => {
      const date = new Date(session.startTime).toLocaleDateString();
      return `- ${date}: ${session.outcome} (${session.sentiment} sentiment)${session.outcomeDetails ? ` - ${  session.outcomeDetails}` : ''}`;
    }).join('\n');
  }
  
  /**
   * Load customer memory into instance context
   */
  async loadCustomerMemory(instanceId: string, customerId: string): Promise<void> {
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) {throw new Error('Instance not found');}
    
    const memory = await this.getCustomerMemory(customerId, instance.orgId);
    if (!memory) {throw new Error('Customer memory not found');}
    
    instance.customerMemory = memory;
    await this.storeActiveInstance(instance);
  }
  
  /**
   * Update customer memory during active session
   */
  async updateCustomerMemory(instanceId: string, updates: Partial<CustomerMemory>): Promise<void> {
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) {throw new Error('Instance not found');}
    
    const currentMemory = instance.customerMemory;
    const updatedMemory = { ...currentMemory, ...updates, updatedAt: new Date().toISOString() };
    
    instance.customerMemory = updatedMemory;
    await this.storeActiveInstance(instance);
    await this.saveCustomerMemory(updatedMemory);
  }
  
  /**
   * Add message to conversation history
   */
  async addMessage(
    instanceId: string,
    role: 'customer' | 'agent' | 'human_agent',
    content: string,
    metadata?: ConversationMessage['metadata']
  ): Promise<void> {
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) {throw new Error('Instance not found');}
    
    const message: ConversationMessage = {
      messageId: this.generateMessageId(),
      sessionId: instance.sessionId,
      timestamp: new Date().toISOString(),
      role,
      content,
      metadata
    };
    
    // Add to instance context
    instance.currentContext.push(message);
    instance.messageCount += 1;
    instance.lastActivityAt = new Date().toISOString();
    
    // Add to customer memory conversation history
    instance.customerMemory.conversationHistory.push(message);
    
    // Update session message count
    const currentSession = instance.customerMemory.sessions.find(s => s.sessionId === instance.sessionId);
    if (currentSession) {
      currentSession.messageCount += 1;
    }
    
    await this.storeActiveInstance(instance);
    await this.saveCustomerMemory(instance.customerMemory);
  }
  
  /**
   * Add a message to customer memory (simplified version for API routes)
   */
  async addMessageToMemory(
    customerId: string,
    orgId: string,
    userMessage: string,
    assistantMessage: string
  ): Promise<void> {
    try {
      // Load customer memory
      const memory = await this.getCustomerMemory(customerId, orgId);
      if (!memory) {
        logger.error(`[Instance Manager] No memory found for customer ${customerId}`, new Error(`[Instance Manager] No memory found for customer ${customerId}`), { file: 'instance-manager.ts' });
        return;
      }

      // Add messages to conversation history
      const timestamp = new Date().toISOString();
      // Extract sessionId to avoid empty strings (Explicit Ternary for STRING identifiers)
      const lastSessionId = memory.sessions[memory.sessions.length - 1]?.sessionId;
      const sessionId = (lastSessionId !== '' && lastSessionId != null) ? lastSessionId : 'default';
      
      memory.conversationHistory.push({
        messageId: this.generateMessageId(),
        sessionId,
        timestamp,
        role: 'customer',
        content: userMessage,
      });
      
      memory.conversationHistory.push({
        messageId: this.generateMessageId(),
        sessionId,
        timestamp,
        role: 'agent',
        content: assistantMessage,
      });

      // Keep only last 100 messages to prevent memory from growing too large
      if (memory.conversationHistory.length > 100) {
        memory.conversationHistory = memory.conversationHistory.slice(-100);
      }

      // Update last interaction
      memory.lastInteraction = timestamp;
      memory.updatedAt = timestamp;

      // Save updated memory
      await this.saveCustomerMemory(memory);
      
      logger.info('Instance Manager Added messages to memory for customer customerId}', { file: 'instance-manager.ts' });
    } catch (error) {
      logger.error('[Instance Manager] Error adding message to memory:', error, { file: 'instance-manager.ts' });
      // Don't throw - we don't want to fail the API call if memory update fails
    }
  }

  /**
   * Add agent note/insight
   */
  async addAgentNote(
    instanceId: string,
    category: AgentNote['category'],
    content: string,
    confidence: number = 0.8
  ): Promise<void> {
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) {throw new Error('Instance not found');}
    
    const note: AgentNote = {
      noteId: this.generateNoteId(),
      sessionId: instance.sessionId,
      timestamp: new Date().toISOString(),
      category,
      content,
      confidence
    };
    
    instance.customerMemory.agentNotes.push(note);
    await this.updateCustomerMemory(instanceId, { agentNotes: instance.customerMemory.agentNotes });
  }
  
  /**
   * Terminate instance and save final session state
   */
  async terminateInstance(instanceId: string, outcome: CustomerSession['outcome']): Promise<void> {
    logger.info('Terminating agent instance', { instanceId, outcome });
    
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) {
      logger.warn('Instance already terminated or not found', { instanceId });
      return;
    }
    
    const endTime = new Date().toISOString();
    
    // Update session with final outcome
    const session = instance.customerMemory.sessions.find(s => s.sessionId === instance.sessionId);
    if (session) {
      session.endTime = endTime;
      session.duration = Math.floor((new Date(endTime).getTime() - new Date(session.startTime).getTime()) / 1000);
      session.outcome = outcome;
      
      // Calculate final sentiment from messages
      const sentimentMessages = instance.currentContext.filter(m => m.metadata?.sentiment);
      if (sentimentMessages.length > 0) {
        const avgSentiment = sentimentMessages.reduce((sum, m) => sum + (m.metadata?.sentiment ?? 0), 0) / sentimentMessages.length;
        session.sentimentScore = avgSentiment;
        session.sentiment = avgSentiment > 0.3 ? 'positive' : avgSentiment < -0.3 ? 'negative' : 'neutral';
      }
    }
    
    // Update instance status
    instance.status = 'terminated';
    instance.terminatedAt = endTime;
    
    // Save final customer memory state
    instance.customerMemory.lastInteraction = endTime;
    instance.customerMemory.updatedAt = endTime;
    await this.saveCustomerMemory(instance.customerMemory);
    
    // Remove from active instances
    await this.removeActiveInstance(instanceId);
    
    // Archive instance for analytics (optional)
    await this.archiveInstance(instance);
    
    logger.info('Agent instance terminated successfully', {
      instanceId,
      sessionId: instance.sessionId,
      outcome,
      messageCount: instance.messageCount,
      duration: instance.customerMemory.sessions.find(s => s.sessionId === instance.sessionId)?.duration,
    });
  }
  
  /**
   * Check instance health and auto-terminate if idle
   */
  async checkInstanceHealth(instanceId: string): Promise<'healthy' | 'idle' | 'unresponsive'> {
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) {return 'unresponsive';}
    
    const now = new Date().getTime();
    const lastActivity = new Date(instance.lastActivityAt).getTime();
    const idleMinutes = (now - lastActivity) / 1000 / 60;
    
    const maxIdleMinutes = 30; // Auto-terminate after 30 minutes of inactivity
    
    if (idleMinutes > maxIdleMinutes) {
      logger.warn('Instance idle for too long, auto-terminating', {
        instanceId,
        idleMinutes: Math.round(idleMinutes),
        maxIdleMinutes,
      });
      await this.terminateInstance(instanceId, 'abandoned');
      return 'unresponsive';
    } else if (idleMinutes > 5) {
      return 'idle';
    }
    
    return 'healthy';
  }
  
  /**
   * Escalate to human agent
   */
  async escalateToHuman(instanceId: string, reason: string): Promise<void> {
    logger.info('Instance Manager Escalating instance instanceId} to human. Reason: reason}', { file: 'instance-manager.ts' });
    
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) {throw new Error('Instance not found');}
    
    instance.escalationTriggered = true;
    instance.escalationReason = reason;
    instance.status = 'escalated';
    
    // Update session
    const session = instance.customerMemory.sessions.find(s => s.sessionId === instance.sessionId);
    if (session) {
      session.outcome = 'escalated';
      session.outcomeDetails = reason;
    }
    
    await this.storeActiveInstance(instance);
    
    // Notify human agents (implement notification system)
    await this.notifyHumanAgents(instance, reason);
  }
  
  /**
   * Human takeover
   */
  async humanTakeover(instanceId: string, humanAgentId: string): Promise<void> {
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) {throw new Error('Instance not found');}
    
    instance.humanTookOver = true;
    instance.humanAgentId = humanAgentId;
    instance.status = 'escalated';
    
    await this.storeActiveInstance(instance);
  }
  
  // ===== Database/Storage Methods =====
  
  private async getActiveGoldenMaster(orgId: string): Promise<GoldenMaster | null> {
    try {
      logger.info('Instance Manager Fetching Golden Masters for org: orgId}', { file: 'instance-manager.ts' });
      
      // Prefer admin SDK to bypass security rules
      try {
        const { adminDb } = await import('@/lib/firebase/admin');
        const { getOrgSubCollection } = await import('@/lib/firebase/collections');
        if (adminDb) {
          const goldenMastersPath = getOrgSubCollection(orgId, 'goldenMasters');
          const snap = await adminDb
            .collection(goldenMastersPath)
            .get();
          
          const goldenMasters = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GoldenMaster[];
          logger.info('Instance Manager Found Golden Masters (admin SDK)', { 
            count: goldenMasters.length, 
            file: 'instance-manager.ts' 
          });
          
          const active = goldenMasters.find((gm) => gm.isActive === true);
          logger.info('Instance Manager Active Golden Master', { 
            activeId: active ? active.id : 'NONE',
            file: 'instance-manager.ts' 
          });
          return active ?? null;
        }
      } catch (adminError) {
        logger.warn('[Instance Manager] Admin SDK failed, falling back to client SDK', { 
          error: adminError,
          file: 'instance-manager.ts' 
        });
      }
      
      // Fallback to client SDK
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const goldenMasters = await FirestoreService.getAll<GoldenMaster>(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.GOLDEN_MASTERS}`,
        []
      );
      logger.info(`Instance Manager Found ${goldenMasters.length} Golden Masters (client SDK)`, { file: 'instance-manager.ts' });
      const active = goldenMasters.find((gm) => gm.isActive === true);
      return active ?? null;
    } catch (error) {
      logger.error('[Instance Manager] Error fetching Golden Master:', error, { file: 'instance-manager.ts' });
      return null;
    }
  }
  
  private async getCustomerMemory(customerId: string, orgId: string): Promise<CustomerMemory | null> {
    try {
      // Prefer admin SDK
      try {
        const { adminDb } = await import('@/lib/firebase/admin');
        const { getOrgSubCollection } = await import('@/lib/firebase/collections');
        if (adminDb) {
          const customerMemoriesPath = getOrgSubCollection(orgId, 'customerMemories');
          const doc = await adminDb
            .collection(customerMemoriesPath)
            .doc(customerId)
            .get();
          
          if (doc.exists) {
            return { id: doc.id, ...doc.data() } as unknown as CustomerMemory;
          }
          return null;
        }
      } catch (_adminError) {
        logger.warn('[Instance Manager] Admin SDK failed for customer memory, using client SDK', { file: 'instance-manager.ts' });
      }
      
      // Fallback to client SDK
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      return await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.CUSTOMER_MEMORIES}`,
        customerId
      );
    } catch (error) {
      logger.error('Error fetching customer memory:', error, { file: 'instance-manager.ts' });
      return null;
    }
  }
  
  private async createCustomerMemory(customerId: string, orgId: string): Promise<CustomerMemory> {
    const memory: CustomerMemory = {
      customerId,
      orgId,
      sessions: [],
      conversationHistory: [],
      preferences: {
        interests: [],
        favoriteProducts: [],
        viewedProducts: []
      },
      purchaseHistory: [],
      leadInfo: {
        status: 'cold',
        source: 'website',
        qualificationScore: 0,
        qualificationCriteria: {
          hasBudget: false,
          hasNeed: false,
          hasTimeline: false,
          isDecisionMaker: false
        }
      },
      agentNotes: [],
      contextFlags: {
        hasActiveCart: false,
        hasOpenTicket: false,
        waitingOnRefund: false,
        isVIP: false,
        hasComplaint: false,
        isBlacklisted: false,
        isPriceShoppers: false,
        isResearcher: false,
        isBulkBuyer: false,
        isImpulseBuyer: false,
        hasReturnedMultipleItems: false,
        hasDisputedCharges: false,
        requiresHumanApproval: false
      },
      firstSeen: new Date().toISOString(),
      lastInteraction: new Date().toISOString(),
      totalInteractions: 0,
      lifetimeValue: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await this.saveCustomerMemory(memory);
    return memory;
  }
  
  private async saveCustomerMemory(memory: CustomerMemory): Promise<void> {
    try {
      // Prefer admin SDK
      try {
        const { adminDb } = await import('@/lib/firebase/admin');
        const { getOrgSubCollection } = await import('@/lib/firebase/collections');
        if (adminDb) {
          const customerMemoriesPath = getOrgSubCollection(memory.orgId, 'customerMemories');
          await adminDb
            .collection(customerMemoriesPath)
            .doc(memory.customerId)
            .set(memory, { merge: true });
          return;
        }
      } catch (_adminError) {
        logger.warn('[Instance Manager] Admin SDK failed for saving memory, using client SDK', { file: 'instance-manager.ts' });
      }
      
      // Fallback to client SDK
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${memory.orgId}/${COLLECTIONS.CUSTOMER_MEMORIES}`,
        memory.customerId,
        memory,
        true
      );
    } catch (error) {
      logger.error('Error saving customer memory:', error, { file: 'instance-manager.ts' });
      throw error;
    }
  }
  
  private async storeActiveInstance(instance: AgentInstance): Promise<void> {
    // Store in Firestore for persistence (in production, also use Redis for fast access)
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${instance.orgId}/activeInstances`,
        instance.instanceId,
        {
          ...instance,
          createdAt: instance.spawnedAt,
          lastActivityAt: new Date().toISOString(),
        },
        true
      );
    } catch (error) {
      logger.error('Error storing active instance:', error, { file: 'instance-manager.ts' });
    }
  }
  
  private getActiveInstance(_instanceId: string): Promise<AgentInstance | null> {
    // In production, check Redis first, then Firestore
    // For now, just check Firestore
    try {
      // Need orgId to query - this is a limitation of current design
      // In production, maintain a lookup table or use Redis with instanceId as key
      return Promise.resolve(null);
    } catch (error) {
      logger.error('Error getting active instance:', error, { file: 'instance-manager.ts' });
      return Promise.resolve(null);
    }
  }
  
  private removeActiveInstance(instanceId: string): Promise<void> {
    try {
      // In production, remove from Redis and Firestore
      // For now, just log
      logger.info('[Instance Manager] Removing active instance', { instanceId, file: 'instance-manager.ts' });
      return Promise.resolve();
    } catch (error) {
      logger.error('Error removing active instance:', error, { file: 'instance-manager.ts' });
      return Promise.resolve();
    }
  }
  
  private async archiveInstance(instance: AgentInstance): Promise<void> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${instance.orgId}/archivedInstances`,
        instance.instanceId,
        {
          ...instance,
          archivedAt: new Date().toISOString(),
        },
        false
      );
    } catch (error) {
      logger.error('Error archiving instance:', error, { file: 'instance-manager.ts' });
    }
  }
  
  private notifyHumanAgents(instance: AgentInstance, reason: string): Promise<void> {
    // TODO: Implement - send real-time notification to human agents
    logger.info('[Instance Manager] Notifying human agents for escalation', { 
      reason, 
      instanceId: instance.instanceId,
      file: 'instance-manager.ts' 
    });
    return Promise.resolve();
  }
  
  // ===== ID Generators =====
  
  private generateInstanceId(): string {
    return `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateNoteId(): string {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const agentInstanceManager = new AgentInstanceManager();




