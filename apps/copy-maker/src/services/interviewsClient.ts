import type { DemosListResponse, InterviewDetail, InterviewsListResponse } from '../types/interviews'

export async function fetchInterviewsList(): Promise<InterviewsListResponse> {
  const res = await fetch('/api/interviews')
  if (!res.ok) throw new Error(`Interviews list failed (${res.status})`)
  return res.json() as Promise<InterviewsListResponse>
}

export async function fetchDemosList(): Promise<DemosListResponse> {
  const res = await fetch('/api/demos')
  if (!res.ok) throw new Error(`Demos list failed (${res.status})`)
  return res.json() as Promise<DemosListResponse>
}

export async function fetchInterviewDetail(stem: string): Promise<InterviewDetail> {
  const res = await fetch(`/api/interviews/${encodeURIComponent(stem)}`)
  if (!res.ok) throw new Error(`Interview not found (${res.status})`)
  return res.json() as Promise<InterviewDetail>
}

export function interviewExportUrl(stem: string): string {
  return `/api/interviews/${encodeURIComponent(stem)}/export.md`
}
