import React from 'react';
import { Box, Text } from 'ink';

const helpItems = [
  { key: '▲▼', description: 'Navigate' },
  { key: '⏎', description: 'View Output' },
  { key: 'n', description: 'New' },
  { key: 's', description: 'Stop' },
  { key: 'c', description: 'Clear' },
  { key: 'q', description: 'Quit' },
];

export const HelpBar: React.FC = () => {
  return (
    <Box marginTop={1} borderStyle="round">
      <Box flexDirection="row" flexWrap="wrap" paddingX={1}>
        {helpItems.map((item, index) => (
          <Box key={item.key} paddingRight={1}>
            <Text>
              {index > 0 && <Text color="gray">| </Text>}
              <Text bold>{item.key}</Text> {item.description}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
