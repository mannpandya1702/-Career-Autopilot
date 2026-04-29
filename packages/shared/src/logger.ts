import pino from 'pino';

// Every log line gets these fields by default. Workers override base with workerId/jobId/stage.
export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  base: {
    service: process.env['WORKER_ID'] ?? 'app',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
