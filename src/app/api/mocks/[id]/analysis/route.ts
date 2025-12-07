// app/api/mocks/[id]/analysis/route.ts
//
// GET /api/mocks/:id/analysis
//
// Optional query param:
//   ?submissionId=...   // if omitted, uses latest submission for this user
//
// Returns analysis for a specific mock submission:
//  {
//    data: {
//      mock: { id, name, timeLimit, createdAt },
//      submission: { id, totalScore, createdAt },
//      overall: { ... },
//      bySubject: [ ... ],
//      byTopic: [ ... ],
//      byDifficulty: { ... },
//      weakTopics: [ ... ]
//    }
//  }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { requireUserId } from '@/app/lib/auth';

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(req: NextRequest, context: RouteContext) {
  const mockId = context.params.id;

  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Auth error in GET /api/mocks/[id]/analysis:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const submissionId = url.searchParams.get('submissionId');

  try {
    // 1) Load mock with question meta (marks, subject, topics, difficulty)
    const mock = await prisma.mock.findUnique({
      where: { id: mockId },
      include: {
        questions: {
          include: {
            question: {
              include: {
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

    // 2) Find the submission: by id or latest submission for this user
    let submission = null;

    if (submissionId) {
      submission = await prisma.mockSubmission.findFirst({
        where: {
          id: submissionId,
          mockId,
          userId,
        },
        include: {
          responses: true,
        },
      });
    } else {
      submission = await prisma.mockSubmission.findFirst({
        where: {
          mockId,
          userId,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          responses: true,
        },
      });
    }

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found for this mock and user' },
        { status: 404 },
      );
    }

    /* ------------------------------------------------------------------
       Build maps for quick lookup
       ------------------------------------------------------------------ */

    const questionMetaMap = new Map<
      string,
      {
        marks: number;
        difficulty: string;
        subjectId: string | null;
        subjectName: string | null;
        topicIds: string[];
        topicNames: string[];
      }
    >();

    let maxScore = 0;

    for (const mq of mock.questions) {
      const q = mq.question;
      const subjectId = q.subject?.id ?? null;
      const subjectName = q.subject?.name ?? null;
      const topicIds = q.topics.map((t) => t.topic.id);
      const topicNames = q.topics.map((t) => t.topic.name);

      questionMetaMap.set(q.id, {
        marks: q.marks,
        difficulty: q.difficulty,
        subjectId,
        subjectName,
        topicIds,
        topicNames,
      });

      maxScore += q.marks;
    }

    /* ------------------------------------------------------------------
       Aggregate stats
       ------------------------------------------------------------------ */

    const overall = {
      totalQuestions: mock.questions.length,
      attempted: 0,
      correct: 0,
      totalScore: submission.totalScore,
      maxScore,
      accuracy: 0,
      avgTimePerQuestion: 0,
      totalTimeTaken: 0,
    };

    type SubjectAgg = {
      subjectId: string;
      subjectName: string;
      totalQuestions: number;
      attempted: number;
      correct: number;
      score: number;
    };

    type TopicAgg = {
      topicId: string;
      topicName: string;
      totalQuestions: number;
      attempted: number;
      correct: number;
      score: number;
    };

    const subjectStats = new Map<string, SubjectAgg>();
    const topicStats = new Map<string, TopicAgg>();

    const difficultyStats = {
      EASY: { totalQuestions: 0, attempted: 0, correct: 0 },
      MEDIUM: { totalQuestions: 0, attempted: 0, correct: 0 },
      HARD: { totalQuestions: 0, attempted: 0, correct: 0 },
    };

    // Initialize difficulty totals by question
    for (const mq of mock.questions) {
      const q = mq.question;
      const d = q.difficulty as 'EASY' | 'MEDIUM' | 'HARD';
      if (difficultyStats[d]) {
        difficultyStats[d].totalQuestions += 1;
      }
    }

    // Create a map of responses by questionId
    const responseByQuestionId = new Map(
      submission.responses.map((r) => [r.questionId, r]),
    );

    // Iterate over questions and match responses
    for (const mq of mock.questions) {
      const q = mq.question;
      const meta = questionMetaMap.get(q.id);
      if (!meta) continue;

      const resp = responseByQuestionId.get(q.id);
      const attempted = !!resp;
      const isCorrect = resp?.isCorrect ?? false;
      const timeTaken = resp?.timeTakenSeconds ?? 0;

      // Overall
      if (attempted) overall.attempted += 1;
      if (isCorrect) overall.correct += 1;
      overall.totalTimeTaken += timeTaken;

      // Subject-level
      if (meta.subjectId && meta.subjectName) {
        let stat = subjectStats.get(meta.subjectId);
        if (!stat) {
          stat = {
            subjectId: meta.subjectId,
            subjectName: meta.subjectName,
            totalQuestions: 0,
            attempted: 0,
            correct: 0,
            score: 0,
          };
          subjectStats.set(meta.subjectId, stat);
        }
        stat.totalQuestions += 1;
        if (attempted) stat.attempted += 1;
        if (isCorrect) {
          stat.correct += 1;
          stat.score += meta.marks;
        }
      }

      // Topic-level
      meta.topicIds.forEach((topicId, idx) => {
        const topicName = meta.topicNames[idx] ?? 'Unknown';
        let stat = topicStats.get(topicId);
        if (!stat) {
          stat = {
            topicId,
            topicName,
            totalQuestions: 0,
            attempted: 0,
            correct: 0,
            score: 0,
          };
          topicStats.set(topicId, stat);
        }
        stat.totalQuestions += 1;
        if (attempted) stat.attempted += 1;
        if (isCorrect) {
          stat.correct += 1;
          stat.score += meta.marks;
        }
      });

      // Difficulty-level
      const d = q.difficulty as 'EASY' | 'MEDIUM' | 'HARD';
      const dStat = difficultyStats[d];
      if (dStat) {
        if (attempted) dStat.attempted += 1;
        if (isCorrect) dStat.correct += 1;
      }
    }

    // Final overall calculations
    overall.accuracy =
      overall.attempted > 0 ? overall.correct / overall.attempted : 0;
    overall.avgTimePerQuestion =
      overall.attempted > 0 ? overall.totalTimeTaken / overall.attempted : 0;

    // Convert subject / topic maps to arrays with accuracy
    const bySubject = Array.from(subjectStats.values()).map((s) => ({
      ...s,
      accuracy: s.attempted > 0 ? s.correct / s.attempted : 0,
    }));

    const byTopic = Array.from(topicStats.values()).map((t) => ({
      ...t,
      accuracy: t.attempted > 0 ? t.correct / t.attempted : 0,
    }));

    // Difficulty stats with accuracy
    const byDifficulty = {
      EASY: {
        ...difficultyStats.EASY,
        accuracy:
          difficultyStats.EASY.attempted > 0
            ? difficultyStats.EASY.correct / difficultyStats.EASY.attempted
            : 0,
      },
      MEDIUM: {
        ...difficultyStats.MEDIUM,
        accuracy:
          difficultyStats.MEDIUM.attempted > 0
            ? difficultyStats.MEDIUM.correct / difficultyStats.MEDIUM.attempted
            : 0,
      },
      HARD: {
        ...difficultyStats.HARD,
        accuracy:
          difficultyStats.HARD.attempted > 0
            ? difficultyStats.HARD.correct / difficultyStats.HARD.attempted
            : 0,
      },
    };

    // Weak topics (basic recommendation logic):
    // - attempted >= 3 questions
    // - accuracy < 60%
    const weakTopics = byTopic
      .filter((t) => t.attempted >= 3 && t.accuracy < 0.6)
      .sort((a, b) => a.accuracy - b.accuracy) // weakest first
      .map((t) => ({
        topicId: t.topicId,
        topicName: t.topicName,
        attempted: t.attempted,
        correct: t.correct,
        accuracy: t.accuracy,
      }));

    const payload = {
      mock: {
        id: mock.id,
        name: mock.name,
        timeLimit: mock.timeLimit,
        createdAt: mock.createdAt,
      },
      submission: {
        id: submission.id,
        totalScore: submission.totalScore,
        createdAt: submission.createdAt,
      },
      overall,
      bySubject,
      byTopic,
      byDifficulty,
      weakTopics,
    };

    return NextResponse.json({ data: payload });
  } catch (err) {
    console.error('GET /api/mocks/[id]/analysis error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
