import { WebSocket, WebSocketServer as Server, RawData } from 'ws';
import { ProcessManager, ProcessManagerEvents } from './ProcessManager.js';
import { ClientMessage, ClientMessageSchema, ServerMessage, ProcessState } from '../types/index.js';
import stripAnsi from 'strip-ansi';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const OUTPUT_BATCH_INTERVAL_MS = 50;

export class WebSocketServer {
  private wss: Server;
  private processManager: ProcessManager;
  private outputBuffers: Map<string, string> = new Map();
  private packageVersion = 'unknown';

  constructor(port: number) {
    this.wss = new Server({ port });
    
    const events: ProcessManagerEvents = {
      onProcessStarted: (process: ProcessState) => {
        this.broadcast({ action: 'server.process_started', process });
      },
      onProcessOutput: (processId: string, data: string) => {
        const buffer = this.outputBuffers.get(processId) || '';
        this.outputBuffers.set(processId, buffer + data);
      },
      onProcessStopped: (processId: string, exitCode: number | null, signal: string | null) => {
        this.flushOutputBuffer(processId);
        this.outputBuffers.delete(processId);
        const finalProcessState = this.processManager.getProcess(processId);
        if (finalProcessState) {
          this.broadcast({ action: 'server.process_stopped', process: finalProcessState });
        }
      },
    };
    
    this.processManager = new ProcessManager(events);
    this.setupConnectionHandler();
    this._loadPackageVersion();
    setInterval(() => this.flushAllOutputBuffers(), OUTPUT_BATCH_INTERVAL_MS);
  }

  private async _loadPackageVersion() {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      this.packageVersion = packageJson.version || 'unknown';
    } catch (error) {
      // Gracefully fail, version will remain 'unknown'
      console.error('Could not read package.json for version:', error);
    }
  }

  private setupConnectionHandler(): void {
    this.wss.on('connection', (ws) => {
      this.sendFullState(ws);

      ws.on('message', (message) => {
        this.handleMessage(ws, message);
      });
    });
  }

  private handleMessage(ws: WebSocket, message: RawData): void {
    try {
      const rawMessage = JSON.parse(message.toString());
      const parsedMessage = ClientMessageSchema.parse(rawMessage);

      const sendResponse = (success: boolean, error?: string, data?: any) => {
        const response: ServerMessage = {
          action: 'server.request_response',
          requestId: parsedMessage.requestId,
          success,
          error,
          data,
        };
        ws.send(JSON.stringify(response));
      };

      switch (parsedMessage.action) {
        case 'client.start_process':
          try {
            const processState = this.processManager.startProcess(parsedMessage.command);
            sendResponse(true, undefined, processState);
          } catch (e) {
            sendResponse(false, (e as Error).message);
          }
          break;
        case 'client.stop_process':
          try {
            this.processManager.stopProcess(parsedMessage.processId);
            sendResponse(true);
          } catch (e) {
            sendResponse(false, (e as Error).message);
          }
          break;
        case 'client.clear_process':
            try {
                this.processManager.clearProcess(parsedMessage.processId);
                sendResponse(true);
                this.broadcast({ action: 'server.process_cleared', processId: parsedMessage.processId });
            } catch (e) {
                sendResponse(false, (e as Error).message);
            }
            break;
        case 'client.request_output':
            const output = this.processManager.getProcessOutput(parsedMessage.processId, {
                head: parsedMessage.head,
                tail: parsedMessage.tail,
            });
            if (output) {
                const response: ServerMessage = {
                    action: 'server.output_response',
                    requestId: parsedMessage.requestId,
                    processId: parsedMessage.processId,
                    output: output,
                };
                ws.send(JSON.stringify(response));
            }
            break;
        case 'client.request_status':
            const statusResponse: ServerMessage = {
                action: 'server.status_response',
                requestId: parsedMessage.requestId,
                version: this.packageVersion,
                port: this.wss.options.port || 0,
                pid: process.pid,
                uptime: process.uptime(),
                processCounts: this.processManager.getProcessCounts(),
            };
            ws.send(JSON.stringify(statusResponse));
            break;
        case 'client.list_processes':
            const processes = this.processManager.getAllProcesses();
            const response: ServerMessage = {
                action: 'server.list_processes_response',
                requestId: parsedMessage.requestId,
                processes,
            };
            ws.send(JSON.stringify(response));
            break;
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  }

  private sendFullState(ws: WebSocket): void {
    const processes = this.processManager.getAllProcesses();
    const message: ServerMessage = {
      action: 'server.full_state',
      processes,
    };
    ws.send(JSON.stringify(message));
  }

  private flushOutputBuffer(processId: string) {
    const rawOutput = this.outputBuffers.get(processId);
    if (rawOutput) {
      const cleanOutput = stripAnsi(rawOutput);
      this.broadcast({
        action: 'server.process_output',
        processId,
        rawOutput,
        cleanOutput,
      });
      this.outputBuffers.set(processId, '');
    }
  }

  private flushAllOutputBuffers() {
    for (const processId of this.outputBuffers.keys()) {
      this.flushOutputBuffer(processId);
    }
  }

  public broadcast(message: ServerMessage): void {
    const serializedMessage = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1 /* WebSocket.OPEN */) {
        client.send(serializedMessage);
      }
    });
  }
}
