import pty from 'node-pty';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IPty } from 'node-pty';

import type {
  ProcessManager,
  ProcessManagerEvents,
} from '../ProcessManager.js';

// Define a mock function variable. This is a robust pattern for mocking.
const treeKillMock = vi.fn();

// Hoist the mock for tree-kill. This is the correct way to mock in Vitest,
// especially for CJS modules in an ESM project.
vi.mock('tree-kill', () => ({
  default: treeKillMock,
}));

// DO NOT use vi.mock for 'node-pty'. It's a native addon and the hoisting
// mechanism is unreliable. vi.spyOn is the correct, surgical tool.

describe('ProcessManager', () => {
  let ProcessManagerModule: {
    ProcessManager: new (events: ProcessManagerEvents) => ProcessManager;
  };
  let processManager: ProcessManager;
  let mockPtyProcess: IPty;
  let mockEvents: ProcessManagerEvents;

  // By resetting modules and re-importing, we ensure each test gets a
  // fresh ProcessManager instance with the hoisted mocks applied correctly.
  beforeEach(async () => {
    vi.resetModules();
    ProcessManagerModule = await import('../ProcessManager.js');

    mockPtyProcess = {
      pid: 12345,
      onData: vi.fn(),
      onExit: vi.fn(),
      kill: vi.fn(),
    } as unknown as IPty;

    vi.spyOn(pty, 'spawn').mockReturnValue(mockPtyProcess);

    mockEvents = {
      onProcessStarted: vi.fn(),
      onProcessOutput: vi.fn(),
      onProcessStopped: vi.fn(),
    };

    processManager = new ProcessManagerModule.ProcessManager(mockEvents);
  });

  afterEach(() => {
    // Destroy the process manager to clean up global event listeners.
    processManager.destroy();
    vi.clearAllMocks();
  });

  it('should start a process and emit onProcessStarted event', () => {
    const command = 'ls -la';
    const processState = processManager.startProcess(command);

    expect(pty.spawn).toHaveBeenCalled();
    expect(processState.command).toBe(command);
    expect(processState.status).toBe('running');
    expect(processState.pid).toBe(12345);
    expect(processManager.getAllProcesses()).toHaveLength(1);
    expect(mockEvents.onProcessStarted).toHaveBeenCalledWith(processState);
  });

  it('should not start a process if the concurrent limit is reached', () => {
    for (let i = 0; i < 20; i += 1) {
      processManager.startProcess(`cmd_${i}`);
    }
    expect(() => processManager.startProcess('one_too_many')).toThrow(
      'Maximum number of concurrent processes reached.',
    );
  });

  it('should stop a running process', () => {
    const processState = processManager.startProcess('sleep 5');
    processManager.stopProcess(processState.id);
    expect(treeKillMock).toHaveBeenCalledWith(processState.pid);
  });

  it('should throw an error when trying to stop a non-existent process', () => {
    expect(() => processManager.stopProcess('non-existent-id')).toThrow(
      'Process not found or not running.',
    );
  });

  it('should clear a stopped process', () => {
    const processState = processManager.startProcess('echo "done"');
    const onExitCallback = vi.mocked(mockPtyProcess.onExit).mock.calls[0][0] as (
      e: { exitCode: number; signal: number },
    ) => void;
    onExitCallback({ exitCode: 0, signal: 0 });
    processManager.clearProcess(processState.id);
    expect(processManager.getAllProcesses()).toHaveLength(0);
  });

  it('should throw an error when trying to clear a running process', () => {
    const processState = processManager.startProcess('sleep 10');
    expect(() => processManager.clearProcess(processState.id)).toThrow(
      'Cannot clear a running process. Stop it first.',
    );
  });

  it('should handle process exit with code 0 and emit onProcessStopped event', () => {
    const processState = processManager.startProcess('echo "exit"');
    const onExitCallback = vi.mocked(mockPtyProcess.onExit).mock.calls[0][0] as (
      e: { exitCode: number; signal: number },
    ) => void;
    onExitCallback({ exitCode: 0, signal: 0 });
    expect(mockEvents.onProcessStopped).toHaveBeenCalledWith(
      processState.id,
      0,
      '0',
    );
    expect(processManager.getProcess(processState.id)?.status).toBe('stopped');
  });

  it('should handle process exit with non-zero code and set status to "error"', () => {
    const processState = processManager.startProcess('echo "error"');
    const onExitCallback = vi.mocked(mockPtyProcess.onExit).mock.calls[0][0] as (
      e: { exitCode: number; signal: number },
    ) => void;
    onExitCallback({ exitCode: 1, signal: 0 });
    expect(mockEvents.onProcessStopped).toHaveBeenCalledWith(
      processState.id,
      1,
      '0',
    );
    expect(processManager.getProcess(processState.id)?.status).toBe('error');
  });

  describe('getProcessOutput', () => {
    const simulateOutput = (lines: string[]): void => {
      const onDataCallback = vi.mocked(mockPtyProcess.onData).mock.calls[0][0] as (
        data: string,
      ) => void;
      lines.forEach((line) => onDataCallback(line));
    };

    it('should return the full output, normalizing CRLF line endings', () => {
      const processState = processManager.startProcess('test');
      simulateOutput(['line1\r\n', 'line2\r\n', 'line3']);
      const output = processManager.getProcessOutput(processState.id);
      expect(output).toEqual(['line1', 'line2', 'line3']);
    });

    it('should return the first N lines for the head option', () => {
      const processState = processManager.startProcess('test');
      simulateOutput(['line1\n', 'line2\n', 'line3\n', 'line4\n', 'line5']);
      const output = processManager.getProcessOutput(processState.id, {
        head: 3,
      });
      expect(output).toEqual(['line1', 'line2', 'line3']);
    });

    it('should return the last N lines for the tail option', () => {
      const processState = processManager.startProcess('test');
      simulateOutput(['line1\n', 'line2\n', 'line3\n', 'line4\n', 'line5']);
      const output = processManager.getProcessOutput(processState.id, {
        tail: 3,
      });
      expect(output).toEqual(['line3', 'line4', 'line5']);
    });

    it('should prioritize head over tail when both are provided', () => {
      const processState = processManager.startProcess('test');
      simulateOutput(['line1\n', 'line2\n', 'line3\n', 'line4\n', 'line5']);
      const output = processManager.getProcessOutput(processState.id, {
        head: 2,
        tail: 2,
      });
      expect(output).toEqual(['line1', 'line2']);
    });

    it('should handle head being larger than the number of lines', () => {
      const processState = processManager.startProcess('test');
      simulateOutput(['line1\n', 'line2']);
      const output = processManager.getProcessOutput(processState.id, {
        head: 5,
      });
      expect(output).toEqual(['line1', 'line2']);
    });

    it('should handle tail being larger than the number of lines', () => {
      const processState = processManager.startProcess('test');
      simulateOutput(['line1\n', 'line2']);
      const output = processManager.getProcessOutput(processState.id, {
        tail: 5,
      });
      expect(output).toEqual(['line1', 'line2']);
    });
  });
});
