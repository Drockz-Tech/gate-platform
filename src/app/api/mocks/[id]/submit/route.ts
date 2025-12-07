// app/api/mocks/[id]/submit/route.ts
//
// POST /api/mocks/:id/submit
//
// Body:
//   {
//     "responses": [
//        {
//          "questionId": "q123",
//          "selectedOptionId": "opt123",   // MCQ/MSQ
//          "numericAnswer": 42.0,         // NAT
//          "timeTakenSeconds": 34
//        },
//        ...
//     ]
//   }
//
// Behaviour:
//   - Validates mock ownership
//   - Computes total score
//   - Creates MockSubmission and MockQuestionResponse rows
//   - Also logs QuestionAttempt for analytics
//
// Returns:
//   {
//     "data": {
//        "submissionId": "...",
//        "totalScore": 35,
//        "responses": [
//          {
//            "questionId":"...",
//            "isCorrect":true,
//            "correctOptionIds":[ "..." ],
//            "correctNumericAnswer": 3.14,
//            "selectedOptionId":"...",
//            "numericAnswer":...
//          },
//        ]
//     }
//   }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { requireUserId } from '@/app/lib/auth';

type RouteContext = {
  params: {
    id: string;
  };
};

type SubmittedResponse = {
  questionId: string;
  selectedOptionId?: string;
  numericAnswer?: number;
  timeTakenSeconds: number;
};

type SubmitMockBody = {
  responses: SubmittedResponse[];
};

export async function POST(req: NextRequest, context: RouteContext) {
  const mockId = context.params.id;

  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Auth error in POST /api/mocks/[id]/submit:', err);
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 });
  }

  let body: SubmitMockBody;
  try {
    body = (await req.json()) as SubmitMockBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const responses = body.responses ?? [];
  if (!Array.isArray(responses) || responses.length === 0) {
    return NextResponse.json(
      { error: 'Responses array cannot be empty' },
      { status: 400 },
    );
  }

  try {
    // Load mock with question details
    const mock = await prisma.mock.findUnique({
      where: { id: mockId },
      include: {
        questions: {
          include: {
            question: {
              include: {
                options: true,
                solution: true,
              },
            },
          },
        },
      },
    });

    if (!mock) {
      return NextResponse.json(
        { error: 'Mock not found' },
        { status: 404 },
      );
    }

    if (mock.userId !== userId) {
      return NextResponse.json(
        { error: 'You do not have access to this mock' },
        { status: 403 },
      );
    }

    const questionMap = new Map(
      mock.questions.map((mq) => [mq.questionId, mq.question]),
    );

    let totalScore = 0;

    const resultResponses: {
      questionId: string;
      isCorrect: boolean;
      selectedOptionId?: string;
      numericAnswer?: number;
      correctOptionIds?: string[];
      correctNumericAnswer?: number | null;
      timeTakenSeconds: number;
    }[] = [];

    for (const r of responses) {
      const q = questionMap.get(r.questionId);
      if (!q) continue;

      let isCorrect = false;
      let correctOptionIds: string[] = [];
      let correctNumericAnswer: number | null = null;

      if (q.type === 'NAT') {
        if (!q.solution) {
          console.error(`Solution missing for NAT question ${q.id}`);
          continue;
        }

        const correctValue = parseFloat(q.solution.answerText);
        const givenValue = Number(r.numericAnswer);
        const TOLERANCE = 0.0001;
        isCorrect = Math.abs(correctValue - givenValue) <= TOLERANCE;
        correctNumericAnswer = correctValue;
      } else {
        const correctOptions = q.options.filter((o) => o.isCorrect);
        correctOptionIds = correctOptions.map((o) => o.id);
        isCorrect = correctOptionIds.includes(r.selectedOptionId || '');
      }

      if (isCorrect) {
        totalScore += q.marks;
      }

      resultResponses.push({
        questionId: r.questionId,
        selectedOptionId: r.selectedOptionId,
        numericAnswer: r.numericAnswer,
        isCorrect,
        correctOptionIds,
        correctNumericAnswer,
        timeTakenSeconds: r.timeTakenSeconds,
      });

      // Also log general QuestionAttempt for analytics
      await prisma.questionAttempt.create({
        data: {
          userId,
          questionId: r.questionId,
          selectedOptionId: r.selectedOptionId ?? null,
          numericAnswer: r.numericAnswer ?? null,
          isCorrect,
          timeTakenSeconds: r.timeTakenSeconds,
          mode: 'mock',
        },
      });
    }

    // Save submission
    const submission = await prisma.mockSubmission.create({
      data: {
        mockId,
        userId,
        totalScore,
        responses: {
          create: resultResponses.map((r) => ({
            questionId: r.questionId,
            selectedOptionId: r.selectedOptionId ?? null,
            numericAnswer: r.numericAnswer ?? null,
            isCorrect: r.isCorrect,
            timeTakenSeconds: r.timeTakenSeconds,
          })),
        },
      },
      include: {
        responses: true,
      },
    });

    return NextResponse.json({
      data: {
        submissionId: submission.id,
        totalScore: submission.totalScore,
        responses: resultResponses,
      },
    });
  } catch (err) {
    console.error('POST /api/mocks/[id]/submit error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
