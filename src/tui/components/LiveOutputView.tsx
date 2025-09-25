import React, { useEffect, useRef, useState } from 'react';

import {
    Box,
    measureElement,
    Text,
    useInput,
    useStdout,
} from 'ink';

import type { DOMElement } from 'ink';
import type { FC } from 'react';

import type { ProcessInfo } from '../../types/index.js';

interface LiveOutputViewProps {
    process: ProcessInfo;
    terminalHeight: number;
    maxLines?: number;
}

const getStatusColor = (status: ProcessInfo['status']): string => {
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

const LiveOutputView: FC<LiveOutputViewProps> = ({
    process,
    terminalHeight,
    maxLines = 2000,
}) => {
    const [scrollTop, setScrollTop] = useState(0);
    const [isLocked, setIsLocked] = useState(true);
    const [containerHeight, setContainerHeight] = useState(0);
    const containerRef = useRef<DOMElement>(null);
    const { stdout } = useStdout();

    const lines = (process.output ?? '').split('\n').slice(-maxLines);
    const totalLines = lines.length;
    const maxScroll = Math.max(0, totalLines - containerHeight);

    useEffect(() => {
        const measure = (): void => {
            if (containerRef.current) {
                const { height } = measureElement(containerRef.current);
                setContainerHeight(height);
            }
        };
        const timeoutId = setTimeout(measure, 50);
        stdout.on('resize', measure);
        return () => {
            clearTimeout(timeoutId);
            stdout.off('resize', measure);
        };
    }, [stdout]);

    useEffect(() => {
        if (isLocked) {
            setScrollTop(maxScroll);
        }
    }, [totalLines, containerHeight, isLocked, maxScroll]);

    useInput((_, key) => {
        if (key.upArrow) {
            setIsLocked(false);
            setScrollTop((prev) => Math.max(0, prev - 1));
        }
        if (key.downArrow) {
            const newScrollTop = Math.min(scrollTop + 1, maxScroll);
            setScrollTop(newScrollTop);
            if (newScrollTop >= maxScroll) setIsLocked(true);
        }
        if (key.pageUp) {
            setIsLocked(false);
            setScrollTop((prev) => Math.max(0, prev - containerHeight));
        }
        if (key.pageDown) {
            const newScrollTop = Math.min(scrollTop + containerHeight, maxScroll);
            setScrollTop(newScrollTop);
            if (newScrollTop >= maxScroll) setIsLocked(true);
        }
    });

    const renderOutput = (): React.JSX.Element => {
        if (totalLines === 0) {
            return <Text color="gray">No output yet...</Text>;
        }
        const visibleLines = lines.slice(scrollTop, scrollTop + containerHeight);
        return <Text>{visibleLines.join('\n')}</Text>;
    };

    const renderScrollbar = (): React.JSX.Element => {
        if (totalLines <= containerHeight) return <></>;

        const thumbSize = Math.max(
            1,
            Math.floor((containerHeight / totalLines) * containerHeight),
        );
        const thumbPosition = Math.floor(
            (scrollTop / maxScroll) * (containerHeight - thumbSize),
        );

        const scrollbar = Array.from({ length: containerHeight }, (_, i) => {
            if (i >= thumbPosition && i < thumbPosition + thumbSize) {
                return '█';
            }
            return '░';
        });

        return (
            <Box flexDirection="column" marginLeft={1}>
                <Text>{scrollbar.join('\n')}</Text>
            </Box>
        );
    };

    return (
        <Box
            flexDirection="column"
            width="100%"
            height={terminalHeight}
            borderStyle="round"
            padding={1}
        >
            <Box>
                <Text bold>Live Output for: </Text>
                <Text>{process.command}</Text>
                <Text> (</Text>
                <Text color={getStatusColor(process.status)}>● {process.status}</Text>
                <Text>)</Text>
            </Box>
            <Box
                marginTop={1}
                flexGrow={1}
                borderStyle="round"
                paddingX={1}
                flexDirection="row"
                overflow="hidden"
            >
                <Box
                    ref={containerRef}
                    flexGrow={1}
                    flexDirection="column"
                    overflow="hidden"
                >
                    {containerHeight > 0 && renderOutput()}
                </Box>
                {containerHeight > 0 && renderScrollbar()}
            </Box>
            <Box marginTop={1}>
                <Text color="gray">
                    Use ↑↓/PgUp/PgDn to scroll. Press &apos;esc&apos; to return.
                </Text>
            </Box>
        </Box>
    );
};

export default LiveOutputView;
