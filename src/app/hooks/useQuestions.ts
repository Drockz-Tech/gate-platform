'use client';

// hooks/useQuestions.ts
//
// React Query hooks for:
//  - Listing questions with filters
//  - Fetching single question
//  - Attempting a question (practice mode)
//  - Toggling bookmark
//  - Submitting difficulty feedback
//
// Requires:
//   npm i @tanstack/react-query
//   and a QueryClientProvider at app root.

import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryKey,
} from '@tanstack/react-query';
import type {
  QuestionListResponse,
  QuestionDetailResponse,
  QuestionAttemptResponse,
  BookmarkToggleResponse,
  QuestionFeedbackStatsResponse,
  Difficulty,
  QuestionType,
} from '@/app/types/api';

/* -------------------- Small helpers -------------------- */

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Generic JSON fetcher with error handling
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

function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      searchParams.set(key, value.join(','));
    } else {
      searchParams.set(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/* -------------------- Question list hook -------------------- */

export type UseQuestionsFilters = {
  examCode?: string;
  subjectId?: string | null;
  topicIds?: string[];
  yearFrom?: number | null;
  yearTo?: number | null;
  difficulties?: Difficulty[];
  types?: QuestionType[];
  marks?: number[];
  formulaBased?: boolean | null;
  hasSolution?: boolean | null;
  tagIds?: string[];
  tagSlugs?: string[];
  onlyBookmarked?: boolean;
  onlyUnattempted?: boolean;
  sortBy?: 'year_desc' | 'year_asc';
  take?: number;
  skip?: number;
};

export function useQuestions(filters: UseQuestionsFilters) {
  const {
    examCode = 'GATE_CSE',
    subjectId = null,
    topicIds = [],
    yearFrom = null,
    yearTo = null,
    difficulties = [],
    types = [],
    marks = [],
    formulaBased = null,
    hasSolution = null,
    tagIds = [],
    tagSlugs = [],
    onlyBookmarked = false,
    onlyUnattempted = false,
    sortBy = 'year_desc',
    take = 20,
    skip = 0,
  } = filters;

  const queryKey: QueryKey = [
    'questions',
    {
      examCode,
      subjectId,
      topicIds,
      yearFrom,
      yearTo,
      difficulties,
      types,
      marks,
      formulaBased,
      hasSolution,
      tagIds,
      tagSlugs,
      onlyBookmarked,
      onlyUnattempted,
      sortBy,
      take,
      skip,
    },
  ];

  return useQuery({
    queryKey,
    queryFn: () => {
      const qs = buildQueryString({
        examCode,
        subjectId: subjectId ?? undefined,
        topicIds,
        yearFrom,
        yearTo,
        difficulty: difficulties,
        type: types,
        marks,
        formulaBased:
          formulaBased === null || formulaBased === undefined
            ? undefined
            : formulaBased,
        hasSolution:
          hasSolution === null || hasSolution === undefined
            ? undefined
            : hasSolution,
        tagIds,
        tagSlugs,
        onlyBookmarked,
        onlyUnattempted,
        sortBy,
        take,
        skip,
      });

      return fetchJson<QuestionListResponse>(`/api/questions${qs}`);
    },
    // keepPreviousData: true,
  });
}

/* -------------------- Single question hook -------------------- */

export function useQuestion(questionId: string | null) {
  return useQuery({
    queryKey: ['question', questionId],
    queryFn: () =>
      fetchJson<QuestionDetailResponse>(`/api/questions/${questionId}`),
    enabled: !!questionId,
  });
}

/* -------------------- Attempt question (practice) -------------- */

type AttemptQuestionArgs = {
  questionId: string;
  selectedOptionId?: string;
  numericAnswer?: number;
  timeTakenSeconds?: number;
  mode?: string; // default "practice"
};

export function useAttemptQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      questionId,
      selectedOptionId,
      numericAnswer,
      timeTakenSeconds,
      mode = 'practice',
    }: AttemptQuestionArgs) => {
      return fetchJson<QuestionAttemptResponse>(
        `/api/questions/${questionId}/attempt`,
        {
          method: 'POST',
          body: JSON.stringify({
            selectedOptionId,
            numericAnswer,
            timeTakenSeconds,
            mode,
          }),
        },
      );
    },
    onSuccess: (_data, variables) => {
      // Invalidate this question to refresh stats
      queryClient.invalidateQueries({
        queryKey: ['question', variables.questionId],
      });
    },
  });
}

/* -------------------- Bookmark toggle ------------------------- */

type ToggleBookmarkArgs = {
  questionId: string;
  action?: 'add' | 'remove' | 'toggle';
};

export function useToggleBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, action = 'toggle' }: ToggleBookmarkArgs) =>
      fetchJson<BookmarkToggleResponse>(
        `/api/questions/${questionId}/bookmark`,
        {
          method: 'POST',
          body: JSON.stringify({ action }),
        },
      ),
    onSuccess: (data, variables) => {
      // Update question detail cache
      queryClient.invalidateQueries({
        queryKey: ['question', variables.questionId],
      });
      // Also invalidate any question list that might use onlyBookmarked filter
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });
}

/* -------------------- Difficulty feedback --------------------- */

type SubmitFeedbackArgs = {
  questionId: string;
  difficulty: Difficulty;
};

export function useSubmitDifficultyFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, difficulty }: SubmitFeedbackArgs) =>
      fetchJson<{ data: { difficulty: Difficulty } }>(
        `/api/questions/${questionId}/feedback`,
        {
          method: 'POST',
          body: JSON.stringify({ difficulty }),
        },
      ),
    onSuccess: (_data, variables) => {
      // Invalidate feedback stats & question
      queryClient.invalidateQueries({
        queryKey: ['question', variables.questionId],
      });
      queryClient.invalidateQueries({
        queryKey: ['question-feedback', variables.questionId],
      });
    },
  });
}

/* -------------------- Difficulty stats hook -------------------- */

export function useQuestionDifficultyStats(questionId: string | null) {
  return useQuery({
    queryKey: ['question-feedback', questionId],
    queryFn: () =>
      fetchJson<QuestionFeedbackStatsResponse>(
        `/api/questions/${questionId}/feedback`,
      ),
    enabled: !!questionId,
  });
}
