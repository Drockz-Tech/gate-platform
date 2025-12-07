// app/api/questions/[id]/route.ts
//
// GET /api/questions/:id
//
// Returns a single question with:
// - options
// - solution
// - subject, topics, tags
// - isBookmarked (for current user, if logged in)
// - basic stats: attempts, correct, correctRate
//
// This is the API you’ll use on the Question View / Practice page.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getCurrentUserId } from '@/app/lib/auth';

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_req: NextRequest, context: RouteContext) {
  const questionId = context.params.id;

  try {
    const userId = await getCurrentUserId();

    // Fetch question with related data
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        options: {
          orderBy: { label: 'asc' }, // A, B, C, D in order
        },
        solution: true,
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
        // We only need to know if *this* user has bookmarked it
        bookmarks: userId
          ? {
              where: { userId },
              select: { id: true },
            }
          : false,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 },
      );
    }

    // Basic aggregate stats for this question
    const [attemptsCount, correctCount] = await Promise.all([
      prisma.questionAttempt.count({
        where: { questionId },
      }),
      prisma.questionAttempt.count({
        where: { questionId, isCorrect: true },
      }),
    ]);

    const stats =
      attemptsCount > 0
        ? {
            attempts: attemptsCount,
            correct: correctCount,
            correctRate: correctCount / attemptsCount, // 0–1
          }
        : {
            attempts: 0,
            correct: 0,
            correctRate: null as number | null,
          };

    const isBookmarked = userId
      ? Array.isArray(question.bookmarks) &&
        (question.bookmarks as { id: string }[]).length > 0
      : false;

    // Shape the data cleanly for frontend
    const payload = {
      id: question.id,
      examId: question.examId,
      subject: question.subject,
      year: question.year,
      shift: question.shift,
      marks: question.marks,
      type: question.type,
      difficulty: question.difficulty,
      isFormulaBased: question.isFormulaBased,
      hasSolution: question.hasSolution,
      question: question.question,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,

      options: question.options.map((o) => ({
        id: o.id,
        label: o.label,
        text: o.text,
        // DO NOT expose isCorrect in exam mode UI,
        // but it's okay to send here; frontend can decide when to show.
        isCorrect: o.isCorrect,
      })),

      solution: question.solution
        ? {
            id: question.solution.id,
            answerText: question.solution.answerText,
            explanation: question.solution.explanation,
          }
        : null,

      topics: question.topics.map((qt) => qt.topic),
      tags: question.tags.map((qt) => qt.tag),

      isBookmarked,
      stats,
    };

    return NextResponse.json({ data: payload });
  } catch (err) {
    console.error('GET /api/questions/[id] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
