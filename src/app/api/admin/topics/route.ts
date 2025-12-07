// app/api/admin/topics/route.ts
//
// Admin APIs for managing topics.
//
// GET /api/admin/topics?subjectId=SUBJECT_ID
//   → List all topics for a given subject.
//
// GET /api/admin/topics?examCode=GATE_CSE
//   → List all topics grouped by subject for an exam.
//
// POST /api/admin/topics
//   Body:
//     {
//       "subjectId": "subject-id",           // required (unless using subjectName+examCode pattern later)
//       "name": "Process Scheduling",
//       "id": "optional-topic-id-if-updating"
//     }
//
//   Behaviour:
//     - If "id" is provided → update that topic's name and subjectId.
//     - Else → upsert by (subjectId, name) to avoid duplicates.
//   Returns:
//     { data: Topic[] } for GET
//     { data: Topic } for POST

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { requireUserId } from '@/app/lib/auth';

// Simple admin gate (same as exams/subjects):
async function requireAdminUserId(): Promise<string> {
  const userId = await requireUserId();
  // TODO: later, enforce admin role.
  return userId;
}

type TopicBody = {
  id?: string;
  subjectId?: string;
  name?: string;
};

/* ------------------------ GET: list topics ------------------------ */

export async function GET(req: NextRequest) {
  try {
    await requireAdminUserId();

    const url = new URL(req.url);
    const subjectId = (url.searchParams.get('subjectId') ?? '').toString().trim();
    const examCode = (url.searchParams.get('examCode') ?? '').toString().trim();

    if (!subjectId && !examCode) {
      return NextResponse.json(
        { error: 'Either "subjectId" or "examCode" query param is required' },
        { status: 400 },
      );
    }

    // Case 1: list topics for a single subject
    if (subjectId) {
      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        select: {
          id: true,
          name: true,
          examId: true,
          exam: {
            select: { code: true, name: true },
          },
        },
      });

      if (!subject) {
        return NextResponse.json(
          { error: 'Subject not found for given subjectId' },
          { status: 404 },
        );
      }

      const topics = await prisma.topic.findMany({
        where: { subjectId },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          subjectId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({
        data: {
          subject,
          topics,
        },
      });
    }

    // Case 2: list topics for all subjects of an exam
    const exam = await prisma.exam.findUnique({
      where: { code: examCode },
      select: {
        id: true,
        code: true,
        name: true,
        subjects: {
          select: {
            id: true,
            name: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!exam) {
      return NextResponse.json(
        { error: 'Exam not found for given examCode' },
        { status: 404 },
      );
    }

    const subjectIds = exam.subjects.map((s) => s.id);

    const topics = await prisma.topic.findMany({
      where: { subjectId: { in: subjectIds } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        subjectId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Group topics by subjectId for convenience
    const topicsBySubject: Record<
      string,
      {
        id: string;
        name: string;
        subjectId: string;
        createdAt: Date;
        updatedAt: Date;
      }[]
    > = {};

    for (const t of topics) {
      if (!topicsBySubject[t.subjectId]) {
        topicsBySubject[t.subjectId] = [];
      }
      topicsBySubject[t.subjectId].push(t);
    }

    return NextResponse.json({
      data: {
        exam: {
          id: exam.id,
          code: exam.code,
          name: exam.name,
        },
        subjects: exam.subjects.map((s) => ({
          id: s.id,
          name: s.name,
          topics: topicsBySubject[s.id] ?? [],
        })),
      },
    });
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/admin/topics error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/* ------------------------ POST: create/update topic --------------- */

export async function POST(req: NextRequest) {
  try {
    await requireAdminUserId();

    let body: TopicBody;
    try {
      body = (await req.json()) as TopicBody;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const id = body.id?.toString().trim();
    const subjectId = body.subjectId?.toString().trim();
    const name = body.name?.toString().trim();

    if (!subjectId || !name) {
      return NextResponse.json(
        { error: '"subjectId" and "name" are required' },
        { status: 400 },
      );
    }

    // Ensure subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true },
    });

    if (!subject) {
      return NextResponse.json(
        { error: 'Subject not found for given subjectId' },
        { status: 404 },
      );
    }

    let topic;

    if (id) {
      // Update by id
      topic = await prisma.topic.update({
        where: { id },
        data: {
          name,
          subjectId: subject.id,
        },
        select: {
          id: true,
          name: true,
          subjectId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } else {
      // Upsert by (subjectId, name) using @@unique(subjectId, name)
      topic = await prisma.topic.upsert({
        where: {
          subjectId_name: {
            subjectId: subject.id,
            name,
          },
        },
        create: {
          name,
          subjectId: subject.id,
        },
        update: {
          name,
        },
        select: {
          id: true,
          name: true,
          subjectId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return NextResponse.json({ data: topic });
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('POST /api/admin/topics error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
