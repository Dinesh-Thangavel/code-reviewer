/**
 * Test Generator Hook
 * Generates unit tests for code
 */

import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';

export interface TestGenerationOptions {
  code: string;
  language: string;
  framework?: string;
  existingTests?: string;
  functionName?: string;
}

export interface CoverageAnalysis {
  coverage: number;
  missingTests: string[];
  suggestions: string[];
}

export const useGenerateTests = () => {
  return useMutation({
    mutationFn: async (options: TestGenerationOptions) => {
      const { data } = await api.post('/tests/generate', options);
      return data;
    },
  });
};

export const useAnalyzeCoverage = () => {
  return useMutation({
    mutationFn: async ({ code, tests, language }: { code: string; tests: string; language: string }) => {
      const { data } = await api.post('/tests/analyze-coverage', { code, tests, language });
      return data;
    },
  });
};
