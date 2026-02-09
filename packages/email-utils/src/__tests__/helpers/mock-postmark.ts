/**
 * Mock Postmark Client
 * 
 * Provides a mock implementation of the Postmark ServerClient for testing
 */

export interface MockPostmarkResponse {
  MessageID: string;
  To: string;
  SubmittedAt: string;
  ErrorCode: number;
  Message: string;
}

export class MockPostmarkClient {
  private calls: Array<{
    method: string;
    params: unknown;
  }> = [];
  
  private shouldFail = false;
  private failureError: Error | null = null;
  
  /**
   * Mock sendEmailWithTemplate method
   */
  async sendEmailWithTemplate(params: {
    From: string;
    To: string;
    TemplateAlias: string;
    TemplateModel: Record<string, unknown>;
    ReplyTo?: string;
    MessageStream?: string;
    Metadata?: Record<string, unknown>;
  }): Promise<MockPostmarkResponse> {
    this.calls.push({
      method: 'sendEmailWithTemplate',
      params,
    });
    
    if (this.shouldFail) {
      throw this.failureError || new Error('Mock Postmark error');
    }
    
    return {
      MessageID: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      To: params.To,
      SubmittedAt: new Date().toISOString(),
      ErrorCode: 0,
      Message: 'OK',
    };
  }
  
  /**
   * Mock getServer method (for connection testing)
   */
  async getServer(): Promise<{ ID: number; Name: string }> {
    this.calls.push({
      method: 'getServer',
      params: {},
    });
    
    if (this.shouldFail) {
      throw this.failureError || new Error('Mock Postmark connection error');
    }
    
    return {
      ID: 12345,
      Name: 'Mock Server',
    };
  }
  
  /**
   * Get all method calls
   */
  getCalls() {
    return this.calls;
  }
  
  /**
   * Get calls to a specific method
   */
  getCallsTo(method: string) {
    return this.calls.filter(call => call.method === method);
  }
  
  /**
   * Check if a method was called
   */
  wasMethodCalled(method: string): boolean {
    return this.calls.some(call => call.method === method);
  }
  
  /**
   * Make the next call fail
   */
  setFailure(error?: Error) {
    this.shouldFail = true;
    this.failureError = error || null;
  }
  
  /**
   * Clear failure state
   */
  clearFailure() {
    this.shouldFail = false;
    this.failureError = null;
  }
  
  /**
   * Reset all state
   */
  reset() {
    this.calls = [];
    this.shouldFail = false;
    this.failureError = null;
  }
}

export const mockPostmarkClient = new MockPostmarkClient();
