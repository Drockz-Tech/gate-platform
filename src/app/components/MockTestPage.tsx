'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMock, useSubmitMock } from '@/app/hooks/useMocks';
import type { MockQuestionItem, QuestionOption } from '@/app/types/api';

type MockTestPageProps = {
  mockId: string;
};

type LocalAnswer = {
  questionId: string;
  selectedOptionId?: string;
  numericAnswer?: number;
  timeTakenSeconds: number;
};

export default function MockTestPage({ mockId }: MockTestPageProps) {
  const { data, isLoading, isError, error } = useMock(mockId);
  const submitMock = useSubmitMock();

  const mock = data?.data;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastSwitchTime, setLastSwitchTime] = useState<number | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    totalScore: number;
    totalQuestions: number;
    correctCount: number;
    attemptedCount: number;
  } | null>(null);

  // Start timer when mock data loads
  useEffect(() => {
    if (mock && !startedAt) {
      const now = Date.now();
      setStartedAt(now);
      setLastSwitchTime(now);
    }
  }, [mock, startedAt]);

  const questions: MockQuestionItem[] = mock?.questions ?? [];
  const totalQuestions = questions.length;

  const current = questions[currentIndex] ?? null;

  // Helper: record time spent on current question
  const recordTimeForCurrent = () => {
    if (!current || lastSwitchTime === null) return;
    const now = Date.now();
    const deltaSec = Math.floor((now - lastSwitchTime) / 1000);

    setAnswers((prev) => {
      const existing = prev[current.questionId] ?? {
        questionId: current.questionId,
        timeTakenSeconds: 0,
      };
      return {
        ...prev,
        [current.questionId]: {
          ...existing,
          timeTakenSeconds: existing.timeTakenSeconds + Math.max(deltaSec, 0),
        },
      };
    });

    setLastSwitchTime(now);
  };

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= totalQuestions) return;
    recordTimeForCurrent();
    setCurrentIndex(index);
  };

  const handleOptionSelect = (q: MockQuestionItem, opt: QuestionOption) => {
    setAnswers((prev) => {
      const existing = prev[q.questionId] ?? {
        questionId: q.questionId,
        timeTakenSeconds: 0,
      };
      return {
        ...prev,
        [q.questionId]: {
          ...existing,
          selectedOptionId: opt.id,
          numericAnswer: undefined,
        },
      };
    });
  };

  const currentAnswer = current
    ? answers[current.questionId] ?? {
        questionId: current.questionId,
        timeTakenSeconds: 0,
      }
    : null;

  const allAttemptedCount = useMemo(
    () =>
      Object.values(answers).filter(
        (a) => a.selectedOptionId !== undefined || a.numericAnswer !== undefined,
      ).length,
    [answers],
  );

  const handleSubmitTest = async () => {
    if (!mock) return;

    recordTimeForCurrent();

    const payloadAnswers: LocalAnswer[] = [];

    for (const mq of questions) {
      const local = answers[mq.questionId];
      if (!local) continue;
      if (
        local.selectedOptionId === undefined &&
        local.numericAnswer === undefined
      ) {
        continue;
      }
      payloadAnswers.push({
        questionId: mq.questionId,
        selectedOptionId: local.selectedOptionId,
        numericAnswer: local.numericAnswer,
        timeTakenSeconds: local.timeTakenSeconds,
      });
    }

    if (payloadAnswers.length === 0) {
      alert('You have not answered any questions.');
      return;
    }

    try {
      const res = await submitMock.mutateAsync({
        mockId: mock.id,
        responses: payloadAnswers,
      });

      const totalScore = res.data.totalScore;
      const totalQuestionsLocal = questions.length;
      const correctCount = res.data.responses.filter((r) => r.isCorrect).length;
      const attemptedCount = res.data.responses.length;

      setSubmittedResult({
        totalScore,
        totalQuestions: totalQuestionsLocal,
        correctCount,
        attemptedCount,
      });
    } catch (err) {
      console.error('Error submitting mock:', err);
      alert('Failed to submit mock. Please try again.');
    }
  };

  if (isLoading || !mock) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <div className="mb-4 h-6 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
        <div className="mt-6 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load mock: {(error as any)?.message ?? 'Unknown error'}
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          No questions in this mock.
        </div>
      </div>
    );
  }

  const timeLimitMinutes = mock.timeLimit;
  let timeSpentMinutes: number | null = null;
  if (startedAt) {
    const now = Date.now();
    const deltaSec = Math.floor((now - startedAt) / 1000);
    timeSpentMinutes = Math.floor(deltaSec / 60);
  }

  const progressPercent =
    totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      {/* Top bar: mock info + stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-gray-900">
            {mock.name}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>
              Q{currentIndex + 1} of {totalQuestions}
            </span>
            <span>• Attempted: {allAttemptedCount}</span>
            {timeLimitMinutes !== null && (
              <span>• Time limit: {timeLimitMinutes} min</span>
            )}
            {timeSpentMinutes !== null && (
              <span>• Time spent: {timeSpentMinutes} min</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-gray-100 sm:block">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="hidden text-xs text-gray-500 sm:inline">
            {progressPercent}% complete
          </span>
          <button
            type="button"
            onClick={handleSubmitTest}
            disabled={submitMock.isPending}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {submitMock.isPending ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>
      </div>

      {/* After submission: show summary card */}
      {submittedResult && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="mb-1 text-sm font-semibold">Test Submitted</div>
          <div className="text-xs">
            Score: <b>{submittedResult.totalScore}</b>{' '}
            ({submittedResult.correctCount}/{submittedResult.totalQuestions}{' '}
            correct, {submittedResult.attemptedCount} attempted)
          </div>
        </div>
      )}

      {/* Question card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium text-gray-500">
              Question {currentIndex + 1} of {totalQuestions}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              {current.question.question.subject && (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
                  {current.question.question.subject.name}
                </span>
              )}
              <span>{current.question.question.year}</span>
              {current.question.question.shift && (
                <span>• {current.question.question.shift}</span>
              )}
              <span>
                • {current.question.question.marks} mark
                {current.question.question.marks > 1 ? 's' : ''}
              </span>
              <span>• {current.question.question.type}</span>
              <span>• {current.question.question.difficulty}</span>
            </div>
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-900">
          {current.question.question.questionText}
        </div>

        {/* Topics */}
        <div className="mb-4 flex flex-wrap gap-2">
          {current.question.question.topics.map((t: { id: React.Key | null | undefined; name: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; }) => (
            <span
              key={t.id}
              className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700"
            >
              {t.name}
            </span>
          ))}
        </div>

        {/* Options (MCQ/MSQ – NAT UI can be added later) */}
        {current.question.question.type !== 'NAT' && (
          <div className="space-y-2">
            {current.question.question.options.map((opt: QuestionOption) => {
              const isSelected = currentAnswer?.selectedOptionId === opt.id;
              const base =
                'w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-sm cursor-pointer transition';
              const cls = isSelected
                ? base + ' border-blue-600 bg-blue-50'
                : base +
                  ' border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/50';
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleOptionSelect(current, opt)}
                  className={cls}
                  disabled={submitMock.isPending}
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                    {opt.label}
                  </span>
                  <span className="text-left">{opt.text}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Bottom nav */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => goToQuestion(currentIndex - 1)}
              disabled={currentIndex === 0 || submitMock.isPending}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => goToQuestion(currentIndex + 1)}
              disabled={currentIndex === totalQuestions - 1 || submitMock.isPending}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next →
            </button>
          </div>

          {/* Quick question jump indicators */}
          <div className="flex flex-wrap gap-1">
            {questions.map((q, idx) => {
              const ans = answers[q.questionId];
              const attempted =
                ans &&
                (ans.selectedOptionId !== undefined ||
                  ans.numericAnswer !== undefined);
              const isCurrent = idx === currentIndex;
              let cls =
                'inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium border transition';
              if (isCurrent) {
                cls += ' border-blue-600 bg-blue-600 text-white';
              } else if (attempted) {
                cls += ' border-emerald-500 bg-emerald-50 text-emerald-700';
              } else {
                cls += ' border-gray-300 bg-white text-gray-600';
              }
              return (
                <button
                  key={q.id}
                  type="button"
                  className={cls}
                  onClick={() => goToQuestion(idx)}
                  disabled={submitMock.isPending}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
