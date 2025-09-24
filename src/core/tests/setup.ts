import { afterEach } from 'vitest';
import { ProcessManager } from '../ProcessManager.js';

afterEach(() => {
  // This is a crucial cleanup step that prevents ProcessManager instances
  // and their global signal listeners from leaking between tests.
  // @ts-ignore - Accessing private static member for test cleanup
  const instances = Array.from(ProcessManager['instances']);
  for (const instance of instances) {
    instance.destroy();
  }
});
