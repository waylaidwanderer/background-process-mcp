import { Box, Text } from 'ink';

import type { FC } from 'react';

interface DebugLogProps {
    log: string[];
}

const DebugLog: FC<DebugLogProps> = ({ log }) => (
    <Box borderStyle="round" paddingX={1} flexDirection="column" flexGrow={1}>
        <Text color="red">Debug Log (Last 50 Messages)</Text>
        <Box marginTop={1} flexGrow={1} flexDirection="column" overflow="hidden">
            {log.map((line) => (
                <Text key={line} wrap="wrap">
                    {line}
                </Text>
            ))}
        </Box>
    </Box>
);

export default DebugLog;
