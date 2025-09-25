import {
  describe, expect, it, vi,
} from 'vitest';

import { ProcessManager } from '../ProcessManager.js';

import type { ProcessManagerEvents } from '../ProcessManager.js';

describe('ProcessManager Integration', () => {
  it('should start, receive output from, and stop a real process', async () => {
    const onProcessStarted = vi.fn();
    const onProcessOutput = vi.fn();
    const onProcessStopped = vi.fn();

    const events: ProcessManagerEvents = {
      onProcessStarted,
      onProcessOutput,
      onProcessStopped,
    };

    const processManager = new ProcessManager(events);

    // 1. Start the process
    const command = 'echo "hello integration" && sleep 0.2';
    const processState = processManager.startProcess(command);

    expect(onProcessStarted).toHaveBeenCalled();
    expect(processState.status).toBe('running');

    // 2. Wait for output and stop
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    }); // Give it time to emit output

    expect(onProcessOutput).toHaveBeenCalledWith(
      processState.id,
      expect.stringContaining('hello integration'),
    );

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    }); // Wait for it to finish

    expect(onProcessStopped).toHaveBeenCalled();
    const stopArgs = onProcessStopped.mock.calls[0];
    expect(stopArgs[0]).toBe(processState.id);
    expect(stopArgs[1]).toBe(0); // Exit code 0 for success
  });

  it('should successfully terminate a long-running process', async () => {
    const onProcessStopped = vi.fn();
    const events: ProcessManagerEvents = {
      onProcessStarted: vi.fn(),
      onProcessOutput: vi.fn(),
      onProcessStopped,
    };

    const processManager = new ProcessManager(events);

    const processState = processManager.startProcess('sleep 10');

    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    }); // Give it time to start

    processManager.stopProcess(processState.id);

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    }); // Give it time to stop

    expect(onProcessStopped).toHaveBeenCalled();
    const stopArgs = onProcessStopped.mock.calls[0];
    expect(stopArgs[0]).toBe(processState.id);
    // When killed, the exit code might be null or non-zero, but a signal should be present
    expect(stopArgs[2]).not.toBeNull();
  });

  it('should get correct head and tail of output from a real process', async () => {
    const processManager = new ProcessManager({
      onProcessStarted: vi.fn(),
      onProcessOutput: vi.fn(),
      onProcessStopped: vi.fn(),
    });

    // A simple script to print 5 lines
    const command = 'for i in $(seq 1 5); do echo "line $i"; done';
    const processState = processManager.startProcess(command);

    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    }); // Wait for the script to finish

    // Test tail
    const tailOutput = processManager.getProcessOutput(processState.id, {
      tail: 3,
    });
    expect(tailOutput?.map((l) => l.trim())).toEqual([
      'line 3',
      'line 4',
      'line 5',
    ]);

    // Test head
    const headOutput = processManager.getProcessOutput(processState.id, {
      head: 2,
    });
    expect(headOutput?.map((l) => l.trim())).toEqual(['line 1', 'line 2']);
  });
});
