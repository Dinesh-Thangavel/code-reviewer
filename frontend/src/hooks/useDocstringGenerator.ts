/**
 * Docstring Generator Hook
 * Generates documentation for code
 */

import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';

export type DocstringFormat = 'jsdoc' | 'tsdoc' | 'python' | 'java' | 'go' | 'rust';

export interface DocstringOptions {
  code: string;
  language: string;
  format: DocstringFormat;
  functionName?: string;
  className?: string;
}

export const useGenerateDocstring = () => {
  return useMutation({
    mutationFn: async (options: DocstringOptions) => {
      const { data } = await api.post('/docstrings/generate', options);
      return data;
    },
  });
};

export const useGenerateFileDocstrings = () => {
  return useMutation({
    mutationFn: async ({ fileContent, language, format }: { fileContent: string; language: string; format: DocstringFormat }) => {
      const { data } = await api.post('/docstrings/generate-file', { fileContent, language, format });
      return data;
    },
  });
};
