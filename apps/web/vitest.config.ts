import { defineConfig } from 'vitest/config';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30000, // 30 seconds for property-based tests with database operations
    fileParallelism: false, // Run test files sequentially to avoid database conflicts
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@fuelfuse/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
