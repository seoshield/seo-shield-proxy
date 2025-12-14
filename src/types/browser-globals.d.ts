/**
 * Browser Globals Type Declarations
 * Type definitions for custom global properties used in page.evaluate() contexts
 */

import { Server as SocketIOServer } from 'socket.io';

/**
 * Console log entry captured in browser context
 */
interface SEOShieldConsoleLog {
  timestamp: number;
  level: string;
  text: string;
  url?: string;
  line?: number;
  column?: number;
}

/**
 * Failed request entry captured in browser context
 */
interface SEOShieldFailedRequest {
  url: string;
  error: string;
  timestamp: number;
}

/**
 * Intersection observer entry for virtual scroll
 */
interface SEOShieldIntersectionObserver {
  disconnect: () => void;
}

/**
 * Extend globalThis for browser context
 */
declare global {
  interface Window {
    __seoShieldConsoleLogs?: SEOShieldConsoleLog[];
    __seoShieldFailedRequests?: SEOShieldFailedRequest[];
    __intersectionObservers?: SEOShieldIntersectionObserver[];
  }

  // For Node.js global context (Socket.io)
   
  var io: SocketIOServer | undefined;
}

export {};
