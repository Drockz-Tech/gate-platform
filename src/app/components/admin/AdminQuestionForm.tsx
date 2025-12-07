'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  AdminExam,
  AdminExamListResponse,
  AdminSubjectsByExamResponse,
  AdminTopicsForSubjectResponse,
  AdminTagsListResponse,
  AdminQuestionResponse,
  Difficulty,
  QuestionType,
  Tag,
} from '@/app/types/api';

/* -------------------- shared fetch helper -------------------- */

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
    let msg = `Request failed with ${res.status}`;
    try {
      const body = await res.json();
      if ((body as any).error) msg = (body as any).error;
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status);
  }

  return res.json() as Promise<T>;
}

/* -------------------- hooks for admin meta -------------------- */

function useAdminExams() {
  return useQuery({
    queryKey: ['admin-exams'],
    queryFn: () =>
      fetchJson<AdminExamListResponse>('/api/admin/exams'),
  });
}

function useAdminSubjects(examCode: string | null) {
  return useQuery({
    queryKey: ['admin-subjects', examCode],
    queryFn: () =>
      fetchJson<AdminSubjectsByExamResponse>(
        `/api/admin/subjects?examCode=${examCode}`,
      ),
    enabled: !!examCode,
  });
}

function useAdminTopics(subjectId: string | null) {
  return useQuery({
    queryKey: ['admin-topics', subjectId],
    queryFn: () =>
      fetchJson<AdminTopicsForSubjectResponse>(
        `/api/admin/topics?subjectId=${subjectId}`,
      ),
    enabled: !!subjectId,
  });
}

function useAdminTags() {
  return useQuery({
    queryKey: ['admin-tags'],
    queryFn: () =>
      fetchJson<AdminTagsListResponse>('/api/admin/tags'),
  });
}

/* -------------------- main component -------------------- */

type AdminQuestionFormProps = {
  /** Optional: questionId to edit existing question (not fully wired yet, but reserved) */
  questionId?: string;
};

