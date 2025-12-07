// app/api/admin/exams/route.ts
//
// Admin APIs for managing exams.
//
// GET /api/admin/exams
//   → List all exams.
//
// POST /api/admin/exams
//   Body:
//     {
//       "code": "GATE_CSE",
//       "name": "GATE Computer Science",
//     }
//
//   - If exam with same code exists → update name.
//   - Else → create new exam.
//
//   Returns:
//     { data: { id, code, name, createdAt, updatedAt } }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { requireUserId } from '@/app/lib/auth';

// 🔒 Optional simple admin guard placeholder.
// For now we only ensure user is logged in.
// Later you can extend this to check user role/permissions.
async function requireAdminUserId(): Promise<string> {
  const userId = await requireUserId();
  // TODO (future): check if userId belongs to an admin user.
  return userId;
}

/* ------------------------ GET: list exams ------------------------ */

export async function GET(_req: NextRequest) {
  try {
    await requireAdminUserId(); // ensure only logged-in user (you) can see for now

    const exams = await prisma.exam.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: exams });
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/admin/exams error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/* ------------------------ POST: create/update exam --------------- */

type ExamBody = {
  code?: string;
  name?: string;
};

export async function POST(req: NextRequest) {
  try {
    await requireAdminUserId();

    let body: ExamBody;
    try {
      body = (await req.json()) as ExamBody;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const code = (body.code ?? '').toString().trim();
    const name = (body.name ?? '').toString().trim();

    if (!code || !name) {
      return NextResponse.json(
        { error: 'Both "code" and "name" are required' },
        { status: 400 },
      );
    }

    const exam = await prisma.exam.upsert({
      where: { code },
      create: {
        code,
        name,
      },
      update: {
        name,
      },
      select: {
        id: true,
        code: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: exam });
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('POST /api/admin/exams error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
