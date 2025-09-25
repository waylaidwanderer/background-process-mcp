/* eslint-disable import-x/no-extraneous-dependencies */
import { afterEach } from 'vitest';

import { ProcessManager } from '../ProcessManager.js';

afterEach(() => {
  // This is a crucial cleanup step that prevents ProcessManager instances
  // and their global signal listeners from leaking between tests.
  // @ts-expect-error - Accessing private static member for test cleanup
  const instances = Array.from(ProcessManager.instances);
  instances.forEach((instance) => {
    instance.destroy();
  });
});
