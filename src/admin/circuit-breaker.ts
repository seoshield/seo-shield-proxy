import { SeoProtocolConfig } from '../config';

/**
 * Circuit breaker state
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  enabled: boolean;
  errorThreshold: number; // Percentage (0-100)
  resetTimeout: number; // Milliseconds
  monitoringPeriod: number; // Milliseconds
  fallbackToStale: boolean;
  halfOpenMaxCalls: number;
  failureThreshold: number; // Number of consecutive failures
  successThreshold: number; // Number of successes to close circuit
  timeoutThreshold: number; // Milliseconds
}

/**
 * Circuit state and metrics
 */
export interface CircuitStateInfo {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  totalRequests: number;
  failureRate: number;
  successRate: number;
  stateChangedAt: Date;
  nextRetryAt: Date | null;
}

/**
 * Circuit breaker execution result
 */
export interface CircuitBreakerResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  circuitState: CircuitState;
  fallbackUsed: boolean;
  executionTime: number;
  metrics: {
    totalFailures: number;
    totalSuccesses: number;
    currentFailureRate: number;
  };
}

/**
 * Circuit Breaker for failure protection
 *
 * Enterprise-grade failure protection with intelligent circuit breaking
 * and fallback mechanisms to ensure system reliability.
 */
export class CircuitBreaker<T = any> {
  private config: CircuitBreakerConfig;
  private state: CircuitStateInfo;
  private halfOpenCalls = 0;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.state = this.initializeState();
  }

  /**
   * Initialize circuit state
   */
  private initializeState(): CircuitStateInfo {
    return {
      state: 'CLOSED',
      failures: 0,
      successes: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      totalRequests: 0,
      failureRate: 0,
      successRate: 0,
      stateChangedAt: new Date(),
      nextRetryAt: null,
    };
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<CircuitBreakerResult<T>> {
    const startTime = Date.now();

    try {
      // Check if circuit is open and should attempt reset
      if (this.state.state === 'OPEN') {
        if (this.shouldAttemptReset()) {
          this.transitionToHalfOpen();
        } else {
          return await this.executeFallback(fallback, startTime);
        }
      }

      // Check if we've exceeded half-open call limit
      if (this.state.state === 'HALF_OPEN' && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        return await this.executeFallback(fallback, startTime);
      }

      // Execute the operation
      const result = await this.executeWithTimeout(operation);
      const executionTime = Date.now() - startTime;

      // Record success
      this.recordSuccess();

      // Check if we should close the circuit from half-open
      if (this.state.state === 'HALF_OPEN' && this.state.successes >= this.config.successThreshold) {
        this.transitionToClosed();
      }

      return {
        success: true,
        result,
        circuitState: this.state.state,
        fallbackUsed: false,
        executionTime,
        metrics: this.getMetrics(),
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Record failure
      this.recordFailure(error as Error);

      // Check if we should open the circuit
      if (this.shouldOpenCircuit()) {
        this.transitionToOpen();
      }

      // If fallback is provided, use it
      if (fallback) {
        return await this.executeFallback(fallback, startTime);
      }

      return {
        success: false,
        error: error as Error,
        circuitState: this.state.state,
        fallbackUsed: false,
        executionTime,
        metrics: this.getMetrics(),
      };
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.config.timeoutThreshold}ms`));
      }, this.config.timeoutThreshold);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Execute fallback if available
   */
  private async executeFallback(
    fallback?: () => Promise<T>,
    startTime?: number
  ): Promise<CircuitBreakerResult<T>> {
    const executionTime = startTime ? Date.now() - startTime : 0;

    if (fallback && this.config.fallbackToStale) {
      try {
        const fallbackResult = await fallback();
        return {
          success: true,
          result: fallbackResult,
          circuitState: this.state.state,
          fallbackUsed: true,
          executionTime,
          metrics: this.getMetrics(),
        };
      } catch (fallbackError) {
        return {
          success: false,
          error: new Error(`Both operation and fallback failed: ${(fallbackError as Error).message}`),
          circuitState: this.state.state,
          fallbackUsed: true,
          executionTime,
          metrics: this.getMetrics(),
        };
      }
    }

    return {
      success: false,
      error: new Error(`Circuit breaker is ${this.state.state} and no fallback available`),
      circuitState: this.state.state,
      fallbackUsed: false,
      executionTime,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Record successful operation
   */
  private recordSuccess(): void {
    this.state.successes++;
    this.state.totalRequests++;
    this.state.lastSuccessTime = new Date();
    this.updateRates();

    if (this.state.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(error: Error): void {
    this.state.failures++;
    this.state.totalRequests++;
    this.state.lastFailureTime = new Date();
    this.updateRates();

    console.warn(`⚡ Circuit Breaker recorded failure: ${error.message}`);
  }

  /**
   * Update success/failure rates
   */
  private updateRates(): void {
    if (this.state.totalRequests > 0) {
      this.state.failureRate = (this.state.failures / this.state.totalRequests) * 100;
      this.state.successRate = (this.state.successes / this.state.totalRequests) * 100;
    }
  }

  /**
   * Check if circuit should be opened
   */
  private shouldOpenCircuit(): boolean {
    // Check consecutive failures
    if (this.state.failures >= this.config.failureThreshold) {
      return true;
    }

    // Check failure rate threshold
    if (this.state.totalRequests >= 10 && this.state.failureRate >= this.config.errorThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Check if should attempt reset from open state
   */
  private shouldAttemptReset(): boolean {
    if (!this.state.nextRetryAt) {
      return false;
    }

    return Date.now() >= this.state.nextRetryAt.getTime();
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(): void {
    const previousState = this.state.state;

    this.state.state = 'CLOSED';
    this.state.stateChangedAt = new Date();
    this.state.nextRetryAt = null;
    this.halfOpenCalls = 0;

    console.log(`🔓 Circuit Breaker transitioned from ${previousState} to CLOSED`);
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(): void {
    const previousState = this.state.state;

    this.state.state = 'OPEN';
    this.state.stateChangedAt = new Date();
    this.state.nextRetryAt = new Date(Date.now() + this.config.resetTimeout);
    this.halfOpenCalls = 0;

    console.log(`🔒 Circuit Breaker transitioned from ${previousState} to OPEN (retry at ${this.state.nextRetryAt.toISOString()})`);
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    const previousState = this.state.state;

    this.state.state = 'HALF_OPEN';
    this.state.stateChangedAt = new Date();
    this.halfOpenCalls = 0;

    console.log(`🔓 Circuit Breaker transitioned from ${previousState} to HALF_OPEN (testing ${this.config.halfOpenMaxCalls} calls)`);
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitStateInfo {
    return { ...this.state };
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      totalFailures: this.state.failures,
      totalSuccesses: this.state.successes,
      currentFailureRate: this.state.failureRate,
    };
  }

  /**
   * Force circuit to specific state (for testing/admin)
   */
  forceState(state: CircuitState): void {
    switch (state) {
      case 'CLOSED':
        this.transitionToClosed();
        break;
      case 'OPEN':
        this.transitionToOpen();
        break;
      case 'HALF_OPEN':
        this.transitionToHalfOpen();
        break;
    }
  }

  /**
   * Reset circuit to initial state
   */
  reset(): void {
    this.state = this.initializeState();
    this.halfOpenCalls = 0;
    console.log('🔄 Circuit Breaker reset to initial state');
  }

  /**
   * Check if circuit is allowing requests
   */
  isRequestAllowed(): boolean {
    switch (this.state.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        return this.shouldAttemptReset();
      case 'HALF_OPEN':
        return this.halfOpenCalls < this.config.halfOpenMaxCalls;
      default:
        return false;
    }
  }

  /**
   * Get time until next retry
   */
  getTimeUntilNextRetry(): number | null {
    if (this.state.state !== 'OPEN' || !this.state.nextRetryAt) {
      return null;
    }

    return Math.max(0, this.state.nextRetryAt.getTime() - Date.now());
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
  } {
    if (this.state.state === 'CLOSED') {
      if (this.state.failureRate > 50) {
        return {
          healthy: false,
          status: 'degraded',
          message: `High failure rate (${this.state.failureRate.toFixed(1)}%) but circuit is closed`,
        };
      }

      return {
        healthy: true,
        status: 'healthy',
        message: 'Circuit is closed and operating normally',
      };
    }

    if (this.state.state === 'HALF_OPEN') {
      return {
        healthy: false,
        status: 'degraded',
        message: `Circuit is half-open testing (${this.halfOpenCalls}/${this.config.halfOpenMaxCalls} calls)`,
      };
    }

    if (this.state.state === 'OPEN') {
      const timeUntilRetry = this.getTimeUntilNextRetry();
      const retryMessage = timeUntilRetry
        ? ` (retry in ${Math.round(timeUntilRetry / 1000)}s)`
        : '';

      return {
        healthy: false,
        status: 'unhealthy',
        message: `Circuit is open${retryMessage}`,
      };
    }

    return {
      healthy: false,
      status: 'unhealthy',
      message: 'Unknown circuit state',
    };
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): CircuitBreakerConfig {
    return {
      enabled: true,
      errorThreshold: 50, // 50% failure rate
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      fallbackToStale: true,
      halfOpenMaxCalls: 3,
      failureThreshold: 5, // 5 consecutive failures
      successThreshold: 2, // 2 successes to close circuit
      timeoutThreshold: 30000, // 30 seconds
    };
  }
}

/**
 * Circuit Breaker Manager for multiple circuits
 */
export class CircuitBreakerManager {
  private circuits = new Map<string, CircuitBreaker>();
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Get or create circuit breaker for a specific name
   */
  getCircuit(name: string): CircuitBreaker {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, new CircuitBreaker(this.config));
    }

    return this.circuits.get(name)!;
  }

  /**
   * Get all circuit states
   */
  getAllStates(): Record<string, CircuitStateInfo> {
    const states: Record<string, CircuitStateInfo> = {};

    for (const [name, circuit] of this.circuits.entries()) {
      states[name] = circuit.getState();
    }

    return states;
  }

  /**
   * Get health status for all circuits
   */
  getOverallHealth(): {
    healthy: boolean;
    status: 'healthy' | 'degraded' | 'unhealthy';
    circuits: Record<string, ReturnType<CircuitBreaker['getHealthStatus']>>;
  } {
    const circuitHealth: Record<string, ReturnType<CircuitBreaker['getHealthStatus']>> = {};
    let hasUnhealthy = false;
    let hasDegraded = false;

    for (const [name, circuit] of this.circuits.entries()) {
      const health = circuit.getHealthStatus();
      circuitHealth[name] = health;

      if (health.status === 'unhealthy') {
        hasUnhealthy = true;
      } else if (health.status === 'degraded') {
        hasDegraded = true;
      }
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (hasUnhealthy) {
      status = 'unhealthy';
    } else if (hasDegraded) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      healthy: status === 'healthy',
      status,
      circuits: circuitHealth,
    };
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
  }

  /**
   * Close all circuits
   */
  closeAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.forceState('CLOSED');
    }
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): CircuitBreakerConfig {
    return {
      enabled: true,
      errorThreshold: 50, // 50% failure rate
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      fallbackToStale: true,
      halfOpenMaxCalls: 3,
      failureThreshold: 5, // 5 consecutive failures
      successThreshold: 2, // 2 successes to close circuit
      timeoutThreshold: 30000, // 30 seconds
    };
  }
}