// ============================================================================
// AI PETROS // GOOGLE ADK (AGENT DEVELOPMENT KIT) RUNTIME DEFINITIONS (adk.dev)
// Strongly typed, code-first agent runtime conforming to Google's Agent Development Kit spec
// ============================================================================

export interface AdkToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
}

export interface AdkTool<TParams = any, TOutput = any> {
  name: string;
  description: string;
  parameters?: Record<string, AdkToolParameterSchema>;
  execute: (params: TParams, context: AdkContext) => Promise<TOutput> | TOutput;
}

export interface AdkAgentConfig {
  name: string;
  description: string;
  instruction: string;
  model?: string;
  tools?: AdkTool[];
  subagents?: AdkAgent[];
}

export interface AdkLogEntry {
  timestamp: number;
  agentName: string;
  level: 'info' | 'warn' | 'action' | 'error';
  message: string;
  data?: any;
}

export interface AdkContext {
  sessionId: string;
  timestamp: number;
  logs: AdkLogEntry[];
  log: (level: 'info' | 'warn' | 'action' | 'error', message: string, data?: any) => void;
  metadata?: Record<string, any>;
}

export interface AdkExecutionResult<T = any> {
  agentName: string;
  success: boolean;
  data: T;
  executionTimeMs: number;
  toolsInvoked: string[];
  logs: AdkLogEntry[];
}

export class AdkAgent<TInput = any, TOutput = any> {
  public readonly name: string;
  public readonly description: string;
  public readonly instruction: string;
  public readonly model: string;
  public readonly tools: Map<string, AdkTool> = new Map();
  public readonly subagents: Map<string, AdkAgent> = new Map();

  constructor(config: AdkAgentConfig) {
    this.name = config.name;
    this.description = config.description;
    this.instruction = config.instruction;
    this.model = config.model || 'adk-deterministic-fast-v1';

    if (config.tools) {
      for (const t of config.tools) {
        this.tools.set(t.name, t);
      }
    }
    if (config.subagents) {
      for (const s of config.subagents) {
        this.subagents.set(s.name, s);
      }
    }
  }

  public registerTool(tool: AdkTool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  public registerSubagent(subagent: AdkAgent): this {
    this.subagents.set(subagent.name, subagent);
    return this;
  }

  public async invokeTool<T = any>(toolName: string, params: any, context: AdkContext): Promise<T> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`[ADK:${this.name}] Tool "${toolName}" is not registered.`);
    }
    context.log('action', `Invoking tool "${toolName}"`, { params });
    const result = await tool.execute(params, context);
    return result as T;
  }

  public createContext(sessionId?: string): AdkContext {
    const logs: AdkLogEntry[] = [];
    const agentName = this.name;
    return {
      sessionId: sessionId || `adk-session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      logs,
      log: (level, message, data) => {
        logs.unshift({
          timestamp: Date.now(),
          agentName,
          level,
          message,
          data
        });
        if (logs.length > 100) logs.pop();
        if (level === 'action' || level === 'warn' || level === 'error') {
          console.log(`[ADK:${agentName}] [${level.toUpperCase()}] ${message}`, data || '');
        }
      }
    };
  }
}
