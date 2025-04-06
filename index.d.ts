declare module 'easy-mock-server' {
  /**
   * Configuration for a mock server route
   */
  export interface RouteConfig {
    /** HTTP method (GET, POST, PUT, DELETE, etc.) */
    method: string;
    /** Route path, can include Express-style parameters (e.g., /users/:id) */
    path: string;
    /** Response object or array that will be returned for this route */
    response?: any;
    /** Optional delay in milliseconds before sending the response */
    delay?: number;
    /** Optional HTTP status code to return instead of 200 */
    errorCode?: number;
    /** Optional error message when using errorCode */
    errorMessage?: string;
    /** Custom headers to return with the response */
    headers?: Record<string, string>;
    /** Conditions that must be met for this route to be matched */
    conditions?: {
      /** Query parameters that must match */
      query?: Record<string, string>;
      /** Request headers that must match */
      headers?: Record<string, string>;
      /** Request body fields that must match */
      body?: Record<string, any>;
    };
    /** Response to use if conditions are not met */
    fallback?: any;
  }

  /**
   * Global configuration options
   */
  export interface GlobalConfig {
    /** Headers to include in all responses */
    headers?: Record<string, string>;
  }

  /**
   * Configuration for the mock server
   */
  export interface MockServerConfig {
    /** Array of route configurations */
    routes: RouteConfig[];
    /** Global configuration options */
    globals?: GlobalConfig;
  }

  /**
   * Mock server instance
   */
  export interface MockServer {
    /**
     * Start the mock server
     * @param port - Port to listen on, defaults to 3000
     * @returns Promise that resolves when server has started
     */
    start(port?: number): Promise<void>;

    /**
     * Stop the mock server and release all resources
     * @returns Promise that resolves when server has stopped
     */
    stop(): Promise<void>;
  }

  /**
   * Create a new mock server instance
   * @param configPath - Path to the JSON configuration file
   * @returns Mock server instance
   */
  export default function createMockServer(configPath: string): MockServer;
} 