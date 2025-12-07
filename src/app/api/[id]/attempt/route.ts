// app/api/questions/[id]/attempt/route.ts
//
// POST /api/questions/:id/attempt
//
// Use this for PRACTICE mode:
// - User selects an option (MCQ/MSQ-style) OR enters numeric answer (NAT).
// - API computes isCorrect.
// - Logs the attempt in QuestionAttempt.
// - Returns:
//    - isCorrect
//    - attemptId
//    - correctOptionIds (for MCQ/MSQ)
//    - correctNumericAnswer (for NAT)
//
// Frontend flow:
//  1. User selects answer.
//  2. Call this API.
//  3. Show green/red + answer/solution based on response.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { requireUserId } from '@/app/lib/auth';

type RouteContext = {
  params: {
    id: string;
  };
};

type AttemptRequestBody = {
  selectedOptionId?: string;  // MCQ/MSQ (single-id for now)
  numericAnswer?: number;     // NAT
  timeTakenSeconds?: number;
  mode?: string;              // default "practice"
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
    console.error('Auth error in POST /api/questions/[id]/attempt:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }

  let body: AttemptRequestBody;
  try {
    body = (await req.json()) as AttemptRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const {
    selectedOptionId,
    numericAnswer,
    timeTakenSeconds = 0,
    mode = 'practice',
  } = body;

  try {
    // Load question with options + solution (for correctness check)
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        options: true,
        solution: true,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 },
      );
    }

    let isCorrect = false;
    let correctOptionIds: string[] = [];
    let correctNumericAnswer: number | null = null;

    if (question.type === 'NAT') {
      // Numeric Answer Type
      if (!question.solution) {
        console.error(
          `NAT question ${question.id} has no solution configured.`,
        );
        return NextResponse.json(
          { error: 'Solution not configured for this NAT question' },
          { status: 500 },
        );
      }

      if (numericAnswer === undefined || numericAnswer === null) {
        return NextResponse.json(
          { error: 'numericAnswer is required for NAT questions' },
          { status: 400 },
        );
      }

      const correctValue = parseFloat(question.solution.answerText);
      const givenValue = Number(numericAnswer);

      if (Number.isNaN(correctValue) || Number.isNaN(givenValue)) {
        return NextResponse.json(
          { error: 'Invalid numeric value' },
          { status: 400 },
        );
      }

      const TOLERANCE = 0.0001; // you can tweak this per exam pattern
      isCorrect = Math.abs(correctValue - givenValue) <= TOLERANCE;
      correctNumericAnswer = correctValue;
    } else {
      // MCQ / MSQ-style (current schema supports single selectedOptionId)
      if (!selectedOptionId) {
        return NextResponse.json(
          { error: 'selectedOptionId is required for non-NAT questions' },
          { status: 400 },
        );
      }

      const correctOptions = question.options.filter((o) => o.isCorrect);
      if (correctOptions.length === 0) {
        console.error(
          `Question ${question.id} has no correct options configured.`,
        );
        return NextResponse.json(
          { error: 'Correct option not configured for this question' },
          { status: 500 },
        );
      }

      correctOptionIds = correctOptions.map((o) => o.id);

      // For now: treat MSQ like a single-correct question.
      // Later, you can extend schema to store array of selected options.
      isCorrect = correctOptionIds.includes(selectedOptionId);
    }

    // Log attempt in DB
    const attempt = await prisma.questionAttempt.create({
      data: {
        userId,
        questionId,
        selectedOptionId: selectedOptionId ?? null,
        numericAnswer: numericAnswer ?? null,
        isCorrect,
        timeTakenSeconds,
        mode,
      },
    });

    return NextResponse.json({
      data: {
        attemptId: attempt.id,
        isCorrect,
        correctOptionIds,
        correctNumericAnswer,
      },
    });
  } catch (err) {
    console.error('POST /api/questions/[id]/attempt error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
