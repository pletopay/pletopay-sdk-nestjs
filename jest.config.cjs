/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json', isolatedModules: false }] },
  moduleNameMapper: { '^@pletopay/nestjs$': '<rootDir>/src/index.ts' },
  setupFiles: ['reflect-metadata'],
  testTimeout: 15000,
};
