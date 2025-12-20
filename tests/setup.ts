import { expect, afterEach } from 'vitest';

// optional: cleanup-Helper von React Testing Library
import { cleanup } from '@testing-library/react';

// import matchers
import '@testing-library/jest-dom/vitest';

// oder manuell
// import * as matchers from '@testing-library/jest-dom/matchers';
// expect.extend(matchers);

afterEach(() => {
  cleanup();
});