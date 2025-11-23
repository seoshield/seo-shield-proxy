/**
 * Type definitions for puppeteer-cluster
 * Since @types/puppeteer-cluster is not available, these are basic types
 * based on the library's documentation and usage in our codebase
 */

import type { Browser, Page, LaunchOptions } from 'puppeteer';

export interface ClusterOptions<TaskData, TaskResult> {
  concurrency?: number;
  maxConcurrency?: number;
  timeout?: number;
  retryLimit?: number;
  retryDelay?: number;
  puppeteerOptions?: LaunchOptions;
  monitor?: boolean;
  workerCreationDelay?: number;
  skipDuplicateUrls?: boolean;
 _DUPLICATE_URLS_TO_SKIP?: Set<string>;
  puppeteer?: typeof import('puppeteer');
  perInstanceOptions?: LaunchOptions;
  concurrencyContext?: any;
  childProcessOptions?: any;
  puppeteerEndpoint?: any;
  concurrency?: number;
  closeBrowserAfterUse?: boolean;
}

export interface Task<TaskData, TaskResult> {
  page: Page;
  data: TaskData;
  browser: Browser;
  worker: {
    id: number;
  };
}

export type ClusterTaskFunction<TaskData, TaskResult> = (task: Task<TaskData, TaskResult>) => Promise<TaskResult>;

export interface Cluster<TaskData, TaskResult> {
  task: (taskFunction: ClusterTaskFunction<TaskData, TaskResult>) => Promise<void>;
  execute: (data: TaskData) => Promise<TaskResult>;
  idle: () => Promise<void>;
  close: () => Promise<void>;
  queueSize: number;
  browserPoolSize: number;
  jobSize: number;
  workersReady: number;
  allWorkersReady: boolean;
  on: (event: string, listener: Function) => void;
  removeListener: (event: string, listener: Function) => void;
  hasWorkers: boolean;
}

export declare class ClusterClass {
  static launch<TaskData, TaskResult>(options: ClusterOptions<TaskData, TaskResult>): Promise<Cluster<TaskData, TaskResult>>;

  static CONCURRENCY_BROWSER: number;
  static CONCURRENCY_CONTEXT: number;
  static CONCURRENCY_PAGE: number;
}

export declare function Cluster<TaskData, TaskResult>(options?: ClusterOptions<TaskData, TaskResult>): Cluster<TaskData, TaskResult>;

export default ClusterClass;