'use client';

import React, { useState } from 'react';
import {
  useQuestion,
  useAttemptQuestion,
  useToggleBookmark,
  useSubmitDifficultyFeedback,
} from '@/app/hooks/useQuestions';
import type {
  Difficulty,
  QuestionOption,
  QuestionDetail,
} from '@/app/types/api';

type QuestionCardProps = {
  questionId: string;
};

// Simple chip/button styles
const chipBase =
  'inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium transition';
const chipSelected = chipBase + ' bg-blue-600 text-white border-blue-600';
const chipUnselected =
  chipBase + ' bg-white text-gray-700 border-gray-300 hover:bg-gray-50';

const diffColors: Record<Difficulty, string> = {
  EASY: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  MEDIUM: 'text-amber-600 bg-amber-50 border-amber-200',
  HARD: 'text-rose-600 bg-rose-50 border-rose-200',
};

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${diffColors[difficulty]}`}
    >
      {difficulty}
    </span>
  );
}

export default function QuestionCard({ questionId }: QuestionCardProps) {
  const { data, isLoading, isError, error } = useQuestion(questionId);
  const attemptMutation = useAttemptQuestion();
  const bookmarkMutation = useToggleBookmark();
  const feedbackMutation = useSubmitDifficultyFeedback();

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctOptionIds, setCorrectOptionIds] = useState<string[]>([]);
  const [showSolution, setShowSolution] = useState(false);
  const [localBookmarked, setLocalBookmarked] = useState<boolean | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const question: QuestionDetail | undefined = data?.data;

  // Derive effective bookmark state (local override > server)
  const isBookmarked =
    localBookmarked !== null ? localBookmarked : question?.isBookmarked ?? false;

  if (isLoading) {
    return (
      <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200 mb-4" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 mb-2" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200 mb-2" />
        <div className="mt-4 flex gap-2">
          <div className="h-8 w-24 animate-pulse rounded-full bg-gray-200" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>
    );
  }

  if (isError || !question) {
    return (
      <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Failed to load question: {(error as any)?.message ?? 'Unknown error'}
      </div>
    );
  }

  const handleOptionClick = (opt: QuestionOption) => {
    if (submitted || attemptMutation.isPending) return;
    setSelectedOptionId(opt.id);
  };

  const handleSubmit = async () => {
    if (!selectedOptionId || submitted) return;
    setSubmittingAnswer(true);
    try {
      const res = await attemptMutation.mutateAsync({
        questionId,
        selectedOptionId,
        timeTakenSeconds: 0, // you can plug real timing later
      });

      setIsCorrect(res.data.isCorrect);
      setCorrectOptionIds(res.data.correctOptionIds || []);
      setSubmitted(true);
      setShowSolution(true);
    } catch (err) {
      console.error('Submit attempt error:', err);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleBookmarkToggle = async () => {
    try {
      const res = await bookmarkMutation.mutateAsync({
        questionId,
        action: 'toggle',
      });
      setLocalBookmarked(res.data.isBookmarked);
    } catch (err) {
      console.error('Bookmark toggle error:', err);
    }
  };

  const handleFeedbackClick = async (difficulty: Difficulty) => {
    if (submittingFeedback) return;
    setSubmittingFeedback(true);
    try {
      await feedbackMutation.mutateAsync({ questionId, difficulty });
      // Optional: show toast or some UI confirmation
    } catch (err) {
      console.error('Feedback submit error:', err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const renderOptionClass = (opt: QuestionOption) => {
    const base =
      'w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-sm cursor-pointer transition';

    if (!submitted) {
      const isSelected = selectedOptionId === opt.id;
      return (
        base +
        (isSelected
          ? ' border-blue-600 bg-blue-50'
          : ' border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/50')
      );
    }

    const isSelected = selectedOptionId === opt.id;
    const isCorrectOpt = correctOptionIds.includes(opt.id) || opt.isCorrect;

    if (isCorrectOpt && isSelected) {
      return (
        base +
        ' border-emerald-500 bg-emerald-50 text-emerald-900 font-medium'
      );
    }
    if (isCorrectOpt && !isSelected) {
      return (
        base +
        ' border-emerald-400 bg-emerald-50/80 text-emerald-900'
      );
    }
    if (!isCorrectOpt && isSelected) {
      return base + ' border-rose-400 bg-rose-50 text-rose-900';
    }
    return base + ' border-gray-200 bg-white opacity-80';
  };

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Header: meta + bookmark */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {question.subject && (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                {question.subject.name}
              </span>
            )}
            <span>
              {question.year}
              {question.shift ? ` • ${question.shift}` : ''}
            </span>
            <span>• {question.marks} mark{question.marks > 1 ? 's' : ''}</span>
            <span>• {question.type}</span>
          </div>
          <DifficultyBadge difficulty={question.difficulty} />
        </div>

        <button
          type="button"
          onClick={handleBookmarkToggle}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${
            isBookmarked
              ? 'border-amber-500 bg-amber-50 text-amber-700'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>{isBookmarked ? '★' : '☆'}</span>
          <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
        </button>
      </div>

      {/* Question text */}
      <div className="mb-4 text-sm text-gray-900">
        {question.question}
      </div>

      {/* Topics & tags */}
      <div className="mb-4 flex flex-wrap gap-2">
        {question.topics.map((t) => (
          <span
            key={t.id}
            className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700"
          >
            {t.name}
          </span>
        ))}
        {question.tags.map((tag) => (
          <span
            key={tag.id}
            className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600"
          >
            #{tag.slug}
          </span>
        ))}
      </div>

      {/* Options (for MCQ/MSQ) */}
      {question.type !== 'NAT' && (
        <div className="mb-5 space-y-2">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={renderOptionClass(opt)}
              onClick={() => handleOptionClick(opt)}
              disabled={submitted || attemptMutation.isPending}
            >
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                {opt.label}
              </span>
              <span className="text-left">{opt.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* NAT input can be added later with a small controlled input + submit */}

      {/* Submit + feedback */}
      <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
        {/* Correct / Wrong message */}
        {submitted && isCorrect !== null && (
          <div
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
              isCorrect
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            <span>{isCorrect ? '✅ Correct' : '❌ Wrong'}</span>
            <span className="text-[11px] text-gray-500">
              Attempts: {question.stats.attempts} • Correct rate:{' '}
              {question.stats.correctRate !== null
                ? `${Math.round(question.stats.correctRate * 100)}%`
                : '—'}
            </span>
          </div>
        )}

        {/* Submit button (for MCQ) */}
        {question.type !== 'NAT' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                !selectedOptionId ||
                submitted ||
                submittingAnswer ||
                attemptMutation.isPending
              }
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {submittingAnswer ? 'Checking...' : submitted ? 'Answered' : 'Check Answer'}
            </button>

            {/* Difficulty feedback chips */}
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <span>How was it?</span>
              <button
                type="button"
                onClick={() => handleFeedbackClick('EASY')}
                disabled={submittingFeedback}
                className={chipUnselected}
              >
                Easy
              </button>
              <button
                type="button"
                onClick={() => handleFeedbackClick('MEDIUM')}
                disabled={submittingFeedback}
                className={chipUnselected}
              >
                Medium
              </button>
              <button
                type="button"
                onClick={() => handleFeedbackClick('HARD')}
                disabled={submittingFeedback}
                className={chipUnselected}
              >
                Hard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Solution section */}
      {question.solution && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => setShowSolution((s) => !s)}
            className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <span>{showSolution ? 'Hide Solution' : 'Show Solution'}</span>
            <span>{showSolution ? '▲' : '▼'}</span>
          </button>

          {showSolution && (
            <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-800">
              <div className="mb-1 font-semibold">
                Answer: {question.solution.answerText}
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">
                {question.solution.explanation}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
