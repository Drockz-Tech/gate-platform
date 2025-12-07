// app/api/mocks/route.ts
//
// POST /api/mocks
//
// Create a custom mock test from filters.
// Body:
//   {
//     "name": "OS + CN Mixed Mock",
//     "examCode": "GATE_CSE",          // optional, default: GATE_CSE
//     "subjectIds": ["subj1", "subj2"],// optional
//     "topicIds": ["topic1", "topic2"],// optional
//     "difficulties": ["EASY","MEDIUM","HARD"], // optional
//     "types": ["MCQ","NAT"],          // optional
//     "marks": [1, 2],                 // optional
//     "formulaBased": true,            // optional
//     "tagIds": ["tag1","tag2"],       // optional
//     "tagSlugs": ["high-weightage"],  // optional
//     "numQuestions": 20,              // required, <= 100
//     "timeLimitMinutes": 60           // optional (null = untimed)
//   }
//
// Behaviour:
//   - Finds questions matching filters.
//   - Randomly samples numQuestions from candidates.
//   - Creates a Mock + MockQuestion rows.
//   - Returns mock with ordered question ids.
//
// Returns:
//   {
//     "data": {
//       "id": "...",
//       "name": "...",
//       "timeLimit": 60,
//       "createdAt": "...",
//       "questions": [
//          { "id": "mockQuestionId", "order": 1, "questionId": "q1", "question": { ... } },
//          ...
//       ]
//     }
//   }

import { NextRequest, NextResponse } from 'next/server';
import { Difficulty, QuestionType, Prisma } from '@prisma/client';
import { prisma } from '@/app/lib/prisma';
import { requireUserId } from '@/app/lib/auth';

/* -------------------- helper parsers --------------------------------- */

function ensureArray<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  return [value as T];
}

