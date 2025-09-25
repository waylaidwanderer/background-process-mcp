import { Box, Text } from 'ink';

import type { FC } from 'react';

import type { ProcessInfo, ProcessState } from '../../types/index.js';

interface ProcessListProps {
    processes: ProcessInfo[];
    selectedProcessId: string | null;
}

const getStatusColor = (status: ProcessState['status']): string => {
    switch (status) {
    case 'running':
        return 'green';
    case 'stopped':
        return 'yellow';
    case 'error':
        return 'red';
    default:
        return 'gray';
    }
};

const ProcessList: FC<ProcessListProps> = ({
    processes,
    selectedProcessId,
}) => (
    <Box borderStyle="round" paddingX={1} flexDirection="column" width="100%">
        <Text color="cyan">Processes</Text>
        <Box flexDirection="column" marginTop={1}>
            {processes.length === 0 && <Text color="gray">No processes running.</Text>}
            {processes.map((p) => (
                <Box
                    key={p.id}
                    flexDirection="row"
                    width="100%"
                    backgroundColor={p.id === selectedProcessId ? 'blue' : undefined}
                >
                    <Box flexShrink={0}>
                        <Text
                            color={
                                p.id === selectedProcessId ? 'white' : getStatusColor(p.status)
                            }
                        >
                            ●
                        </Text>
                    </Box>

                    <Box flexGrow={1} marginLeft={1} overflow="hidden">
                        <Text
                            color={p.id === selectedProcessId ? 'white' : 'white'}
                            wrap="truncate-end"
                        >
                            {p.command}
                        </Text>
                    </Box>

                    <Box flexShrink={0} marginLeft={1}>
                        <Text color={p.id === selectedProcessId ? 'white' : 'gray'}>
                            ({p.pid ?? 'N/A'}) - {p.status}
                        </Text>
                    </Box>
                </Box>
            ))}
        </Box>
    </Box>
);

export default ProcessList;
