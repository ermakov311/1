'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet } from '@api'

export type Assignment = {
	id: number
	title: string
	created_by: number
	created_by_name: string
	deadline?: string | null
	created_at: string
}

export type StudentAssignment = {
	id: number
	student_id: number
	assignment_id: number
	is_completed: boolean
	assignment_title: string
	assignment_deadline: string | null
	created_by_name: string
	completed_at: string | null
}

export function useTeacherAssignments(teacherId?: number) {
	return useQuery({
		queryKey: ['assignments', { created_by: teacherId }],
		queryFn: () =>
			apiGet<{ success: boolean; assignments: Assignment[] }>(
				`/api/assignments?created_by=${teacherId}`
			),
		enabled: !!teacherId,
		staleTime: 60_000,
		select: (r) => r.assignments ?? [],
	})
}

export function useStudentAssignments(studentId?: number) {
	return useQuery({
		queryKey: ['student-assignments', { studentId }],
		queryFn: () =>
			apiGet<{ success: boolean; assignments: StudentAssignment[] }>(
				`/api/students/${studentId}/assignments`
			),
		enabled: !!studentId,
		staleTime: 60_000,
		select: (r) => r.assignments ?? [],
	})
}

export function useDeleteAssignment(teacherId?: number) {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (assignmentId: number) =>
			apiDelete<{ success: boolean }>(`/api/assignments/${assignmentId}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['assignments', { created_by: teacherId }] })
		},
	})
}




