import React from 'react';
import { Box, Text } from 'ink';
import { ProcessInfo } from '../../types/index.js';

interface ProcessDetailProps {
  process: ProcessInfo | undefined;
}

const formatUptime = (totalSeconds: number | null | undefined) => {
  if (totalSeconds === null || totalSeconds === undefined || totalSeconds < 0) return 'N/A';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

export const ProcessDetail: React.FC<ProcessDetailProps> = ({ process }) => {
  if (!process) {
    return (
      <Box borderStyle="round" paddingX={1} flexDirection="column" width="100%">
        <Text color="cyan">Process Details</Text>
        <Box marginTop={1}>
          <Text color="gray">No process selected.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column">
      <Text color="cyan">Process Details</Text>
      <Box marginTop={1} flexDirection="column">
        <Box flexDirection="row" width="100%">
          <Box flexShrink={0}>
            <Text>ID: </Text>
          </Box>
          <Box flexGrow={1} overflow="hidden">
            <Text wrap="truncate-end">{process.id}</Text>
          </Box>
        </Box>
        
        <Box flexDirection="row" width="100%">
          <Box flexShrink={0}>
            <Text>Command: </Text>
          </Box>
          <Box flexGrow={1} marginLeft={1}>
            <Text wrap="truncate-end">{process.command}</Text>
          </Box>
        </Box>

        <Box>
          <Text>PID: {process.pid || 'N/A'}</Text>
        </Box>

        <Box>
          <Text>Status: {process.status}</Text>
        </Box>

        <Box>
          <Text>Uptime: {formatUptime(process.uptime)}</Text>
        </Box>

        <Box>
          <Text>Exit Code: {process.exitCode ?? 'N/A'}</Text>
        </Box>
      </Box>
    </Box>
  );
};