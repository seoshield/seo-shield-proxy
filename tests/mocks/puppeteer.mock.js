/**
 * Puppeteer Mock for Testing
 * Simulates Puppeteer browser and page objects
 */

import { jest } from '@jest/globals';

export const createMockPage = (overrides = {}) => {
  const requests = [];

  return {
    setViewport: jest.fn().mockResolvedValue(undefined),
    setUserAgent: jest.fn().mockResolvedValue(undefined),
    setRequestInterception: jest.fn().mockResolvedValue(undefined),
    on: jest.fn((event, handler) => {
      if (event === 'request' && overrides.mockRequests) {
        // Simulate requests
        overrides.mockRequests.forEach((req) => handler(req));
      }
    }),
    goto: jest.fn().mockResolvedValue(undefined),
    content: jest.fn().mockResolvedValue(overrides.html || '<html><body>Mock Page</body></html>'),
    evaluate: jest.fn().mockResolvedValue(overrides.evaluateResult || undefined),
    close: jest.fn().mockResolvedValue(undefined),
    isClosed: jest.fn().mockReturnValue(false),
    ...overrides,
  };
};

export const createMockBrowser = (overrides = {}) => {
  return {
    newPage: jest.fn().mockResolvedValue(createMockPage(overrides.pageOverrides)),
    isConnected: jest.fn().mockReturnValue(true),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    ...overrides,
  };
};

export const createMockRequest = (resourceType = 'document') => {
  return {
    resourceType: jest.fn().mockReturnValue(resourceType),
    abort: jest.fn(),
    continue: jest.fn(),
  };
};

export default {
  launch: jest.fn().mockResolvedValue(createMockBrowser()),
};
