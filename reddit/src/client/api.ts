import type {
  CommentResponse,
  FinishResponse,
  HintResponse,
  RoadMode,
  RoadResponse,
  StartResponse,
  CommunityOptionId,
  ReminderResponse,
  VoteResponse,
} from '../shared/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, detail?.error ?? `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export const fetchRoad = (mode: RoadMode) => request<RoadResponse>(`/api/road?mode=${mode}`);

export const postStart = (mode: RoadMode) => request<StartResponse>('/api/start', { mode });

export const postHint = (mode: RoadMode, path: number[], guide: number[]) =>
  request<HintResponse>('/api/hint', { mode, path, guide });

export const postFinish = (mode: RoadMode, path: number[]) =>
  request<FinishResponse>('/api/finish', { mode, path });

export const postComment = (mode: RoadMode) => request<CommentResponse>('/api/comment', { mode });

export const postSubscribe = () => request<{ subscribed: boolean }>('/api/subscribe', {});

export const postVote = (option: CommunityOptionId) => request<VoteResponse>('/api/vote', { option });

export const postReminder = (body: { on: boolean } | { asked: true }) =>
  request<ReminderResponse>('/api/reminder', body);
