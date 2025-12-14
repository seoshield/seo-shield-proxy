import type { Request as _Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      isBot?: boolean;
    }
  }
}

export {};
