/**
 * Notifications Hook
 * Manages in-app notifications
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  readAt?: string;
}

export const useNotifications = (options?: { unreadOnly?: boolean }) => {
  return useQuery<{ notifications: Notification[] }, Error>({
    queryKey: ['notifications', options?.unreadOnly],
    queryFn: async () => {
      const { data } = await api.get('/notifications', {
        params: { unreadOnly: options?.unreadOnly },
      });
      return data;
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
};

export const useUnreadCount = () => {
  return useQuery<{ count: number }, Error>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread-count');
      return data;
    },
    refetchInterval: 30000,
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data } = await api.put(`/notifications/${notificationId}/read`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.put('/notifications/read-all');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};
