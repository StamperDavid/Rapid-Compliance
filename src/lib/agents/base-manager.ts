// STATUS: FOUNDATION - Base class for all manager agents
// Managers coordinate specialists and handle delegation

import type {
  AgentIdentity,
  AgentMessage,
  AgentReport,
  ManagerConfig,
  Signal,
  DelegationRule,
  AgentStatus
} from './types';
import { BaseSpecialist } from './base-specialist';

export abstract class BaseManager extends BaseSpecialist {
  protected specialists: Map<string, BaseSpecialist> = new Map();
  protected delegationRules: DelegationRule[];
  protected managerConfig: ManagerConfig;

  constructor(config: ManagerConfig) {
    super(config);
    this.managerConfig = config;
    this.delegationRules = config.delegationRules;
  }

  /**
   * Register a specialist under this manager
   */
  registerSpecialist(specialist: BaseSpecialist): void {
    const identity = specialist.getIdentity();
    this.specialists.set(identity.id, specialist);
    this.log('INFO', `Registered specialist: ${identity.name} (${identity.status})`);
  }

  /**
   * Get all registered specialists and their statuses
   */
  getSpecialistStatuses(): Array<{ id: string; name: string; status: AgentStatus }> {
    return Array.from(this.specialists.values()).map(s => {
      const identity = s.getIdentity();
      return { id: identity.id, name: identity.name, status: identity.status };
    });
  }

  /**
   * Count how many specialists are actually functional
   */
  getFunctionalSpecialistCount(): { total: number; functional: number; ghosts: number; shells: number } {
    const statuses = this.getSpecialistStatuses();
    return {
      total: statuses.length,
      functional: statuses.filter(s => s.status === 'FUNCTIONAL' || s.status === 'TESTED').length,
      ghosts: statuses.filter(s => s.status === 'GHOST').length,
      shells: statuses.filter(s => s.status === 'SHELL').length,
    };
  }

  /**
   * Determine which specialist should handle a message
   */
  protected findDelegationTarget(message: AgentMessage): string | null {
    const payloadStr = JSON.stringify(message.payload).toLowerCase();

    for (const rule of this.delegationRules.sort((a, b) => b.priority - a.priority)) {
      for (const keyword of rule.triggerKeywords) {
        if (payloadStr.includes(keyword.toLowerCase())) {
          return rule.delegateTo;
        }
      }
    }

    return null;
  }

  /**
   * Delegate a task to a specialist
   */
  protected async delegateToSpecialist(
    specialistId: string,
    message: AgentMessage
  ): Promise<AgentReport> {
    const specialist = this.specialists.get(specialistId);

    if (!specialist) {
      return this.createReport(
        message.id,
        'FAILED',
        null,
        [`Specialist ${specialistId} not registered`]
      );
    }

    if (specialist.isGhost()) {
      return this.createReport(
        message.id,
        'BLOCKED',
        { reason: 'SPECIALIST_NOT_BUILT' },
        [`Specialist ${specialistId} is a GHOST - not yet implemented`]
      );
    }

    if (specialist.isShell()) {
      return this.createReport(
        message.id,
        'BLOCKED',
        { reason: 'SPECIALIST_IS_SHELL' },
        [`Specialist ${specialistId} is a SHELL - has no real logic`]
      );
    }

    return specialist.execute(message);
  }

  /**
   * Broadcast a signal to all specialists
   */
  protected async broadcastToSpecialists(signal: Signal): Promise<AgentReport[]> {
    const reports: AgentReport[] = [];

    for (const [id, specialist] of this.specialists) {
      if (specialist.isFunctional()) {
        const report = await specialist.handleSignal(signal);
        reports.push(report);
      } else {
        reports.push(this.createReport(
          signal.id,
          'BLOCKED',
          { specialistId: id, reason: `Status: ${specialist.getStatus()}` }
        ));
      }
    }

    return reports;
  }

  /**
   * Get honest assessment of this manager's capabilities
   */
  getCapabilityReport(): {
    manager: string;
    status: AgentStatus;
    specialists: Array<{ id: string; status: AgentStatus; hasRealLogic: boolean }>;
    actuallyWorks: boolean;
    blockedBy: string[];
  } {
    const specialistReports = Array.from(this.specialists.values()).map(s => ({
      id: s.getIdentity().id,
      status: s.getStatus(),
      hasRealLogic: s.isFunctional() ? s.hasRealLogic() : false,
    }));

    const blockedBy = specialistReports
      .filter(s => s.status === 'GHOST' || s.status === 'SHELL')
      .map(s => s.id);

    return {
      manager: this.identity.id,
      status: this.identity.status,
      specialists: specialistReports,
      actuallyWorks: blockedBy.length === 0 && this.hasRealLogic(),
      blockedBy,
    };
  }
}
