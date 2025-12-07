'use client';

// hooks/useMocks.ts
//
// React Query hooks for mocks:
//  - useCreateMock      → create custom mock
//  - useMock            → fetch mock with questions
//  - useSubmitMock      → submit mock answers
//  - useMockAnalysis    → get analysis for a mock submission
//
// Requires:
//   npm i @tanstack/react-query
//   and a QueryClientProvider at app root.

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  CreatedMockResponse,
  MockDetailResponse,
  MockSubmitResponse,
  MockAnalysisResponse,
  QuestionType,
  Difficulty,
} from '@/app/types/api';

/* -------------------- shared helpers -------------------- */

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed with ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse error
    }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

/* -------------------- useCreateMock -------------------- */

export type CreateMockInput = {
  name: string;
  examCode?: string;          // default GATE_CSE
  subjectIds?: string[];
  topicIds?: string[];
  difficulties?: Difficulty[];
  types?: QuestionType[];
  marks?: number[];
  formulaBased?: boolean;
  tagIds?: string[];
  tagSlugs?: string[];
  numQuestions: number;
  timeLimitMinutes?: number | null;
};

export function useCreateMock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMockInput) => {
      const {
        name,
        examCode = 'GATE_CSE',
        subjectIds,
        topicIds,
        difficulties,
        types,
        marks,
        formulaBased,
        tagIds,
        tagSlugs,
        numQuestions,
        timeLimitMinutes,
      } = input;

      return fetchJson<CreatedMockResponse>('/api/mocks', {
        method: 'POST',
        body: JSON.stringify({
          name,
          examCode,
          subjectIds,
          topicIds,
          difficulties,
          types,
          marks,
          formulaBased,
          tagIds,
          tagSlugs,
          numQuestions,
          timeLimitMinutes,
        }),
      });
    },
    onSuccess: (data) => {
      // Optionally prime cache for this mock
      const mock = data.data;
      queryClient.setQueryData(['mock', mock.id], {
        data: {
          ...mock,
          latestSubmission: null,
        },
      } as MockDetailResponse);
    },
  });
}

/* -------------------- useMock (fetch mock detail) ------ */

export function useMock(mockId: string | null) {
  return useQuery({
    queryKey: ['mock', mockId],
    queryFn: () =>
      fetchJson<MockDetailResponse>(`/api/mocks/${mockId}`),
    enabled: !!mockId,
  });
}

/* -------------------- useSubmitMock -------------------- */

export type SubmitMockResponseInput = {
  mockId: string;
  responses: {
    questionId: string;
    selectedOptionId?: string;
    numericAnswer?: number;
    timeTakenSeconds: number;
  }[];
};

export function useSubmitMock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mockId, responses }: SubmitMockResponseInput) =>
      fetchJson<MockSubmitResponse>(`/api/mocks/${mockId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ responses }),
      }),
    onSuccess: (data, variables) => {
      // Invalidate mock detail so latestSubmission updates
      queryClient.invalidateQueries({
        queryKey: ['mock', variables.mockId],
      });
      // Also invalidate analysis
      queryClient.invalidateQueries({
        queryKey: ['mock-analysis', variables.mockId],
      });
    },
  });
}

/* -------------------- useMockAnalysis ------------------ */

export function useMockAnalysis(mockId: string | null, submissionId?: string) {
  return useQuery({
    queryKey: ['mock-analysis', mockId, submissionId ?? 'latest'],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (submissionId) searchParams.set('submissionId', submissionId);
      const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return fetchJson<MockAnalysisResponse>(
        `/api/mocks/${mockId}/analysis${qs}`,
      );
    },
    enabled: !!mockId,
  });
}
