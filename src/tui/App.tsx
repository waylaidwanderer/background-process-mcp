/* eslint-disable no-console */
import { useCallback, useEffect, useState } from 'react';

import {
    Box, useApp, useInput, useStdout,
} from 'ink';
import WebSocket from 'ws';

import { ServerMessageSchema } from '../types/index.js';
import DebugLog from './components/DebugLog.js';
import HelpBar from './components/HelpBar.js';
import InputBar from './components/InputBar.js';
import LiveOutputView from './components/LiveOutputView.js';
import ProcessDetail from './components/ProcessDetail.js';
import ProcessList from './components/ProcessList.js';
import ProcessOutput from './components/ProcessOutput.js';
import StatusPanel from './components/StatusPanel.js';

import type { FC } from 'react';
import type { WebSocket as WebSocketType } from 'ws';

import type {
    ClientMessage,
    ProcessInfo,
    ProcessState,
} from '../types/index.js';

interface AppProps {
    serverUrl: string;
    isDebugMode: boolean;
}

const RESPONSIVE_BREAKPOINT = 120;

const App: FC<AppProps> = ({ serverUrl, isDebugMode }) => {
    const { stdout } = useStdout();
    const { exit } = useApp();
    const [isWide, setIsWide] = useState(
        stdout.columns >= RESPONSIVE_BREAKPOINT,
    );
    const [terminalHeight, setTerminalHeight] = useState(stdout.rows);

    const [isConnected, setIsConnected] = useState(false);
    const [processes, setProcesses] = useState<ProcessInfo[]>([]);
    const [serverVersion, setServerVersion] = useState<string | null>(null);
    const [serverPort, setServerPort] = useState<number | null>(null);
    const [serverPid, setServerPid] = useState<number | null>(null);
    const [serverUptime, setServerUptime] = useState<number | null>(null);
    const [processCounts, setProcessCounts] = useState({
        running: 0,
        stopped: 0,
        errored: 0,
    });
    const [selectedProcessId, setSelectedProcessId] = useState<string | null>(
        null,
    );
    const [isInputting, setIsInputting] = useState(false);
    const [viewMode, setViewMode] = useState<'dashboard' | 'live_output'>(
        'dashboard',
    );
    const [isDebugVisible, setIsDebugVisible] = useState(false);
    const [debugLog, setDebugLog] = useState<string[]>([]);

    const [ws, setWs] = useState<WebSocketType | null>(null);

    const selectedProcess = processes.find((p) => p.id === selectedProcessId);

    const sendMessage = useCallback(
        (command: ClientMessage) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(command));
            }
        },
        [ws],
    );

    useEffect(() => {
        const onResize = (): void => {
            setIsWide(stdout.columns >= RESPONSIVE_BREAKPOINT);
            setTerminalHeight(stdout.rows);
        };
        stdout.on('resize', onResize);
        return () => {
            stdout.off('resize', onResize);
        };
    }, [stdout]);

    useEffect(() => {
        if (isConnected) {
            sendMessage({
                action: 'client.request_status',
                requestId: Date.now().toString(),
            });
        }
    }, [isConnected, sendMessage]);

    useEffect(() => {
        const counts = { running: 0, stopped: 0, errored: 0 };
        processes.forEach((process) => {
            if (process.status === 'running') {
                counts.running += 1;
            } else if (process.status === 'stopped') {
                counts.stopped += 1;
            } else if (process.status === 'error') {
                counts.errored += 1;
            }
        });
        setProcessCounts(counts);
    }, [processes]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            if (isConnected) {
                sendMessage({
                    action: 'client.list_processes',
                    requestId: Date.now().toString(),
                });
            }
        }, 60000); // 1 minute
        return () => clearInterval(intervalId);
    }, [isConnected, sendMessage]);

    const handleMessage = useCallback(
        (data: WebSocketType.RawData) => {
            try {
                const message = ServerMessageSchema.parse(
                    JSON.parse(data.toString()) as unknown,
                );
                if (isDebugMode) {
                    setDebugLog(
                        (prev) => [
                            `[${new Date().toLocaleTimeString()}] RECV: ${JSON.stringify(
                                message,
                            )}`,
                            ...prev,
                        ].slice(0, 50),
                    );
                }

                switch (message.action) {
                case 'server.full_state':
                    setProcesses(
                        message.processes.map((p: ProcessState) => ({ ...p, output: undefined })),
                    );
                    if (message.processes.length > 0) {
                        setSelectedProcessId(message.processes[0].id);
                    }
                    break;
                case 'server.process_started':
                    setProcesses((prev) => {
                        if (prev.length === 0) {
                            setSelectedProcessId(message.process.id);
                        }
                        return [...prev, { ...message.process, output: undefined }];
                    });
                    break;
                case 'server.process_output':
                    setProcesses((prev) => prev.map((p) => (p.id === message.processId
                        ? { ...p, output: (p.output ?? '') + message.rawOutput }
                        : p)));
                    break;
                case 'server.process_stopped':
                    setProcesses((prev) => prev.map((p) => (p.id === message.process.id
                        ? { ...p, ...message.process }
                        : p)));
                    break;
                case 'server.process_cleared':
                    setProcesses((prevProcesses) => {
                        const newProcesses = prevProcesses.filter(
                            (p) => p.id !== message.processId,
                        );
                        setSelectedProcessId((prevSelectedId) => {
                            if (prevSelectedId === message.processId) {
                                if (newProcesses.length === 0) return null;
                                const oldIndex = prevProcesses.findIndex(
                                    (p) => p.id === message.processId,
                                );
                                return newProcesses[
                                    Math.min(oldIndex, newProcesses.length - 1)
                                ].id;
                            }
                            return prevSelectedId;
                        });
                        return newProcesses;
                    });
                    break;
                case 'server.output_response':
                    setProcesses((prev) => prev.map((p) => (p.id === message.processId
                        ? { ...p, output: message.output.join('\n') }
                        : p)));
                    break;
                case 'server.status_response':
                    setServerVersion(message.version);
                    setServerPort(message.port);
                    setServerPid(message.pid);
                    setServerUptime(message.uptime);
                    break;
                case 'server.list_processes_response':
                    setProcesses((prevProcesses) => {
                        const clientProcs = new Map(
                            prevProcesses.map((p) => [p.id, p]),
                        );
                        return message.processes.map((sp: ProcessState) => ({
                            ...sp,
                            output: clientProcs.get(sp.id)?.output,
                        }));
                    });
                    break;
                default:
                    break;
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        },
        [isDebugMode],
    );

    useEffect(() => {
        let reconnectTimeout: NodeJS.Timeout;
        let socket: WebSocketType;

        const connect = (): void => {
            socket = new WebSocket(serverUrl);
            setWs(socket);

            socket.on('open', () => setIsConnected(true));
            socket.on('message', handleMessage);
            socket.on('close', () => {
                setIsConnected(false);
                clearTimeout(reconnectTimeout);
                reconnectTimeout = setTimeout(connect, 3000);
            });
            socket.on('error', () => socket.close());
        };

        connect();

        return () => {
            clearTimeout(reconnectTimeout);
            if (socket) {
                socket.removeListener('message', handleMessage);
                socket.close();
            }
        };
    }, [serverUrl, handleMessage]);

    useEffect(() => {
        if (selectedProcessId && selectedProcess && selectedProcess.output === undefined) {
            sendMessage({
                action: 'client.request_output',
                requestId: Date.now().toString(),
                processId: selectedProcessId,
            });
        }
    }, [selectedProcessId, sendMessage, selectedProcess]);

    useInput((input, key) => {
        if (isInputting) return;

        if (isDebugMode && key.ctrl && input === 'o') {
            setIsDebugVisible((prev) => !prev);
            return;
        }

        if (viewMode === 'live_output') {
            if (key.escape) {
                setViewMode('dashboard');
            }
            return;
        }

        if (input === 'q') exit();
        if (input === 'n') setIsInputting(true);

        if (key.return && selectedProcessId) {
            setViewMode('live_output');
        }

        if (key.upArrow) {
            const currentIndex = processes.findIndex(
                (p) => p.id === selectedProcessId,
            );
            if (currentIndex > 0) {
                setSelectedProcessId(processes[currentIndex - 1].id);
            }
        }
        if (key.downArrow) {
            const currentIndex = processes.findIndex(
                (p) => p.id === selectedProcessId,
            );
            if (currentIndex < processes.length - 1) {
                setSelectedProcessId(processes[currentIndex + 1].id);
            }
        }
        if (input === 's' && selectedProcessId) {
            sendMessage({
                action: 'client.stop_process',
                requestId: Date.now().toString(),
                processId: selectedProcessId,
            });
        }
        if (input === 'c' && selectedProcessId) {
            sendMessage({
                action: 'client.clear_process',
                requestId: Date.now().toString(),
                processId: selectedProcessId,
            });
        }
    });

    const handleNewProcess = (command: string): void => {
        sendMessage({
            action: 'client.start_process',
            requestId: Date.now().toString(),
            command,
        });
        setIsInputting(false);
    };

    if (viewMode === 'live_output' && selectedProcess) {
        return (
            <LiveOutputView
                process={selectedProcess}
                terminalHeight={terminalHeight}
            />
        );
    }

    return (
        <Box
            flexDirection="column"
            padding={1}
            width="100%"
            height={terminalHeight}
        >
            <Box flexGrow={1} flexDirection={isWide ? 'row' : 'column'}>
                {isWide ? (
                    <>
                        <Box flexDirection="column" width="50%" paddingRight={1}>
                            <StatusPanel
                                isConnected={isConnected}
                                serverVersion={serverVersion}
                                processCount={processes.length}
                                port={serverPort}
                                pid={serverPid}
                                uptime={serverUptime}
                                processCounts={processCounts}
                            />
                            <Box marginTop={1} flexGrow={1}>
                                <ProcessList
                                    processes={processes}
                                    selectedProcessId={selectedProcessId}
                                />
                            </Box>
                        </Box>
                        <Box flexDirection="column" width="50%">
                            <ProcessDetail process={selectedProcess} />
                            <Box marginTop={1} flexGrow={1}>
                                <ProcessOutput process={selectedProcess} />
                            </Box>
                        </Box>
                    </>
                ) : (
                    <>
                        <StatusPanel
                            isConnected={isConnected}
                            serverVersion={serverVersion}
                            processCount={processes.length}
                            port={serverPort}
                            pid={serverPid}
                            uptime={serverUptime}
                            processCounts={processCounts}
                        />
                        <Box marginTop={1}>
                            <ProcessDetail process={selectedProcess} />
                        </Box>
                        <Box marginTop={1}>
                            <ProcessList
                                processes={processes}
                                selectedProcessId={selectedProcessId}
                            />
                        </Box>
                        <Box marginTop={1} flexGrow={1}>
                            <ProcessOutput process={selectedProcess} />
                        </Box>
                    </>
                )}
            </Box>

            {isDebugMode && isDebugVisible && <DebugLog log={debugLog} />}

            {isInputting ? (
                <InputBar
                    onSubmit={handleNewProcess}
                    onCancel={() => setIsInputting(false)}
                />
            ) : (
                <HelpBar />
            )}
        </Box>
    );
};

export default App;
