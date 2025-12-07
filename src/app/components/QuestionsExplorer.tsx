'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuestions } from '@/app/hooks/useQuestions';
import type {
  Difficulty,
  QuestionType,
  QuestionListItem,
  Tag,
  Subject,
  Topic,
} from '@/app/types/api';

/* -------------------- small helpers -------------------- */

type SubjectOption = Subject;
type TopicOption = Topic;
type TagOption = Tag;

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
      if ((body as any)?.error) msg = (body as any).error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/* -------------------- main component -------------------- */

export default function QuestionsExplorer() {
  const [examCode] = useState('GATE_CSE');

  // Meta state
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [topicsBySubject, setTopicsBySubject] = useState<
    Record<string, TopicOption[]>
  >({});
  const [tags, setTags] = useState<TagOption[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  // Filter state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>(
    [],
  );
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([]);
  const [selectedMarks, setSelectedMarks] = useState<number[]>([]);
  const [formulaBased, setFormulaBased] = useState<boolean | null>(null);
  const [hasSolution, setHasSolution] = useState<boolean | null>(true);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [onlyUnattempted, setOnlyUnattempted] = useState(false);
  const [sortBy, setSortBy] = useState<'year_desc' | 'year_asc'>('year_desc');

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 20;

  /* -------------------- load metadata -------------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const [subjectsRes, topicsRes, tagsRes] = await Promise.all([
          fetchJson<{
            data: {
              exam: { id: string; code: string; name: string };
              subjects: {
                id: string;
                name: string;
                examId: string;
                createdAt: string;
                updatedAt: string;
              }[];
            };
          }>(`/api/admin/subjects?examCode=${examCode}`),
          fetchJson<{
            data: {
              exam: { id: string; code: string; name: string };
              subjects: {
                id: string;
                name: string;
                topics: {
                  id: string;
                  name: string;
                  subjectId: string;
                  createdAt: string;
                  updatedAt: string;
                }[];
              }[];
            };
          }>(`/api/admin/topics?examCode=${examCode}`),
          fetchJson<{ data: TagOption[] }>(`/api/admin/tags`),
        ]);

        if (cancelled) return;

        setSubjects(
          subjectsRes.data.subjects.map((s) => ({
            ...s,
          })),
        );

        const bySubject: Record<string, TopicOption[]> = {};
        for (const subj of topicsRes.data.subjects) {
          bySubject[subj.id] = subj.topics;
        }
        setTopicsBySubject(bySubject);
        setTags(tagsRes.data);

        // default select first subject if none
        if (!selectedSubjectId && subjectsRes.data.subjects.length > 0) {
          setSelectedSubjectId(subjectsRes.data.subjects[0].id);
        }
      } catch (err: any) {
        if (!cancelled) {
          setMetaError(err.message ?? 'Failed to load metadata');
        }
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [examCode, selectedSubjectId]);

  const topicsForSelectedSubject = useMemo(() => {
    if (!selectedSubjectId) return [];
    return topicsBySubject[selectedSubjectId] ?? [];
  }, [selectedSubjectId, topicsBySubject]);

  // When subject changes, reset topic
  useEffect(() => {
    setSelectedTopicId(null);
  }, [selectedSubjectId]);

  // When filters change, reset page
  useEffect(() => {
    setPage(0);
  }, [
    selectedSubjectId,
    selectedTopicId,
    yearFrom,
    yearTo,
    selectedDifficulties,
    selectedTypes,
    selectedMarks,
    formulaBased,
    hasSolution,
    selectedTagIds,
    onlyBookmarked,
    onlyUnattempted,
    sortBy,
  ]);

  /* -------------------- query questions -------------------- */

  const {
    data: questionsRes,
    isLoading: questionsLoading,
    isError: questionsError,
    error: questionsErrorObj,
  } = useQuestions({
    examCode,
    subjectId: selectedSubjectId,
    topicIds: selectedTopicId ? [selectedTopicId] : [],
    yearFrom: yearFrom ? Number(yearFrom) : null,
    yearTo: yearTo ? Number(yearTo) : null,
    difficulties: selectedDifficulties,
    types: selectedTypes,
    marks: selectedMarks,
    formulaBased,
    hasSolution,
    tagIds: selectedTagIds,
    tagSlugs: [],
    onlyBookmarked,
    onlyUnattempted,
    sortBy,
    take: pageSize,
    skip: page * pageSize,
  });

  const questions: QuestionListItem[] = questionsRes?.data ?? [];
  const total = questionsRes?.pagination.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  /* -------------------- filter toggles -------------------- */

  const toggleDifficulty = (d: Difficulty) => {
    setSelectedDifficulties((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  };

  const toggleType = (t: QuestionType) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const toggleMarks = (m: number) => {
    setSelectedMarks((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  };

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const clearFilters = () => {
    setSelectedSubjectId(subjects[0]?.id ?? null);
    setSelectedTopicId(null);
    setYearFrom('');
    setYearTo('');
    setSelectedDifficulties([]);
    setSelectedTypes([]);
    setSelectedMarks([]);
    setFormulaBased(null);
    setHasSolution(true);
    setSelectedTagIds([]);
    setOnlyBookmarked(false);
    setOnlyUnattempted(false);
    setSortBy('year_desc');
  };

  /* -------------------- render -------------------- */

  return (
    <div className="mx-auto flex max-w-6xl gap-4 p-4">
      {/* Sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-700 shadow-sm md:flex">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Filters
          </h2>
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] text-blue-600 hover:text-blue-700"
          >
            Reset
          </button>
        </div>

        {/* Exam */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500">
            Exam
          </label>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-medium text-gray-800">
            {examCode}
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500">
            Subject
          </label>
          <select
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
            value={selectedSubjectId ?? ''}
            onChange={(e) =>
              setSelectedSubjectId(e.target.value || null)
            }
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Topic */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500">
            Topic
          </label>
          <select
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
            value={selectedTopicId ?? ''}
            onChange={(e) =>
              setSelectedTopicId(e.target.value || null)
            }
          >
            <option value="">All topics</option>
            {topicsForSelectedSubject.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Year range */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500">
            Year range
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="From"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
            />
            <input
              type="number"
              placeholder="To"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
            />
          </div>
        </div>

        {/* Difficulty */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500">
            Difficulty
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map((d) => {
              const selected = selectedDifficulties.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDifficulty(d)}
                  className={`rounded-full border px-2 py-1 text-[11px] font-medium transition ${
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Type */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500">
            Question type
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(['MCQ', 'MSQ', 'NAT'] as QuestionType[]).map((t) => {
              const selected = selectedTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={`rounded-full border px-2 py-1 text-[11px] font-medium transition ${
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Marks */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500">
            Marks
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2].map((m) => {
              const selected = selectedMarks.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMarks(m)}
                  className={`rounded-full border px-2 py-1 text-[11px] font-medium transition ${
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {m} mark{m > 1 ? 's' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Formula-based */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500">
            Formula-based
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setFormulaBased(true)}
              className={`flex-1 rounded-full border px-2 py-1 text-[11px] font-medium transition ${
                formulaBased === true
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Only formula
            </button>
            <button
              type="button"
              onClick={() => setFormulaBased(null)}
              className={`flex-1 rounded-full border px-2 py-1 text-[11px] font-medium transition ${
                formulaBased === null
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Has solution */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500">
            Solutions
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setHasSolution(true)}
              className={`flex-1 rounded-full border px-2 py-1 text-[11px] font-medium transition ${
                hasSolution === true
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              With solution
            </button>
            <button
              type="button"
              onClick={() => setHasSolution(null)}
              className={`flex-1 rounded-full border px-2 py-1 text-[11px] font-medium transition ${
                hasSolution === null
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500">
            Tags
          </label>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
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
          </div>
        </div>

        {/* User-specific */}
        <div className="space-y-2 border-t border-gray-100 pt-2">
          <label className="text-[11px] font-medium text-gray-500">
            Your practice
          </label>
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={onlyBookmarked}
                onChange={(e) => setOnlyBookmarked(e.target.checked)}
                className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Only bookmarked</span>
            </label>
            <label className="flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={onlyUnattempted}
                onChange={(e) => setOnlyUnattempted(e.target.checked)}
                className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Only unattempted</span>
            </label>
          </div>
        </div>

        {/* Sort */}
        <div className="space-y-1 border-t border-gray-100 pt-2">
          <label className="text-[11px] font-medium text-gray-500">
            Sort by
          </label>
          <select
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'year_desc' | 'year_asc')
            }
          >
            <option value="year_desc">Year (newest first)</option>
            <option value="year_asc">Year (oldest first)</option>
          </select>
        </div>

        {metaLoading && (
          <p className="mt-2 text-[11px] text-gray-400">
            Loading subjects/topics…
          </p>
        )}
        {metaError && (
          <p className="mt-2 text-[11px] text-red-500">{metaError}</p>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 space-y-3">
        {/* Top bar mobile filters / summary */}
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h1 className="text-sm font-semibold text-gray-900">
              Question Bank
            </h1>
            <p className="text-[11px] text-gray-500">
              {total} questions found • Page {page + 1}
              {totalPages > 0 ? ` / ${totalPages}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span className="hidden rounded-full border border-gray-200 bg-white px-2 py-1 md:inline">
              Filters: subject / topic / year / difficulty / tags / formula-based
            </span>
          </div>
        </div>

        {/* Question list */}
        <div className="space-y-2">
          {questionsLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
                  </div>
                  <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
                  <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                </div>
              ))}
            </div>
          )}

          {questionsError && !questionsLoading && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              Failed to load questions:{' '}
              {(questionsErrorObj as any)?.message ?? 'Unknown error'}
            </div>
          )}

          {!questionsLoading && !questionsError && questions.length === 0 && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
              No questions match the selected filters. Try widening your filters.
            </div>
          )}

          {questions.map((q) => (
            <QuestionListCard key={q.id} question={q} />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 shadow-sm">
            <div>
              Showing{' '}
              <span className="font-medium">
                {page * pageSize + 1}–
                {Math.min((page + 1) * pageSize, total)}
              </span>{' '}
              of <span className="font-medium">{total}</span> questions
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={page === 0}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← Prev
              </button>
              <span className="text-[11px]">
                Page <b>{page + 1}</b> of <b>{totalPages}</b>
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((p) =>
                    p + 1 < totalPages ? p + 1 : p,
                  )
                }
                disabled={page + 1 >= totalPages}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* -------------------- Question list card -------------------- */

function QuestionListCard({ question }: { question: QuestionListItem }) {
  return (
    <a
      href={`/questions/${question.id}`}
      className="block rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-700 shadow-sm transition hover:border-blue-400 hover:shadow-md"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {question.subject && (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
              {question.subject.name}
            </span>
          )}
          <span className="text-[11px] text-gray-500">
            {question.year}
            {question.shift ? ` • ${question.shift}` : ''}
          </span>
          <span className="text-[11px] text-gray-500">
            • {question.marks} mark{question.marks > 1 ? 's' : ''}
          </span>
          <span className="text-[11px] text-gray-500">• {question.type}</span>
          <span className="text-[11px] text-gray-500">
            • {question.difficulty}
          </span>
          {question.isFormulaBased && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
              Formula-based
            </span>
          )}
        </div>
        {question.hasSolution && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            Has solution
          </span>
        )}
      </div>

      <div className="mb-2 line-clamp-2 text-sm text-gray-900">
        {question.question}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {question.topics.slice(0, 3).map((t) => (
            <span
              key={t.id}
              className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700"
            >
              {t.name}
            </span>
          ))}
          {question.topics.length > 3 && (
            <span className="text-[10px] text-gray-400">
              +{question.topics.length - 3} more
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {question.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600"
            >
              #{tag.slug}
            </span>
          ))}
        </div>
      </div>
    </a>
  );
}
