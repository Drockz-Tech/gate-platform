// app/api/mocks/[id]/route.ts
//
// GET /api/mocks/:id
//
// Returns a mock with:
//  - id, name, timeLimit, createdAt
//  - ordered questions (with options, subject, topics)
//  - (optionally) most recent submission summary for this user
//
// You’ll use this to render the mock-taking page.
//
// NOTE: This endpoint ensures that only the owner (creator) of the mock
// can access it.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { requireUserId } from '@/app/lib/auth';

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_req: NextRequest, context: RouteContext) {
  const mockId = context.params.id;

  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Auth error in GET /api/mocks/[id]:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }

  try {
    const mock = await prisma.mock.findUnique({
      where: { id: mockId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              include: {
                options: {
                  orderBy: { label: 'asc' },
                },
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
            },
          },
        },
        submissions: {
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            totalScore: true,
            createdAt: true,
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

    const latestSubmission = mock.submissions[0] ?? null;

    const payload = {
      id: mock.id,
      name: mock.name,
      timeLimit: mock.timeLimit,
      createdAt: mock.createdAt,
      latestSubmission,
      questions: mock.questions.map((mq) => ({
        id: mq.id, // MockQuestion id
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
          questionText: mq.question.question,
          subject: mq.question.subject,
          topics: mq.question.topics.map((t) => t.topic),
          options: mq.question.options.map((o) => ({
            id: o.id,
            label: o.label,
            text: o.text,
            // You **can** send isCorrect here and just not use it until review mode,
            // or you can omit it from the payload to be extra safe.
            isCorrect: o.isCorrect,
          })),
        },
      })),
    };

    return NextResponse.json({ data: payload });
  } catch (err) {
    console.error('GET /api/mocks/[id] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
