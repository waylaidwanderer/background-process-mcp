import React from 'react';
import { Box, Text } from 'ink';

interface DebugLogProps {
  log: string[];
}

export const DebugLog: React.FC<DebugLogProps> = ({ log }) => {
  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" flexGrow={1}>
      <Text color="red">Debug Log (Last 50 Messages)</Text>
      <Box marginTop={1} flexGrow={1} flexDirection="column" overflow="hidden">
        {log.map((line, index) => (
          <Text key={index} wrap="wrap">{line}</Text>
        ))}
      </Box>
    </Box>
  );
};
