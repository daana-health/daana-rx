// Jest setup file for global test configuration

// Mock fetch globally for Node.js environment
global.fetch = jest.fn();

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

