import { z } from 'zod';

// ======== Process State ========

export const ProcessStateSchema = z.object({
    id: z.string().uuid(),
    command: z.string(),
    pid: z.number().optional(),
    status: z.enum(['running', 'stopped', 'error']),
    uptime: z.number().optional(),
    exitCode: z.number().nullable().optional(),
});

export type ProcessState = z.infer<typeof ProcessStateSchema>;

export const ProcessInfoSchema = ProcessStateSchema.extend({
    output: z.string().optional(),
});

export type ProcessInfo = z.infer<typeof ProcessInfoSchema>;

// ======== WebSocket Message Types ========

export const OutputChunkSchema = z.object({
    type: z.enum(['stdout', 'stderr']),
    data: z.string(),
    timestamp: z.number(),
});

export type OutputChunk = z.infer<typeof OutputChunkSchema>;

// ======== Client to Server Messages ========

export const ClientMessageSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('client.start_process'),
        requestId: z.string(),
        command: z.string(),
    }),
    z.object({
        action: z.literal('client.stop_process'),
        requestId: z.string(),
        processId: z.string().uuid(),
    }),
    z.object({
        action: z.literal('client.clear_process'),
        requestId: z.string(),
        processId: z.string().uuid(),
    }),
    z.object({
        action: z.literal('client.request_output'),
        requestId: z.string(),
        processId: z.string().uuid(),
        head: z.number().optional(),
        tail: z.number().optional(),
    }),
    z.object({
        action: z.literal('client.request_status'),
        requestId: z.string(),
    }),
    z.object({
        action: z.literal('client.list_processes'),
        requestId: z.string(),
    }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ======== Server to Client Messages ========

export const ServerMessageSchema = z.discriminatedUnion('action', [
    // Direct response to a client's request
    z.object({
        action: z.literal('server.request_response'),
        requestId: z.string(),
        success: z.boolean(),
        error: z.string().optional(),
        data: z.any().optional(),
    }),
    // Broadcast message for initial state sync
    z.object({
        action: z.literal('server.full_state'),
        processes: z.array(ProcessStateSchema),
    }),
    // Broadcast message when a process is started
    z.object({
        action: z.literal('server.process_started'),
        process: ProcessStateSchema,
    }),
    // Broadcast message for process output
    z.object({
        action: z.literal('server.process_output'),
        processId: z.string().uuid(),
        rawOutput: z.string(), // For TUI (with ANSI codes)
        cleanOutput: z.string(), // For MCP (stripped of ANSI codes)
    }),
    // Broadcast message when a process stops
    z.object({
        action: z.literal('server.process_stopped'),
        process: ProcessStateSchema,
    }),
    // Broadcast message when a process is cleared
    z.object({
        action: z.literal('server.process_cleared'),
        processId: z.string().uuid(),
    }),
    // Response to an output request
    z.object({
        action: z.literal('server.output_response'),
        requestId: z.string(),
        processId: z.string().uuid(),
        output: z.array(z.string()),
    }),
    // Response to a status request
    z.object({
        action: z.literal('server.status_response'),
        requestId: z.string(),
        version: z.string(),
        port: z.number(),
        pid: z.number(),
        uptime: z.number(),
        processCounts: z.object({
            total: z.number(),
            running: z.number(),
            stopped: z.number(),
            errored: z.number(),
        }),
    }),
    // Response to a list_processes request
    z.object({
        action: z.literal('server.list_processes_response'),
        requestId: z.string(),
        processes: z.array(ProcessStateSchema),
    }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
