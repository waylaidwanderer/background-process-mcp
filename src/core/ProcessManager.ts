import { v4 as uuidv4 } from 'uuid';
import pty, { IPty } from 'node-pty';
import treeKill from 'tree-kill';
import { ProcessState } from '../types/index.js';
import os from 'os';

const MAX_CONCURRENT_PROCESSES = 20;
const MAX_HISTORY_LINES_PER_PROCESS = 2000;
const SHELL = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

export interface ProcessManagerEvents {
  onProcessStarted: (process: ProcessState) => void;
  onProcessOutput: (processId: string, chunk: string) => void;
  onProcessStopped: (processId: string, exitCode: number | null, signal: string | null) => void;
}

interface InternalProcessState {
  state: ProcessState;
  ptyProcess: IPty;
  history: string[];
  startTime: number;
  endTime?: number;
}

// A single, named cleanup function that can be attached and detached by reference.
const globalCleanup = async () => {
  const allInstances = Array.from(ProcessManager['instances']);
  const killPromises = allInstances.flatMap(instance => instance.getAllKillPromises());

  if (killPromises.length === 0) {
    return;
  }

  // A short timeout to allow all kill signals to be processed.
  const timeout = setTimeout(() => {
    console.warn('Global cleanup timed out. Some processes may not have been terminated.');
    process.exit(1); // Exit with error on timeout
  }, 3000);

  await Promise.all(killPromises);
  clearTimeout(timeout);
};

const cleanupAndExit = async () => {
  await globalCleanup();
  process.exit(0);
};

export class ProcessManager {
  // @ts-ignore - This is used for test cleanup via setup file.
  private static instances: Set<ProcessManager> = new Set();

  private processes: Map<string, InternalProcessState> = new Map();
  private events: ProcessManagerEvents;

  constructor(events: ProcessManagerEvents) {
    this.events = events;
    // If this is the first instance, attach the global handlers.
    if (ProcessManager.instances.size === 0) {
      process.on('SIGINT', cleanupAndExit);
      process.on('SIGTERM', cleanupAndExit);
    }
    ProcessManager.instances.add(this);
  }

  public destroy() {
    ProcessManager.instances.delete(this);
    // If this was the last instance, remove the global handlers.
    if (ProcessManager.instances.size === 0) {
      process.removeListener('SIGINT', cleanupAndExit);
      process.removeListener('SIGTERM', cleanupAndExit);
    }
  }

  public getAllKillPromises(): Promise<void>[] {
    const runningProcesses = Array.from(this.processes.values()).filter(
      (p) => p.state.status === 'running'
    );
    return runningProcesses.map(p => {
      return new Promise<void>((resolve) => {
        if (p.state.pid) {
          treeKill(p.state.pid, 'SIGKILL', () => resolve());
        } else {
          resolve();
        }
      });
    });
  }

  public startProcess(command: string): ProcessState {
    if (this.processes.size >= MAX_CONCURRENT_PROCESSES) {
      throw new Error('Maximum number of concurrent processes reached.');
    }

    const id = uuidv4();
    const startTime = Date.now();
    const ptyProcess = pty.spawn(SHELL, ['-c', command], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env as { [key: string]: string },
    });

    const initialState: ProcessState = {
      id,
      command,
      pid: ptyProcess.pid,
      status: 'running',
      uptime: 0,
    };

    this.processes.set(id, { state: initialState, ptyProcess, history: [], startTime });
    this.events.onProcessStarted(initialState);

    ptyProcess.onData((data: string) => {
      const cleanedData = data.split('\n').map(line => line.trimEnd()).join('\n');
      const processInfo = this.processes.get(id);
      if (processInfo) {
        processInfo.history.push(cleanedData);
        if (processInfo.history.length > MAX_HISTORY_LINES_PER_PROCESS) {
          processInfo.history.splice(0, processInfo.history.length - MAX_HISTORY_LINES_PER_PROCESS);
        }
      }
      this.events.onProcessOutput(id, cleanedData);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      const processInfo = this.processes.get(id);
      if (processInfo) {
        processInfo.state.status = exitCode === 0 ? 'stopped' : 'error';
        processInfo.state.exitCode = exitCode;
        processInfo.endTime = Date.now();
        this.events.onProcessStopped(id, exitCode, signal?.toString() ?? null);
      }
    });
    
    return initialState;
  }

  public stopProcess(processId: string): void {
    const processInfo = this.processes.get(processId);
    if (!processInfo || processInfo.state.status !== 'running') {
    throw new Error('Process not found or not running.');
  }

  if (processInfo.state.pid) {
    treeKill(processInfo.state.pid);
  }  }

  public clearProcess(processId: string): void {
    const processInfo = this.processes.get(processId);
    if (!processInfo) {
      throw new Error('Process not found.');
    }
    if (processInfo.state.status === 'running') {
      throw new Error('Cannot clear a running process. Stop it first.');
    }
    this.processes.delete(processId);
  }

  public getProcess(processId: string): ProcessState | undefined {
    const processInfo = this.processes.get(processId);
    if (!processInfo) return undefined;
    return this.calculateUptime(processInfo);
  }

  public getProcessOutput(processId: string, options?: { head?: number; tail?: number }): string[] | undefined {
    const processInfo = this.processes.get(processId);
    if (!processInfo) return undefined;

    const fullLog = processInfo.history.join('');
    // Normalize CRLF to LF before splitting to handle pty output correctly.
    let lines = fullLog.replace(/\r\n/g, '\n').split('\n');
    
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }

    if (options?.head !== undefined) {
      return lines.slice(0, options.head);
    }

    if (options?.tail !== undefined) {
      return lines.slice(-options.tail);
    }

    return lines;
  }

  public getAllProcesses(): ProcessState[] {
    return Array.from(this.processes.values()).map(p => this.calculateUptime(p));
  }

  private calculateUptime(processInfo: InternalProcessState): ProcessState {
    const endTime = processInfo.endTime || Date.now();
    const uptime = (endTime - processInfo.startTime) / 1000; // in seconds
    return { ...processInfo.state, uptime };
  }

  public getProcessCounts() {
    const counts = {
      total: this.processes.size,
      running: 0,
      stopped: 0,
      errored: 0,
    };

    for (const { state } of this.processes.values()) {
      if (state.status === 'running') counts.running++;
      else if (state.status === 'stopped') counts.stopped++;
      else if (state.status === 'error') counts.errored++;
    }

    return counts;
  }
}
