import { NextRequest, NextResponse } from 'next/server';
import { Difficulty, QuestionType, Prisma } from '@prisma/client';
import { prisma } from '@/app/lib/prisma';
import { getCurrentUserId } from '@/app/lib/auth';

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseNumberArray(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n));
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseBool(value: string | null): boolean | null {
  if (value === null) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function parseEnumArray<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T[] {
  if (!value) return [];
  const parts = value.split(',');
  const out: T[] = [];
  for (const p of parts) {
    const v = p.trim().toUpperCase() as T;
    if (allowed.includes(v)) out.push(v);
  }
  return out;
}

export async function GET(req: NextRequest) {
  // try {
    const url = new URL(req.url);
    const examCode = url.searchParams.get('examCode');
    if (!examCode) {
      return NextResponse.json(
        { error: '"examCode" query param is required' },
        { status: 400 },
      );
    }

    // Optional subject/topic filters
    const subjectId = url.searchParams.get('subjectId');
    const topicIdsParam = url.searchParams.get('topicIds');
    const topicIds = parseStringArray(topicIdsParam);

    // Year range
    const yearFrom = parseNumber(url.searchParams.get('yearFrom'));
    const yearTo = parseNumber(url.searchParams.get('yearTo'));

    // Difficulty and type
    const difficulties = parseEnumArray<Difficulty>(
      url.searchParams.get('difficulty'),
      ['EASY', 'MEDIUM', 'HARD'],
    );
    const types = parseEnumArray<QuestionType>(
      url.searchParams.get('type'),
      ['MCQ', 'MSQ', 'NAT'],
    );

    // Marks
    const marks = parseNumberArray(url.searchParams.get('marks'));

    // Booleans
    const formulaBased = parseBool(url.searchParams.get('formulaBased'));
    const hasSolution = parseBool(url.searchParams.get('hasSolution'));

    const tagIds = parseStringArray(url.searchParams.get('tagIds'));
    const tagSlugs = parseStringArray(url.searchParams.get('tagSlugs'));

    const onlyBookmarked =
      url.searchParams.get('onlyBookmarked') === 'true';
    const onlyUnattempted =
      url.searchParams.get('onlyUnattempted') === 'true';

    const sortBy = url.searchParams.get('sortBy') ?? 'year_desc';

    const take = parseNumber(url.searchParams.get('take')) ?? 20;
    const skip = parseNumber(url.searchParams.get('skip')) ?? 0;

    const userId = await getCurrentUserId();

    // Look up exam id
    const exam = await prisma.exam.findUnique({
      where: { code: examCode },
      select: { id: true },
    });

    if (!exam) {
      return NextResponse.json(
        { error: 'Exam not found for given examCode' },
        { status: 404 },
      );
    }

    // Build Prisma where
    const where: Prisma.QuestionWhereInput = {
      examId: exam.id,
    };

    if (subjectId) {
      where.subjectId = subjectId;
    }

    if (topicIds.length > 0) {
      where.topics = {
        some: {
          topicId: { in: topicIds },
        },
      };
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

    if (marks.length > 0) {
      where.marks = { in: marks };
    }

    if (formulaBased !== null) {
      where.isFormulaBased = formulaBased;
    }

    if (hasSolution !== null) {
      where.hasSolution = hasSolution;
    }

    if (tagIds.length > 0 || tagSlugs.length > 0) {
      where.tags = {
        some: {
          OR: [
            tagIds.length
              ? {
                  tagId: {
                    in: tagIds,
                  },
                }
              : undefined,
            tagSlugs.length
              ? {
                  tag: {
                    slug: {
                      in: tagSlugs.map((s) => s.toLowerCase()),
                    },
                  },
                }
              : undefined,
          ].filter(Boolean) as any,
        },
      };
    }

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

    // Sort
        // Sort — Prisma 7 expects orderBy as an array
    let orderBy: Prisma.QuestionOrderByWithRelationInput[] = [
      { year: 'desc' },
      { createdAt: 'desc' },
    ];

    if (sortBy === 'year_asc') {
      orderBy = [
        { year: 'asc' },
        { createdAt: 'asc' },
      ];
    } else if (sortBy === 'year_desc') {
      orderBy = [
        { year: 'desc' },
        { createdAt: 'desc' },
      ];
    }

    // Query DB
    const [total, questions] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        orderBy, // ✅ now an array
        skip,
        take,
        include: {
          subject: {
            select: {
              id: true,
              name: true,
            },
          },
          topics: {
            include: {
              topic: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
    ]);


    const data = questions.map((q) => ({
      id: q.id,
      question: q.question,
      year: q.year,
      shift: q.shift,
      marks: q.marks,
      type: q.type,
      difficulty: q.difficulty,
      isFormulaBased: q.isFormulaBased,
      hasSolution: q.hasSolution,
      createdAt: q.createdAt.toISOString(),
      subject: q.subject
        ? {
            id: q.subject.id,
            name: q.subject.name,
          }
        : null,
      topics: q.topics.map((qt) => ({
        id: qt.topic.id,
        name: qt.topic.name,
      })),
      tags: q.tags.map((qt) => ({
        id: qt.tag.id,
        name: qt.tag.name,
        slug: qt.tag.slug,
      })),
    }));

    return NextResponse.json({
      data,
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
        marks,
        formulaBased,
        hasSolution,
        tagIds,
        tagSlugs,
        onlyBookmarked,
        onlyUnattempted,
        sortBy,
      },
    });
  // } catch (err) {
  //   console.error('GET /api/questions error:', err);
  //   return NextResponse.json(
  //     { error: 'Internal server error' },
  //     { status: 500 },
  //   );
  // }
// }
  }
