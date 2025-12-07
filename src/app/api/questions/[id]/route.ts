// src/app/api/questions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getCurrentUserId } from '@/app/lib/auth';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    // ✅ unwrap the Promise
    const { id } = await context.params;

    const userId = await getCurrentUserId();

    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        topics: {
          include: {
            topic: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        options: {
          // Prisma 7: orderBy as array
          orderBy: [{ label: 'asc' }],
        },
        solution: true,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 },
      );
    }

    // User-specific state (bookmark + last attempt), optional
    let bookmarked = false;
    let lastAttempt: any = null;

    if (userId) {
      const [bookmarkRow, lastAttemptRow] = await Promise.all([
        prisma.bookmark.findUnique({
          where: {
            userId_questionId: {
              userId,
              questionId: question.id,
            },
          },
        }),
        prisma.questionAttempt.findFirst({
          where: {
            userId,
            questionId: question.id,
          },
          // Prisma 7: orderBy as array here too
          orderBy: [{ createdAt: 'desc' }],
        }),
      ]);

      bookmarked = !!bookmarkRow;

      if (lastAttemptRow) {
        lastAttempt = {
          id: lastAttemptRow.id,
          selectedOptionId: lastAttemptRow.selectedOptionId,
          numericAnswer: lastAttemptRow.numericAnswer,
          isCorrect: lastAttemptRow.isCorrect,
          timeTakenSeconds: lastAttemptRow.timeTakenSeconds,
          mode: lastAttemptRow.mode,
          createdAt: lastAttemptRow.createdAt.toISOString(),
        };
      }
    }

    const data = {
      id: question.id,
      question: question.question,
      year: question.year,
      shift: question.shift,
      marks: question.marks,
      type: question.type,
      difficulty: question.difficulty,
      isFormulaBased: question.isFormulaBased,
      hasSolution: question.hasSolution,
      createdAt: question.createdAt.toISOString(),
      subject: question.subject
        ? {
            id: question.subject.id,
            name: question.subject.name,
          }
        : null,
      topics: question.topics.map((qt) => ({
        id: qt.topic.id,
        name: qt.topic.name,
      })),
      tags: question.tags.map((qt) => ({
        id: qt.tag.id,
        name: qt.tag.name,
        slug: qt.tag.slug,
      })),
      options: question.options.map((opt) => ({
        id: opt.id,
        label: opt.label,
        text: opt.text,
        isCorrect: opt.isCorrect,
      })),
      solution: question.solution
        ? {
            id: question.solution.id,
            answerText: question.solution.answerText,
            explanation: question.solution.explanation,
          }
        : null,
      userState: {
        bookmarked,
        lastAttempt,
      },
    };

    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET /api/questions/[id] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
