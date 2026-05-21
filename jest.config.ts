import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  modulePathIgnorePatterns: [
    '<rootDir>/.claude/worktrees/',
  ],
  projects: [
    // Server-side: API routes, lib utilities, middleware
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: [
        '**/__tests__/api/**/*.test.ts',
        '**/__tests__/lib/**/*.test.ts',
        '**/__tests__/middleware.test.ts',
      ],
      transform: {
        '^.+\\.(t|j)sx?$': ['ts-jest', {
          tsconfig: { jsx: 'react', esModuleInterop: true },
          useESM: false,
        }],
      },
      // Allow jose (ESM) to be handled by the module resolver
      transformIgnorePatterns: [
        '/node_modules/(?!(jose)/)',
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        // Map jose to a CJS-compatible path for tests
        '^jose$': '<rootDir>/__mocks__/jose.ts',
      },
    },
    // Client-side: React hooks and components
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: [
        '**/__tests__/hooks/**/*.test.tsx',
        '**/__tests__/components/**/*.test.tsx',
      ],
      transform: {
        '^.+\\.(t|j)sx?$': ['ts-jest', {
          tsconfig: { jsx: 'react-jsx', esModuleInterop: true },
        }],
      },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
  ],
}

export default createJestConfig(config)
