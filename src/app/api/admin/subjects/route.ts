// app/api/admin/subjects/route.ts
//
// Admin APIs for managing subjects.
//
// GET /api/admin/subjects?examCode=GATE_CSE
//   → List all subjects for a given exam.
//
// POST /api/admin/subjects
//   Body:
//     {
//       "examCode": "GATE_CSE",
//       "name": "Operating Systems",
//       "id": "optional-subject-id-if-updating"
//     }
//
//   Behaviour:
//     - If "id" is provided → update that subject's name (and exam if changed).
//     - Else → upsert by (examId, name) to avoid duplicates.
//
//   Returns:
//     { data: Subject[] } for GET
//     { data: Subject } for POST

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { requireUserId } from '@/app/lib/auth';

// Same simple admin gate as exams route:
async function requireAdminUserId(): Promise<string> {
  const userId = await requireUserId();
  // TODO: check user role for real admin later.
  return userId;
}

type SubjectBody = {
  id?: string;
  examCode?: string;
  name?: string;
};

/* ------------------------ GET: list subjects ------------------------ */

export async function GET(req: NextRequest) {
  try {
    await requireAdminUserId();

    const url = new URL(req.url);
    const examCode = (url.searchParams.get('examCode') ?? '').toString().trim();

    if (!examCode) {
      return NextResponse.json(
        { error: '"examCode" query param is required' },
        { status: 400 },
      );
    }

    const exam = await prisma.exam.findUnique({
      where: { code: examCode },
      select: { id: true, code: true, name: true },
    });

    if (!exam) {
      return NextResponse.json(
        { error: 'Exam not found for given examCode' },
        { status: 404 },
      );
    }

    const subjects = await prisma.subject.findMany({
      where: { examId: exam.id },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        examId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      data: {
        exam,
        subjects,
      },
    });
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/admin/subjects error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/* ------------------------ POST: create/update subject --------------- */

export async function POST(req: NextRequest) {
  try {
    await requireAdminUserId();

    let body: SubjectBody;
    try {
      body = (await req.json()) as SubjectBody;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const id = body.id?.toString().trim();
    const examCode = (body.examCode ?? '').toString().trim();
    const name = (body.name ?? '').toString().trim();

    if (!examCode || !name) {
      return NextResponse.json(
        { error: '"examCode" and "name" are required' },
        { status: 400 },
      );
    }

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

    let subject;

    if (id) {
      // Update existing subject by id
      subject = await prisma.subject.update({
        where: { id },
        data: {
          name,
          examId: exam.id,
        },
        select: {
          id: true,
          name: true,
          examId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } else {
      // Upsert by (examId, name) using our @@unique(examId, name) constraint
      subject = await prisma.subject.upsert({
        where: {
          examId_name: {
            examId: exam.id,
            name,
          },
        },
        create: {
          name,
          examId: exam.id,
        },
        update: {
          name,
        },
        select: {
          id: true,
          name: true,
          examId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return NextResponse.json({ data: subject });
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('POST /api/admin/subjects error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