function parseEnumArray<T extends string>(
  raw: unknown,
  allowed: readonly T[],
): T[] {
  const list = ensureArray<string>(raw).map((v) => v.toString().toUpperCase());
  const set = new Set(allowed);
  return list.filter((v): v is T => set.has(v as T));
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* -------------------- types ------------------------------------------ */

type CreateMockBody = {
  name?: string;
  examCode?: string;
  subjectIds?: string[] | string;
  topicIds?: string[] | string;
  difficulties?: Difficulty[] | string[] | string;
  types?: QuestionType[] | string[] | string;
  marks?: number[] | string[] | string;
  formulaBased?: boolean;
  tagIds?: string[] | string;
  tagSlugs?: string[] | string;
  numQuestions?: number;
  timeLimitMinutes?: number | null;
};

/* -------------------- POST handler ----------------------------------- */

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Auth error in POST /api/mocks:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }

  let body: CreateMockBody;
  try {
    body = (await req.json()) as CreateMockBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const name = (body.name ?? '').toString().trim();
  const examCode = (body.examCode ?? 'GATE_CSE').toString().trim();

  if (!name) {
    return NextResponse.json(
      { error: 'Mock name is required' },
      { status: 400 },
    );
  }

  const numQuestionsRaw = body.numQuestions;
  const numQuestions =
    typeof numQuestionsRaw === 'number'
      ? numQuestionsRaw
      : Number(numQuestionsRaw);

  if (!numQuestions || Number.isNaN(numQuestions) || numQuestions <= 0) {
    return NextResponse.json(
      { error: 'numQuestions must be a positive number' },
      { status: 400 },
    );
  }

  if (numQuestions > 100) {
    return NextResponse.json(
      { error: 'numQuestions cannot exceed 100 for a single mock' },
      { status: 400 },
    );
  }

  const timeLimitMinutes =
    body.timeLimitMinutes === undefined || body.timeLimitMinutes === null
      ? null
      : Number(body.timeLimitMinutes);

  if (
    timeLimitMinutes !== null &&
    (Number.isNaN(timeLimitMinutes) || timeLimitMinutes <= 0)
  ) {
    return NextResponse.json(
      { error: 'timeLimitMinutes must be a positive number or null' },
      { status: 400 },
    );
  }

  // Normalize arrays
  const subjectIds = ensureArray<string>(body.subjectIds);
  const topicIds = ensureArray<string>(body.topicIds);
  const tagIds = ensureArray<string>(body.tagIds);
  const tagSlugs = ensureArray<string>(body.tagSlugs);

  const difficulties = parseEnumArray<Difficulty>(body.difficulties, [
    'EASY',
    'MEDIUM',
    'HARD',
  ]);

  const types = parseEnumArray<QuestionType>(body.types, [
    'MCQ',
    'MSQ',
    'NAT',
  ]);

  const marksArrayRaw = ensureArray<string | number>(body.marks);
  const marksArray = marksArrayRaw
    .map((m) => Number(m))
    .filter((m) => !Number.isNaN(m));

  const formulaBased =
    typeof body.formulaBased === 'boolean' ? body.formulaBased : undefined;

  try {
    // Resolve exam
    const exam = await prisma.exam.findUnique({
      where: { code: examCode },
      select: { id: true },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Build question filter similar to /api/questions
    const where: Prisma.QuestionWhereInput = {
      examId: exam.id,
    };

    if (subjectIds.length > 0) {
      where.subjectId = { in: subjectIds };
    }

    if (difficulties.length > 0) {
      where.difficulty = { in: difficulties };
    }

    if (types.length > 0) {
      where.type = { in: types };
    }

    if (marksArray.length > 0) {
      where.marks = { in: marksArray };
    }

    if (formulaBased !== undefined) {
      where.isFormulaBased = formulaBased;
    }

    if (topicIds.length > 0) {
      where.topics = {
        some: {
          topicId: { in: topicIds },
        },
      };
    }

    if (tagIds.length > 0 || tagSlugs.length > 0) {
      where.tags = {
        some: {
          OR: [
            tagIds.length > 0
              ? {
                  tagId: { in: tagIds },
                }
              : undefined,
            tagSlugs.length > 0
              ? {
                  tag: {
                    slug: { in: tagSlugs },
                  },
                }
              : undefined,
          ].filter(Boolean) as Prisma.QuestionTagWhereInput[],
        },
      };
    }

    // Fetch candidate questions
    // We fetch up to 500 and sample randomly from them for variety.
    const candidates = await prisma.question.findMany({
      where,
      take: Math.min(500, numQuestions * 5), // a factor for diversity
      orderBy: {
        year: 'desc', // newer questions preferred in pool
      },
      include: {
        subject: {
          select: { id: true, name: true },
        },
        topics: {
          include: {
            topic: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'No questions found matching the criteria' },
        { status: 400 },
      );
    }

    if (candidates.length < numQuestions) {
      // You can choose to allow smaller mocks or treat as error.
      // For now, we allow smaller mocks with all candidates.
      console.warn(
        `Requested ${numQuestions} questions, but only ${candidates.length} found. Creating smaller mock.`,
      );
    }

    // Shuffle and slice
    shuffleInPlace(candidates);
    const selected = candidates.slice(0, Math.min(numQuestions, candidates.length));

    // Create mock and related MockQuestion rows
    const mock = await prisma.mock.create({
      data: {
        userId,
        name,
        timeLimit: timeLimitMinutes,
        questions: {
          create: selected.map((q, index) => ({
            questionId: q.id,
            order: index + 1,
          })),
        },
      },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              select: {
                id: true,
                year: true,
                shift: true,
                marks: true,
                type: true,
                difficulty: true,
                isFormulaBased: true,
                subject: {
                  select: { id: true, name: true },
                },
                topics: {
                  select: {
                    topic: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Clean payload
    const payload = {
      id: mock.id,
      name: mock.name,
      timeLimit: mock.timeLimit,
      createdAt: mock.createdAt,
      questions: mock.questions.map((mq) => ({
        id: mq.id,
        order: mq.order,
        questionId: mq.questionId,
        question: {
          id: mq.question.id,
          year: mq.question.year,
          shift: mq.question.shift,
          marks: mq.question.marks,
          type: mq.question.type,
          difficulty: mq.question.difficulty,
          isFormulaBased: mq.question.isFormulaBased,
          subject: mq.question.subject,
          topics: mq.question.topics.map((t) => t.topic),
        },
      })),
    };

    return NextResponse.json({ data: payload });
  } catch (err) {
    console.error('POST /api/mocks error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
