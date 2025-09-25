import os from 'node:os';

import pty from 'node-pty';
import treeKill from 'tree-kill';
import { v4 as uuidv4 } from 'uuid';

import type { IPty } from 'node-pty';

import type { ProcessState } from '../types/index.js';

const MAX_CONCURRENT_PROCESSES = 20;
const MAX_HISTORY_LINES_PER_PROCESS = 2000;
const SHELL = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

export interface ProcessManagerEvents {
    onProcessStarted: (process: ProcessState) => void;
    onProcessOutput: (processId: string, chunk: string) => void;
    onProcessStopped: (
        processId: string,
        exitCode: number | null,
        signal: string | null,
    ) => void;
}

interface InternalProcessState {
    state: ProcessState;
    ptyProcess: IPty;
    history: string[];
    startTime: number;
    endTime?: number;
}

export class ProcessManager {
    public static instances = new Set<ProcessManager>();

    private processes = new Map<string, InternalProcessState>();

    private events: ProcessManagerEvents;

    public constructor(events: ProcessManagerEvents) {
        this.events = events;
        ProcessManager.instances.add(this);
    }

    public destroy(): void {
        ProcessManager.instances.delete(this);
    }

    public static async globalCleanup(): Promise<void> {
        const allInstances = Array.from(ProcessManager.instances);
        const killPromises = allInstances.flatMap((instance) => instance.getAllKillPromises());

        if (killPromises.length === 0) {
            return;
        }

        // A short timeout to allow all kill signals to be processed.
        const timeout = setTimeout(() => {
            // eslint-disable-next-line no-console
            console.warn(
                'Global cleanup timed out. Some processes may not have been terminated.',
            );
            throw new Error('Global cleanup timed out.');
        }, 3000);

        await Promise.all(killPromises);
        clearTimeout(timeout);
    }

    public getAllKillPromises(): Promise<void>[] {
        const runningProcesses = Array.from(this.processes.values()).filter(
            (p) => p.state.status === 'running',
        );
        return runningProcesses.map(
            async (p) => new Promise<void>((resolve) => {
                if (p.state.pid) {
                    treeKill(p.state.pid, 'SIGKILL', () => resolve());
                } else {
                    resolve();
                }
            }),
        );
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
            env: process.env as Record<string, string>,
        });

        const initialState: ProcessState = {
            id,
            command,
            pid: ptyProcess.pid,
            status: 'running',
            uptime: 0,
        };

        this.processes.set(id, {
            state: initialState,
            ptyProcess,
            history: [],
            startTime,
        });
        this.events.onProcessStarted(initialState);

        ptyProcess.onData((data: string) => {
            const cleanedData = data
                .split('\n')
                .map((line) => line.trimEnd())
                .join('\n');
            const processInfo = this.processes.get(id);
            if (processInfo) {
                processInfo.history.push(cleanedData);
                if (processInfo.history.length > MAX_HISTORY_LINES_PER_PROCESS) {
                    processInfo.history.splice(
                        0,
                        processInfo.history.length - MAX_HISTORY_LINES_PER_PROCESS,
                    );
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
        }
    }

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
        return ProcessManager.calculateUptime(processInfo);
    }

    public getProcessOutput(
        processId: string,
        options?: { head?: number; tail?: number },
    ): string[] | undefined {
        const processInfo = this.processes.get(processId);
        if (!processInfo) return undefined;

        const fullLog = processInfo.history.join('');
        // Normalize CRLF to LF before splitting to handle pty output correctly.
        const lines = fullLog.replace(/\r\n/g, '\n').split('\n');

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
        return Array.from(this.processes.values()).map((p) => ProcessManager.calculateUptime(p));
    }

    private static calculateUptime(
        processInfo: InternalProcessState,
    ): ProcessState {
        const endTime = processInfo.endTime ?? Date.now();
        const uptime = (endTime - processInfo.startTime) / 1000; // in seconds
        return { ...processInfo.state, uptime };
    }

    public getProcessCounts(): {
        total: number;
        running: number;
        stopped: number;
        errored: number;
    } {
        const counts = {
            total: this.processes.size,
            running: 0,
            stopped: 0,
            errored: 0,
        };

        this.processes.forEach(({ state }) => {
            if (state.status === 'running') {
                counts.running += 1;
            } else if (state.status === 'stopped') {
                counts.stopped += 1;
            } else if (state.status === 'error') {
                counts.errored += 1;
            }
        });

        return counts;
    }
}