export default function AdminQuestionForm({
  questionId,
}: AdminQuestionFormProps) {
  // Step 1: load exams, subjects, topics, tags
  const { data: examsRes, isLoading: examsLoading } = useAdminExams();
  const [examCode, setExamCode] = useState<string | null>('GATE_CSE');

  const { data: subjectsRes } = useAdminSubjects(examCode);
  const subjects = subjectsRes?.data.subjects ?? [];

  const [subjectId, setSubjectId] = useState<string | null>(null);

  const { data: topicsRes } = useAdminTopics(subjectId);
  const topics = topicsRes?.data.topics ?? [];

  const { data: tagsRes } = useAdminTags();
  const tags: Tag[] = tagsRes?.data ?? [];

  useEffect(() => {
    if (!subjectId && subjects.length > 0) {
      setSubjectId(subjects[0].id);
    }
  }, [subjects, subjectId]);

  // Step 2: local form state
  const [year, setYear] = useState<number | ''>(2024);
  const [shift, setShift] = useState<string>('');
  const [marks, setMarks] = useState<number | ''>(1);
  const [type, setType] = useState<QuestionType>('MCQ');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [isFormulaBased, setIsFormulaBased] = useState(false);
  const [questionText, setQuestionText] = useState('');

  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [solutionAnswer, setSolutionAnswer] = useState('');
  const [solutionExplanation, setSolutionExplanation] = useState('');

  // Options for MCQ/MSQ
  const [options, setOptions] = useState<
    { label: string; text: string; isCorrect: boolean }[]
  >([
    { label: 'A', text: '', isCorrect: false },
    { label: 'B', text: '', isCorrect: false },
    { label: 'C', text: '', isCorrect: false },
    { label: 'D', text: '', isCorrect: false },
  ]);

  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Step 3: mutation to create/update question
  const createQuestionMutation = useMutation({
    mutationFn: async () => {
      if (!examCode || !subjectId) {
        throw new Error('Exam and subject are required');
      }
      if (!questionText.trim()) {
        throw new Error('Question text is required');
      }
      if (!year || Number.isNaN(Number(year))) {
        throw new Error('Valid year is required');
      }
      if (!marks || Number.isNaN(Number(marks))) {
        throw new Error('Valid marks are required');
      }

      const payload: any = {
        id: questionId ?? undefined,
        examCode,
        subjectId,
        year: Number(year),
        shift: shift || null,
        marks: Number(marks),
        type,
        difficulty,
        isFormulaBased,
        question: questionText,
        topicIds: selectedTopicIds,
        tagIds: selectedTagIds,
        options:
          type === 'NAT'
            ? []
            : options
                .filter((o) => o.text.trim())
                .map((o) => ({
                  label: o.label,
                  text: o.text.trim(),
                  isCorrect: o.isCorrect,
                })),
        solution: solutionAnswer
          ? {
              answerText: solutionAnswer.trim(),
              explanation: solutionExplanation.trim(),
            }
          : null,
      };

      return fetchJson<AdminQuestionResponse>('/api/admin/questions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerMessage(null);
    setServerError(null);
    try {
      const res = await createQuestionMutation.mutateAsync();
      setServerMessage(
        `Question saved successfully (id: ${res.data.id}, year: ${res.data.year})`,
      );
    } catch (err: any) {
      setServerError(err.message ?? 'Failed to save question');
    }
  };

  const handleOptionChange = (
    index: number,
    field: 'text' | 'isCorrect',
    value: string | boolean,
  ) => {
    setOptions((prev) =>
      prev.map((opt, i) =>
        i === index
          ? {
              ...opt,
              [field]: value,
            }
          : opt,
      ),
    );
  };

  const handleTopicToggle = (id: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleTagToggle = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const currentExam: AdminExam | undefined = useMemo(
    () =>
      examsRes?.data.find((e) => e.code === examCode) ??
      examsRes?.data[0],
    [examsRes, examCode],
  );

  useEffect(() => {
    if (!examCode && currentExam) {
      setExamCode(currentExam.code);
    }
  }, [currentExam, examCode]);

  const isNat = type === 'NAT';

  /* -------------------- render -------------------- */

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-800 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            Admin · {questionId ? 'Edit Question' : 'Create Question'}
          </h1>
          <p className="text-xs text-gray-500">
            Fill all details and save. Uses <code>/api/admin/questions</code> behind the scenes.
          </p>
        </div>
        {currentExam && (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            Exam: {currentExam.name} ({currentExam.code})
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Exam / Subject / Year / Shift / Marks row */}
        <div className="grid gap-3 md:grid-cols-4">
          {/* Exam select (in case of multiple exams later) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Exam
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
              value={examCode ?? ''}
              onChange={(e) => setExamCode(e.target.value || null)}
            >
              {examsRes?.data.map((exam) => (
                <option key={exam.id} value={exam.code}>
                  {exam.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Subject
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
              value={subjectId ?? ''}
              onChange={(e) => setSubjectId(e.target.value || null)}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Year
            </label>
            <input
              type="number"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
              value={year}
              onChange={(e) =>
                setYear(e.target.value ? Number(e.target.value) : '')
              }
              placeholder="2024"
            />
          </div>

          {/* Shift */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Shift (optional)
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              placeholder="Shift 1 / Morning / etc."
            />
          </div>
        </div>

        {/* Marks / Type / Difficulty / Formula-based */}
        <div className="grid gap-3 md:grid-cols-4">
          {/* Marks */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Marks
            </label>
            <input
              type="number"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
              value={marks}
              onChange={(e) =>
                setMarks(e.target.value ? Number(e.target.value) : '')
              }
              placeholder="1 or 2"
            />
          </div>

          {/* Type */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Type
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
              value={type}
              onChange={(e) => setType(e.target.value as QuestionType)}
            >
              <option value="MCQ">MCQ</option>
              <option value="MSQ">MSQ</option>
              <option value="NAT">NAT</option>
            </select>
          </div>

          {/* Difficulty */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Difficulty
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
              value={difficulty}
              onChange={(e) =>
                setDifficulty(e.target.value as Difficulty)
              }
            >
              <option value="EASY">EASY</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HARD">HARD</option>
            </select>
          </div>

          {/* Formula-based */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Formula-based
            </label>
            <div className="flex items-center gap-2">
              <input
                id="formulabased"
                type="checkbox"
                checked={isFormulaBased}
                onChange={(e) => setIsFormulaBased(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="formulabased"
                className="text-xs text-gray-600"
              >
                Yes, this is a formula-based question
              </label>
            </div>
          </div>
        </div>

        {/* Question text */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">
            Question text
          </label>
          <textarea
            className="min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Enter the full question here. You can later render LaTeX/HTML in UI if needed."
          />
        </div>

        {/* Topics and Tags */}
        <div className="grid gap-3 md:grid-cols-2">
          {/* Topics */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Topics (multi-select)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((t) => {
                const selected = selectedTopicIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTopicToggle(t.id)}
                    className={`rounded-full border px-2 py-1 text-[11px] transition ${
                      selected
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
              {topics.length === 0 && (
                <span className="text-[11px] text-gray-400">
                  No topics configured for this subject yet.
                </span>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleTagToggle(tag.id)}
                    className={`rounded-full border px-2 py-1 text-[11px] transition ${
                      selected
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    #{tag.slug}
                  </button>
                );
              })}
              {tags.length === 0 && (
                <span className="text-[11px] text-gray-400">
                  No tags yet. Create via /api/admin/tags or admin UI later.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Options (MCQ / MSQ only) */}
        {!isNat && (
          <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700">
                Options & correct answer
              </label>
              <span className="text-[11px] text-gray-500">
                Mark at least one option as correct
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {options.map((opt, idx) => (
                <div
                  key={opt.label}
                  className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-2 py-2"
                >
                  <div className="mt-1 text-xs font-semibold">
                    {opt.label}
                  </div>
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                      placeholder={`Option ${opt.label}`}
                      value={opt.text}
                      onChange={(e) =>
                        handleOptionChange(idx, 'text', e.target.value)
                      }
                    />
                    <label className="flex items-center gap-1 text-[11px] text-gray-600">
                      <input
                        type="checkbox"
                        checked={opt.isCorrect}
                        onChange={(e) =>
                          handleOptionChange(
                            idx,
                            'isCorrect',
                            e.target.checked,
                          )
                        }
                        className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Correct
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Solution */}
        <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
          <label className="text-xs font-semibold text-gray-700">
            Solution
          </label>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-gray-600">
                Final answer (text or numeric)
              </span>
              <input
                type="text"
                className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs"
                value={solutionAnswer}
                onChange={(e) => setSolutionAnswer(e.target.value)}
                placeholder={
                  isNat
                    ? 'e.g., 3.14'
                    : 'e.g., Option C / FCFS / 42 etc.'
                }
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-gray-600">
                Explanation
              </span>
              <textarea
                className="min-h-[60px] w-full rounded border border-gray-200 px-2 py-1.5 text-xs"
                value={solutionExplanation}
                onChange={(e) => setSolutionExplanation(e.target.value)}
                placeholder="Explain the reasoning/steps here. You can use markdown/LaTeX later in rendering."
              />
            </div>
          </div>
        </div>

        {/* Messages */}
        {serverMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {serverMessage}
          </div>
        )}
        {serverError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {serverError}
          </div>
        )}

        {/* Submit button */}
        <div className="flex items-center justify-end gap-2">
          {createQuestionMutation.isPending && (
            <span className="text-[11px] text-gray-500">
              Saving question…
            </span>
          )}
          <button
            type="submit"
            disabled={createQuestionMutation.isPending || examsLoading}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {questionId ? 'Update Question' : 'Create Question'}
          </button>
        </div>
      </form>
    </div>
  );
}
