import { expect, afterEach, vi } from 'vitest';

// optional: cleanup-Helper von React Testing Library
import { cleanup } from '@testing-library/react';

// import matchers
import '@testing-library/jest-dom/vitest';

// oder manuell
// import * as matchers from '@testing-library/jest-dom/matchers';
// expect.extend(matchers);

// Mock ResizeObserver for Recharts
// Recharts requires ResizeObserver which is not available in jsdom
global.ResizeObserver = class {
  observe() {
    // Mock implementation
  }
  unobserve() {
    // Mock implementation
  }
  disconnect() {
    // Mock implementation
  }
} as any;

afterEach(() => {
  cleanup();
});