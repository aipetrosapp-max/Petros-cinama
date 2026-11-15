// ============================================================================
// AI PETROS // ADK SECURITY GUARD & ANTI-INTRUSION AGENT (adk.dev)
// Responsibilities:
//   1. Defend against XSS, script injection, and payload poisoning
//   2. Enforce strict stream URL protocol validation (https/http only)
//   3. Implement brute-force rate-limiting & auto-lockout on Admin/Owner access
//   4. Audit client environment integrity and report intrusion attempts
// ============================================================================

import { AdkAgent, type AdkContext } from './adkTypes';

export interface SecurityIncident {
  id: string;
  timestamp: string;
  type: 'xss_blocked' | 'stream_poison_blocked' | 'pin_bruteforce_lockout' | 'tamper_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
}

export class SecurityGuardAgent extends AdkAgent {
  private failedPinAttempts = 0;
  private lockoutUntilTimestamp = 0;
  private incidents: SecurityIncident[] = [];

  constructor() {
    super({
      name: 'security_guard_agent',
      description: 'Autonomous ADK agent that monitors security, prevents injection attacks, protects stream integrity, and stops intrusion attempts.',
      instruction: 'Strictly block any malicious protocols (javascript:, data:, file:) and protect the admin portal from brute-force password attacks.'
    });

    this.registerTool({
      name: 'sanitizeInput',
      description: 'Sanitizes raw user input strings against XSS and HTML injection.',
      parameters: {
        rawInput: { type: 'string', description: 'User input string to sanitize', required: true }
      },
      execute: (params: { rawInput: string }, context: AdkContext) => {
        if (!params.rawInput || typeof params.rawInput !== 'string') return '';

        const suspiciousPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|javascript:|data:text\/html|onload\s*=|onerror\s*=/gi;
        if (suspiciousPattern.test(params.rawInput)) {
          this.recordIncident('xss_blocked', 'high', `Malicious script pattern blocked in input: "${params.rawInput.slice(0, 40)}"`);
          context.log('warn', `Security alert: XSS payload stripped: ${params.rawInput}`);
        }

        // Return clean string
        return params.rawInput
          .replace(suspiciousPattern, '')
          .replace(/[<>]/g, '')
          .trim();
      }
    });

    this.registerTool({
      name: 'validateStreamUrl',
      description: 'Ensures video stream URLs use sanctioned, secure protocols.',
      parameters: {
        url: { type: 'string', description: 'Stream URL to inspect', required: true }
      },
      execute: (params: { url: string }, context: AdkContext) => {
        if (!params.url || typeof params.url !== 'string') {
          return { safe: false, reason: 'Empty or invalid URL' };
        }

        const trimmed = params.url.trim().toLowerCase();
        // Disallow dangerous URI schemes
        if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('file:') || trimmed.startsWith('vbscript:')) {
          this.recordIncident('stream_poison_blocked', 'critical', `Dangerous scheme blocked: ${trimmed.slice(0, 30)}`);
          context.log('error', `Dangerous URI scheme blocked: ${trimmed}`);
          return { safe: false, reason: 'Prohibited protocol' };
        }

        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          return { safe: false, reason: 'Must use HTTP or HTTPS' };
        }

        return { safe: true, reason: 'Verified safe' };
      }
    });

    this.registerTool({
      name: 'auditAdminPinAttempt',
      description: 'Monitors owner portal access attempts and triggers lockout on brute-force detection.',
      parameters: {
        isSuccess: { type: 'boolean', description: 'Whether the PIN attempt was correct', required: true }
      },
      execute: (params: { isSuccess: boolean }, context: AdkContext) => {
        const now = Date.now();

        // Check if currently locked out
        if (this.lockoutUntilTimestamp > now) {
          const remainingSec = Math.ceil((this.lockoutUntilTimestamp - now) / 1000);
          context.log('warn', `Admin access attempt blocked during active security lockout (${remainingSec}s remaining)`);
          return {
            allowed: false,
            isLockedOut: true,
            remainingLockoutSec: remainingSec,
            reason: `Too many failed attempts. Security lockout active for ${remainingSec} more seconds.`
          };
        }

        if (params.isSuccess) {
          this.failedPinAttempts = 0;
          context.log('info', 'Admin PIN verification succeeded. Zero security violations.');
          return { allowed: true, isLockedOut: false, remainingLockoutSec: 0 };
        }

        // Failed attempt
        this.failedPinAttempts++;
        context.log('warn', `Failed PIN attempt #${this.failedPinAttempts}`);

        if (this.failedPinAttempts >= 5) {
          const lockoutDurationMs = 15 * 60 * 1000; // 15 minutes
          this.lockoutUntilTimestamp = now + lockoutDurationMs;
          this.recordIncident('pin_bruteforce_lockout', 'high', '5 consecutive failed PIN attempts detected. Locked for 15 minutes.');
          context.log('error', 'Brute force defense triggered: Admin access locked out for 15 minutes.');
          return {
            allowed: false,
            isLockedOut: true,
            remainingLockoutSec: 15 * 60,
            reason: 'Brute force defense triggered. Portal locked for 15 minutes.'
          };
        }

        return {
          allowed: false,
          isLockedOut: false,
          remainingAttempts: 5 - this.failedPinAttempts,
          reason: `Incorrect PIN. ${5 - this.failedPinAttempts} attempts remaining.`
        };
      }
    });
  }

  private recordIncident(type: SecurityIncident['type'], severity: SecurityIncident['severity'], details: string) {
    const inc: SecurityIncident = {
      id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      severity,
      details
    };
    this.incidents.unshift(inc);
    if (this.incidents.length > 50) this.incidents.pop();
  }

  public sanitize(input: string, context?: AdkContext): string {
    const ctx = context || this.createContext();
    const tool = this.tools.get('sanitizeInput')!;
    return tool.execute({ rawInput: input }, ctx);
  }

  public validateStream(url: string, context?: AdkContext): { safe: boolean; reason: string } {
    const ctx = context || this.createContext();
    const tool = this.tools.get('validateStreamUrl')!;
    return tool.execute({ url }, ctx);
  }

  public recordPinAttempt(isSuccess: boolean, context?: AdkContext): {
    allowed: boolean;
    isLockedOut: boolean;
    remainingLockoutSec?: number;
    remainingAttempts?: number;
    reason?: string;
  } {
    const ctx = context || this.createContext();
    const tool = this.tools.get('auditAdminPinAttempt')!;
    return tool.execute({ isSuccess }, ctx);
  }

  public getSecurityReport(): {
    status: 'optimal' | 'warning' | 'alert';
    incidentCount: number;
    incidents: SecurityIncident[];
  } {
    return {
      status: this.incidents.length > 0 ? (this.incidents.some(i => i.severity === 'critical') ? 'alert' : 'warning') : 'optimal',
      incidentCount: this.incidents.length,
      incidents: [...this.incidents]
    };
  }
}

export const securityGuardAgent = new SecurityGuardAgent();
