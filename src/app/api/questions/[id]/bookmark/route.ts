// app/api/questions/[id]/bookmark/route.ts
//
// POST /api/questions/:id/bookmark
//
// Body:
//   { "action": "add" | "remove" | "toggle" }
//
// Behaviour:
//   - "add"    → ensure bookmark exists
//   - "remove" → ensure bookmark is removed
//   - "toggle" → flip bookmark state
//
// Returns:
//   { data: { isBookmarked: boolean } }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { requireUserId } from '@/app/lib/auth';

type RouteContext = {
  params: {
    id: string;
  };
};

type BookmarkBody = {
  action?: 'add' | 'remove' | 'toggle';
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
    console.error('Auth error in POST /api/questions/[id]/bookmark:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }

  let body: BookmarkBody;
  try {
    body = (await req.json()) as BookmarkBody;
  } catch {
    body = {};
  }

  const action = body.action ?? 'toggle';

  try {
    // Ensure question exists (optional but safer)
    const exists = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });

    if (!exists) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 },
      );
    }

    if (action === 'add') {
      await prisma.bookmark.upsert({
        where: {
          userId_questionId: {
            userId,
            questionId,
          },
        },
        create: {
          userId,
          questionId,
        },
        update: {},
      });

      return NextResponse.json({ data: { isBookmarked: true } });
    }

    if (action === 'remove') {
      await prisma.bookmark.deleteMany({
        where: {
          userId,
          questionId,
        },
      });

      return NextResponse.json({ data: { isBookmarked: false } });
    }

    if (action === 'toggle') {
      const existing = await prisma.bookmark.findUnique({
        where: {
          userId_questionId: {
            userId,
            questionId,
          },
        },
        select: { id: true },
      });

      if (existing) {
        await prisma.bookmark.delete({
          where: { id: existing.id },
        });
        return NextResponse.json({ data: { isBookmarked: false } });
      } else {
        await prisma.bookmark.create({
          data: {
            userId,
            questionId,
          },
        });
        return NextResponse.json({ data: { isBookmarked: true } });
      }
    }

    return NextResponse.json(
      { error: 'Invalid action. Use add | remove | toggle.' },
      { status: 400 },
    );
  } catch (err) {
    console.error('POST /api/questions/[id]/bookmark error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
