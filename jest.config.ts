import type { Config } from 'jest';

export default async (): Promise<Config> => {
  return {
    preset: 'ts-jest',
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    transform: {
      '^.+\\.(t|j)sx?$': '@swc/jest'
    },
    moduleNameMapper: {
      '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    testEnvironment: 'node',
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    collectCoverage: true,
    verbose: true
  };
};
