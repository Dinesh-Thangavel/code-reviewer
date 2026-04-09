/**
 * YAML Configuration Hook
 * Manages repository YAML configuration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ReviewConfig {
  version?: string;
  strictness?: 'RELAXED' | 'BALANCED' | 'STRICT';
  autoReview?: boolean;
  languages?: string[];
  ignorePaths?: string[];
  rules?: {
    critical?: { enabled?: boolean; customRules?: string[] };
    security?: { enabled?: boolean; customRules?: string[] };
    performance?: { enabled?: boolean; customRules?: string[] };
    quality?: { enabled?: boolean; customRules?: string[] };
    style?: { enabled?: boolean; customRules?: string[] };
  };
  review?: {
    triggers?: string[];
    maxFiles?: number;
    maxFileSize?: number;
  };
  fixes?: {
    autoApply?: boolean;
    requireApproval?: boolean;
    createPR?: boolean;
  };
  tests?: {
    generate?: boolean;
    coverageThreshold?: number;
  };
  documentation?: {
    generate?: boolean;
    format?: 'jsdoc' | 'tsdoc' | 'python';
  };
}

export const useRepositoryConfig = (repositoryId: string | undefined) => {
  return useQuery<{ config: ReviewConfig; yamlConfig: string; hasYaml: boolean }, Error>({
    queryKey: ['repository-config', repositoryId],
    queryFn: async () => {
      if (!repositoryId) throw new Error('Repository ID is required');
      const { data } = await api.get(`/repositories/${repositoryId}/config`);
      return data;
    },
    enabled: !!repositoryId,
  });
};

export const useUpdateYamlConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ repositoryId, yamlContent }: { repositoryId: string; yamlContent: string }) => {
      const { data } = await api.put(`/repositories/${repositoryId}/config/yaml`, { yamlContent });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['repository-config', variables.repositoryId] });
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
};

export const useDefaultYaml = () => {
  return useQuery<{ yaml: string }, Error>({
    queryKey: ['default-yaml'],
    queryFn: async () => {
      const { data } = await api.get('/repositories/config/yaml/default');
      return data;
    },
  });
};
