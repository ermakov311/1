import { useCallback } from 'react';
import { apiGet, apiPost, apiPut } from '@api';

type AssignmentResponse = {
  success?: boolean;
  error?: string;
  assignment?: { id?: number; description?: string };
};

export function useAssignmentDescription() {
  return useCallback(async (assignmentId: string): Promise<string> => {
    const data = await apiGet<AssignmentResponse>(`/api/assignments/${assignmentId}`);
    const desc = data?.assignment?.description;
    return typeof desc === 'string' ? desc : '';
  }, []);
}

export function useUpdateAssignment() {
  return useCallback(async (assignmentId: string, payload: Record<string, unknown>): Promise<AssignmentResponse> => {
    return await apiPut<AssignmentResponse>(`/api/assignments/${assignmentId}`, payload);
  }, []);
}

export function useCreateAssignment() {
  return useCallback(async (payload: Record<string, unknown>): Promise<AssignmentResponse> => {
    return await apiPost<AssignmentResponse>(`/api/assignments`, payload);
  }, []);
}

export function useVerifyAssignment() {
  return useCallback(async (assignmentId: string, logs: Array<Record<string, unknown>>): Promise<{ ok?: boolean; message?: string }> => {
    try {
      const primary = await apiPost<{ ok?: boolean; message?: string }>(`/api/assignments/${assignmentId}/verify`, { logs });
      if (primary?.ok !== undefined) return primary;
    } catch (e) {
    }
    return await apiPost<{ ok?: boolean; message?: string }>(`/api/assignments/verify?id=${assignmentId}`, { logs });
  }, []);
}

export function useSchemaVisibility() {
  return true;
}










