// app/api/questions/route.ts
//
// GET /api/questions
//
// Main endpoint to list questions with powerful filters.
// Supports:
// - examCode
// - subjectId
// - topicIds (multi)
// - yearFrom / yearTo
// - difficulty (multi)
// - type (multi)
// - marks (multi)
// - formulaBased (true/false)
// - tagIds (multi)
// - tagSlugs (multi)
// - hasSolution (true/false)
// - onlyBookmarked (user-specific)
// - onlyUnattempted (user-specific)
// - pagination: take, skip
// - sorting: sortBy=year_desc|year_asc
//
// This is written to be easy to extend later (more filters, sorts)
// without rewriting the whole handler.

import { NextRequest, NextResponse } from 'next/server';
import { Difficulty, QuestionType, Prisma } from '@prisma/client';
import { prisma } from '@/app/lib/prisma';
import { getCurrentUserId } from '@/app/lib/auth';

/* -------------------- helpers: parsing query params -------------------- */

function parseIntOrNull(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function parseBooleanOrNull(value: string | null): boolean | null {
  if (!value) return null;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return null;
}

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseEnumList<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T[] {
  const raw = parseList(value);
  const set = new Set(allowed);
  return raw.filter((v): v is T => set.has(v as T));
}

/* -------------------- GET handler ------------------------------------- */

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;

  // Core filters
  const examCode = params.get('examCode') ?? 'GATE_CSE';
  const subjectId = params.get('subjectId');
  const topicIds = parseList(params.get('topicIds')); // topicIds=id1,id2

  const yearFrom = parseIntOrNull(params.get('yearFrom'));
  const yearTo = parseIntOrNull(params.get('yearTo'));

  const difficulties = parseEnumList<Difficulty>(params.get('difficulty'), [
    'EASY',
    'MEDIUM',
    'HARD',
  ]);

  const types = parseEnumList<QuestionType>(params.get('type'), [
    'MCQ',
    'MSQ',
    'NAT',
  ]);

  const marksList = parseList(params.get('marks'))
    .map((m) => Number(m))
    .filter((m) => !Number.isNaN(m));

  const formulaBased = parseBooleanOrNull(params.get('formulaBased')); // true / false
  const hasSolution = parseBooleanOrNull(params.get('hasSolution')); // true / false

  // Tag filters
  const tagIds = parseList(params.get('tagIds')); // tagIds=id1,id2
  const tagSlugs = parseList(params.get('tagSlugs')); // tagSlugs=high-weightage,tricky

  // User-specific filters
  const onlyBookmarked = parseBooleanOrNull(params.get('onlyBookmarked')) ?? false;
  const onlyUnattempted = parseBooleanOrNull(params.get('onlyUnattempted')) ?? false;

  // Pagination
  const takeRaw = parseIntOrNull(params.get('take'));
  const skipRaw = parseIntOrNull(params.get('skip'));
  const take = takeRaw && takeRaw > 0 && takeRaw <= 100 ? takeRaw : 20;
  const skip = skipRaw && skipRaw >= 0 ? skipRaw : 0;

  // Sorting
  const sortBy = params.get('sortBy') ?? 'year_desc'; // "year_desc" | "year_asc"

  try {
    const userId = await getCurrentUserId();

    // If user-specific filters are requested, ensure user is logged in
    if ((onlyBookmarked || onlyUnattempted) && !userId) {
      return NextResponse.json(
        { error: 'Unauthorized for user-specific filters' },
        { status: 401 },
      );
    }

    // Find exam id from examCode (keeps query explicit & indexed)
    const exam = await prisma.exam.findUnique({
      where: { code: examCode },
      select: { id: true },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    /* -------------------- build Prisma where clause -------------------- */

    const where: Prisma.QuestionWhereInput = {
      examId: exam.id,
    };

    if (subjectId) {
      where.subjectId = subjectId;
    }

    if (yearFrom !== null || yearTo !== null) {
      where.year = {};
      if (yearFrom !== null) (where.year as any).gte = yearFrom;
      if (yearTo !== null) (where.year as any).lte = yearTo;
    }

    if (difficulties.length > 0) {
      where.difficulty = { in: difficulties };
    }

    if (types.length > 0) {
      where.type = { in: types };
    }

    if (marksList.length > 0) {
      where.marks = { in: marksList };
    }

    if (formulaBased !== null) {
      where.isFormulaBased = formulaBased;
    }

    if (hasSolution !== null) {
      where.hasSolution = hasSolution;
    }

    if (topicIds.length > 0) {
      where.topics = {
        some: {
          topicId: { in: topicIds },
        },
      };
    }

    // Tag filter: by IDs
    if (tagIds.length > 0) {
      where.tags = {
        some: {
          tagId: { in: tagIds },
        },
      };
    }

    // Tag filter: by tag slugs (more user-friendly, SEO-friendly)
    if (tagSlugs.length > 0) {
      where.tags = {
        some: {
          tag: {
            slug: { in: tagSlugs },
          },
        },
      };
    }

    // User-specific filters
    if (onlyBookmarked && userId) {
      where.bookmarks = {
        some: {
          userId,
        },
      };
    }

    if (onlyUnattempted && userId) {
      where.attempts = {
        none: {
          userId,
        },
      };
    }

    /* -------------------- sorting -------------------------------------- */

    let orderBy: Prisma.QuestionOrderByWithRelationInput = {
      year: 'desc',
    };

    if (sortBy === 'year_asc') {
      orderBy = { year: 'asc' };
    }
    // Later, you can add more:
    // - difficulty
    // - createdAt
    // - custom popularity/attempts metric (via a materialized view / denormalized column)

    /* -------------------- query DB ------------------------------------- */

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        select: {
          id: true,
          year: true,
          shift: true,
          marks: true,
          type: true,
          difficulty: true,
          question: true,
          isFormulaBased: true,
          hasSolution: true,
          createdAt: true,
          subject: {
            select: { id: true, name: true },
          },
          topics: {
            select: {
              topic: { select: { id: true, name: true } },
            },
          },
          tags: {
            select: {
              tag: { select: { id: true, name: true, slug: true } },
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.question.count({ where }),
    ]);

    /* -------------------- response payload ----------------------------- */

    return NextResponse.json({
      data: questions.map((q) => ({
        id: q.id,
        question: q.question,
        year: q.year,
        shift: q.shift,
        marks: q.marks,
        type: q.type,
        difficulty: q.difficulty,
        isFormulaBased: q.isFormulaBased,
        hasSolution: q.hasSolution,
        subject: q.subject,
        topics: q.topics.map((t) => t.topic),
        tags: q.tags.map((t) => t.tag),
        createdAt: q.createdAt,
      })),
      pagination: {
        total,
        take,
        skip,
      },
      filters: {
        examCode,
        subjectId,
        topicIds,
        yearFrom,
        yearTo,
        difficulties,
        types,
        marks: marksList,
        formulaBased,
        hasSolution,
        tagIds,
        tagSlugs,
        onlyBookmarked,
        onlyUnattempted,
        sortBy,
      },
    });
  } catch (err) {
    console.error('GET /api/questions error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
