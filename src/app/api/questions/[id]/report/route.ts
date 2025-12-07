// app/api/questions/[id]/report/route.ts
//
// POST /api/questions/:id/report
//
// Body:
//   {
//     "type": "WRONG_ANSWER" | "WRONG_SOLUTION" | "TAG_ISSUE" | "OTHER",
//     "message": "Optional user message explaining the problem"
//   }
//
// Behaviour:
//   - Creates a QuestionReport row (user may be logged-in or anonymous).
//
// Returns:
//   { data: { id: string } }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getCurrentUserId } from '@/app/lib/auth';

type RouteContext = {
  params: {
    id: string;
  };
};

type ReportBody = {
  type?: string;
  message?: string;
};

const ALLOWED_TYPES = new Set([
  'WRONG_ANSWER',
  'WRONG_SOLUTION',
  'TAG_ISSUE',
  'OTHER',
]);

export async function POST(req: NextRequest, context: RouteContext) {
  const questionId = context.params.id;

  let body: ReportBody;
  try {
    body = (await req.json()) as ReportBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const rawType = (body.type ?? 'OTHER').toString().toUpperCase();
  const type = ALLOWED_TYPES.has(rawType) ? rawType : 'OTHER';
  const message = body.message?.toString().trim() || null;

  try {
    const userId = await getCurrentUserId(); // may be null (allow anonymous reports)

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

    const report = await prisma.questionReport.create({
      data: {
        userId: userId ?? null,
        questionId,
        type,
        message,
      },
    });

    return NextResponse.json({
      data: {
        id: report.id,
      },
    });
  } catch (err) {
    console.error('POST /api/questions/[id]/report error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
