import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';

interface InputBarProps {
  onSubmit: (command: string) => void;
  onCancel: () => void;
}

export const InputBar: React.FC<InputBarProps> = ({ onSubmit, onCancel }) => {
  // We use a key to force a re-mount of the uncontrolled component, which is the
  // idiomatic way to clear its internal state from a parent.
  const [clearKey, setClearKey] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    }

    // Add a shortcut to clear the input (Ctrl+U is a common terminal shortcut)
    if (key.ctrl && input === 'u') {
      setClearKey(prev => prev + 1);
    }
  });

  // Wrap the onSubmit handler to prevent empty submissions.
  const handleSubmit = (command: string) => {
    if (command.trim().length > 0) {
      onSubmit(command);
    } else {
      // If the input is empty, just clear it for a better UX.
      setClearKey(prev => prev + 1);
    }
  };

  return (
    <Box marginTop={1} paddingX={1} borderStyle="round">
      <Box marginRight={1}>
        <Text>Command:</Text>
      </Box>
      <TextInput
        key={clearKey}
        placeholder="Enter command (Esc to cancel, Ctrl+U to clear)"
        onSubmit={handleSubmit}
      />
    </Box>
  );
};
