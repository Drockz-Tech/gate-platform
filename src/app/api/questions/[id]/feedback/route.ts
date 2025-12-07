// app/api/questions/[id]/feedback/route.ts
//
// POST /api/questions/:id/feedback
//
// Body:
//   { "difficulty": "EASY" | "MEDIUM" | "HARD" }
//
// Behaviour:
//   - Upserts a QuestionFeedback row for (user, question).
//
// Returns:
//   { data: { difficulty: "EASY" | "MEDIUM" | "HARD" } }
//
// GET /api/questions/:id/feedback
//
// Returns aggregate difficulty stats for that question:
//   {
//     data: {
//       counts: { EASY: number, MEDIUM: number, HARD: number },
//       total: number
//     }
//   }

import { NextRequest, NextResponse } from 'next/server';
import { Difficulty } from '@prisma/client';
import { prisma } from '@/app/lib/prisma';
import { requireUserId } from '@/app/lib/auth';

type RouteContext = {
  params: {
    id: string;
  };
};

/* -------------------- POST: submit / update feedback -------------------- */

type FeedbackBody = {
  difficulty?: Difficulty | string;
};

export async function POST(req: NextRequest, context: RouteContext) {
  const questionId = context.params.id;

  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Auth error in POST /api/questions/[id]/feedback:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }

  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const rawDifficulty = body.difficulty;
  const allowed = new Set<Difficulty>(['EASY', 'MEDIUM', 'HARD']);
  const normalized = (rawDifficulty ?? '').toString().toUpperCase() as Difficulty;

  if (!allowed.has(normalized)) {
    return NextResponse.json(
      { error: 'Invalid difficulty. Use EASY | MEDIUM | HARD.' },
      { status: 400 },
    );
  }

  try {
    // Optional safety: ensure question exists
    const questionExists = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });

    if (!questionExists) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 },
      );
    }

    await prisma.questionFeedback.upsert({
      where: {
        userId_questionId: {
          userId,
          questionId,
        },
      },
      create: {
        userId,
        questionId,
        difficulty: normalized,
      },
      update: {
        difficulty: normalized,
      },
    });

    return NextResponse.json({
      data: {
        difficulty: normalized,
      },
    });
  } catch (err) {
    console.error('POST /api/questions/[id]/feedback error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/* -------------------- GET: aggregate difficulty stats ------------------- */

export async function GET(_req: NextRequest, context: RouteContext) {
  const questionId = context.params.id;

  try {
    const [easyCount, mediumCount, hardCount] = await Promise.all([
      prisma.questionFeedback.count({
        where: { questionId, difficulty: 'EASY' },
      }),
      prisma.questionFeedback.count({
        where: { questionId, difficulty: 'MEDIUM' },
      }),
      prisma.questionFeedback.count({
        where: { questionId, difficulty: 'HARD' },
      }),
    ]);

    const total = easyCount + mediumCount + hardCount;

    return NextResponse.json({
      data: {
        counts: {
          EASY: easyCount,
          MEDIUM: mediumCount,
          HARD: hardCount,
        },
        total,
      },
    });
  } catch (err) {
    console.error('GET /api/questions/[id]/feedback error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
