import { Box, Text } from 'ink';

import type { FC } from 'react';

interface StatusPanelProps {
    isConnected: boolean;
    serverVersion: string | null;
    processCount: number;
    port: number | null;
    pid: number | null;
    uptime: number | null;
    processCounts: {
        running: number;
        stopped: number;
        errored: number;
    } | null;
}

const formatUptime = (totalSeconds: number | null): string => {
    if (totalSeconds === null || totalSeconds < 0) return 'N/A';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
};

const StatusPanel: FC<StatusPanelProps> = (props) => {
    const {
        isConnected,
        serverVersion,
        processCount,
        port,
        pid,
        uptime,
        processCounts,
    } = props;

    const statusText = isConnected ? (
        <Text color="green">● Connected</Text>
    ) : (
        <Text color="red">○ Disconnected</Text>
    );

    const statusItems = [
        { label: 'Port', value: port },
        { label: 'PID', value: pid },
        { label: 'Uptime', value: formatUptime(uptime) },
        { label: 'Version', value: serverVersion },
        {
            label: 'Processes',
            value: processCounts && (
                <Text>
                    {processCount} (<Text color="green">{processCounts.running} running</Text>
                    , <Text color="yellow">{processCounts.stopped} stopped</Text>,{' '}
                    <Text color="red">{processCounts.errored} errored</Text>)
                </Text>
            ),
        },
    ].filter((item) => item.value !== null && item.value !== undefined);

    return (
        <Box borderStyle="round" paddingX={1} flexDirection="column">
            <Text color="cyan">Server Status</Text>
            <Box marginTop={1} flexWrap="wrap">
                <Box paddingRight={1}>
                    <Text>{statusText}</Text>
                </Box>
                {statusItems.map((item) => (
                    <Box key={item.label} paddingRight={1}>
                        <Text>
                            <Text color="gray">| </Text>
                            {item.label}: {item.value}
                        </Text>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

export default StatusPanel;
