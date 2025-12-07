// app/api/admin/questions/route.ts
//
// Admin API for creating/updating questions with full metadata.
//
// POST /api/admin/questions
//
// Body:
//   {
//     "id": "optional-question-id-if-updating",
//
//     "examCode": "GATE_CSE",
//     "subjectId": "subj_os_id",
//
//     "year": 2023,
//     "shift": "Shift 1",
//     "marks": 2,
//     "type": "MCQ",              // MCQ | MSQ | NAT
//     "difficulty": "MEDIUM",     // EASY | MEDIUM | HARD
//     "isFormulaBased": true,
//     "question": "Question text...",
//
//     "topicIds": ["topic1", "topic2"],
//     "tagIds": ["tag1", "tag2"],
//     "tagSlugs": ["high-weightage"],
//
//     "options": [
//       { "label": "A", "text": "Option A", "isCorrect": false },
//       { "label": "B", "text": "Option B", "isCorrect": true  }
//     ],
//
//     "solution": {
//       "answerText": "Final answer (text or numeric as string)",
//       "explanation": "Detailed explanation (markdown/HTML/LaTeX)"
//     }
//   }
//
// Behaviour:
//   - If "id" is present → update existing question:
//       * Update core fields
//       * Replace options, topics, tags, solution with provided ones
//   - Else → create new question + related records.
//
// Returns:
//   { data: { ...createdOrUpdatedQuestionSummary } }

import { NextRequest, NextResponse } from 'next/server';
import { Difficulty, QuestionType } from '@prisma/client';
import { prisma } from '@/app/lib/prisma';
import { requireUserId } from '@/app/lib/auth';

// Simple admin guard (same pattern as other admin routes)
async function requireAdminUserId(): Promise<string> {
  const userId = await requireUserId();
  // TODO: enforce admin role later
  return userId;
}

/* -------------------- types -------------------- */

type OptionInput = {
  label?: string;
  text?: string;
  isCorrect?: boolean;
};

type SolutionInput = {
  answerText?: string;
  explanation?: string | null;
};

type QuestionBody = {
  id?: string;

  examCode?: string;
  subjectId?: string;

  year?: number;
  shift?: string;
  marks?: number;
  type?: QuestionType | string;
  difficulty?: Difficulty | string;
  isFormulaBased?: boolean;
  question?: string;

  topicIds?: string[];
  tagIds?: string[];
  tagSlugs?: string[];

  options?: OptionInput[];
  solution?: SolutionInput | null;
};

/* -------------------- helpers -------------------- */

function normalizeEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
): T | null {
  if (!raw) return null;
  const value = raw.toString().toUpperCase() as T;
  return allowed.includes(value) ? value : null;
}

/* -------------------- POST handler -------------------- */

export async function POST(req: NextRequest) {
  try {
    await requireAdminUserId();
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Auth error in POST /api/admin/questions:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }

  let body: QuestionBody;
  try {
    body = (await req.json()) as QuestionBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const id = body.id?.toString().trim() || undefined;

  const examCode = body.examCode?.toString().trim();
  const subjectId = body.subjectId?.toString().trim();

  const year =
    typeof body.year === 'number' ? body.year : Number(body.year ?? NaN);
  const shift = body.shift?.toString().trim() || null;
  const marks =
    typeof body.marks === 'number' ? body.marks : Number(body.marks ?? NaN);
  const isFormulaBased =
    typeof body.isFormulaBased === 'boolean' ? body.isFormulaBased : false;
  const questionText = body.question?.toString().trim();

  const type = normalizeEnum<QuestionType>(body.type, ['MCQ', 'MSQ', 'NAT']);
  const difficulty = normalizeEnum<Difficulty>(body.difficulty, [
    'EASY',
    'MEDIUM',
    'HARD',
  ]);

  const topicIds = Array.isArray(body.topicIds) ? body.topicIds : [];
  const tagIds = Array.isArray(body.tagIds) ? body.tagIds : [];
  const tagSlugs = Array.isArray(body.tagSlugs) ? body.tagSlugs : [];

  const options = Array.isArray(body.options) ? body.options : [];
  const solution = body.solution ?? null;

  // Basic validations
  if (!examCode) {
    return NextResponse.json(
      { error: '"examCode" is required' },
      { status: 400 },
    );
  }
  if (!subjectId) {
    return NextResponse.json(
      { error: '"subjectId" is required' },
      { status: 400 },
    );
  }
  if (!questionText) {
    return NextResponse.json(
      { error: '"question" is required' },
      { status: 400 },
    );
  }
  if (!Number.isFinite(year)) {
    return NextResponse.json(
      { error: '"year" must be a valid number' },
      { status: 400 },
    );
  }
  if (!Number.isFinite(marks) || marks <= 0) {
    return NextResponse.json(
      { error: '"marks" must be a positive number' },
      { status: 400 },
    );
  }
  if (!type) {
    return NextResponse.json(
      { error: '"type" must be one of MCQ | MSQ | NAT' },
      { status: 400 },
    );
  }
  if (!difficulty) {
    return NextResponse.json(
      { error: '"difficulty" must be one of EASY | MEDIUM | HARD' },
      { status: 400 },
    );
  }

  // For non-NAT, options are required with at least one correct
  if (type !== 'NAT') {
    if (!options || options.length === 0) {
      return NextResponse.json(
        { error: '"options" are required for non-NAT questions' },
        { status: 400 },
      );
    }

    const normalizedOptions = options
      .map((opt) => ({
        label: opt.label?.toString().trim(),
        text: opt.text?.toString().trim(),
        isCorrect: Boolean(opt.isCorrect),
      }))
      .filter((opt) => opt.label && opt.text);

    if (normalizedOptions.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid option is required' },
        { status: 400 },
      );
    }

    const hasCorrect = normalizedOptions.some((opt) => opt.isCorrect);
    if (!hasCorrect) {
      return NextResponse.json(
        { error: 'At least one option must be marked as correct' },
        { status: 400 },
      );
    }

    // Replace with cleaned options
    (body as any).options = normalizedOptions;
  }

  // For NAT, we expect a solution with numeric answerText (but we won't over-validate here).
  if (type === 'NAT' && !solution?.answerText) {
    return NextResponse.json(
      { error: 'NAT questions require solution.answerText' },
      { status: 400 },
    );
  }

  try {
    // Check related entities (exam, subject) exist
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

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, examId: true },
    });

    if (!subject || subject.examId !== exam.id) {
      return NextResponse.json(
        { error: 'Subject not found for this exam or mismatched examId' },
        { status: 400 },
      );
    }

    // Resolve tags by slug if provided
    let resolvedTagIds = [...tagIds];

    if (tagSlugs.length > 0) {
      const tagsBySlug = await prisma.tag.findMany({
        where: {
          slug: {
            in: tagSlugs.map((s) => s.toString().trim().toLowerCase()),
          },
        },
        select: { id: true, slug: true },
      });

      const slugToId = new Map(tagsBySlug.map((t) => [t.slug, t.id]));
      for (const slug of tagSlugs) {
        const key = slug.toString().trim().toLowerCase();
        const idFromSlug = slugToId.get(key);
        if (idFromSlug && !resolvedTagIds.includes(idFromSlug)) {
          resolvedTagIds.push(idFromSlug);
        }
      }
    }

    // We’ll treat question creation/update as a transaction
    const result = await prisma.$transaction(async (tx) => {
      let questionId = id;

      if (!questionId) {
        // Create new question
        const created = await tx.question.create({
          data: {
            examId: exam.id,
            subjectId: subject.id,
            year,
            shift,
            question: questionText,
            marks,
            type,
            difficulty,
            isFormulaBased,
            hasSolution: !!solution,
          },
        });
        questionId = created.id;
      } else {
        // Update existing
        const existing = await tx.question.findUnique({
          where: { id: questionId },
          select: { id: true },
        });

        if (!existing) {
          throw new Error('QUESTION_NOT_FOUND');
        }

        await tx.question.update({
          where: { id: questionId },
          data: {
            examId: exam.id,
            subjectId: subject.id,
            year,
            shift,
            question: questionText,
            marks,
            type,
            difficulty,
            isFormulaBased,
            hasSolution: !!solution,
          },
        });
      }

      if (!questionId) throw new Error('FAILED_TO_GET_QUESTION_ID');

      // Replace topics
      if (topicIds && topicIds.length > 0) {
        await tx.questionTopic.deleteMany({
          where: { questionId },
        });

        await tx.questionTopic.createMany({
          data: topicIds.map((topicId) => ({
            questionId,
            topicId,
          })),
        //   skipDuplicates: true,
        });
      }

      // Replace tags
      if (resolvedTagIds.length > 0) {
        await tx.questionTag.deleteMany({
          where: { questionId },
        });

        await tx.questionTag.createMany({
          data: resolvedTagIds.map((tagId) => ({
            questionId,
            tagId,
          })),
        //   skipDuplicates: true,
        });
      }

      // Replace options for non-NAT
      if (type !== 'NAT') {
        await tx.option.deleteMany({
          where: { questionId },
        });

        const opts = (body.options ?? []) as Required<OptionInput>[];
        if (opts.length > 0) {
          await tx.option.createMany({
            data: opts.map((opt) => ({
              questionId,
              label: opt.label!.toString().trim(),
              text: opt.text!.toString().trim(),
              isCorrect: !!opt.isCorrect,
            })),
          });
        }
      } else {
        // NAT: clear any existing options (if we ever changed type)
        await tx.option.deleteMany({
          where: { questionId },
        });
      }

      // Upsert solution
      if (solution && solution.answerText) {
        await tx.solution.upsert({
          where: { questionId },
          create: {
            questionId,
            answerText: solution.answerText.toString(),
            explanation: solution.explanation ?? '',
          },
          update: {
            answerText: solution.answerText.toString(),
            explanation: solution.explanation ?? '',
          },
        });
      } else {
        // If no solution provided, remove any existing solution
        await tx.solution.deleteMany({
          where: { questionId },
        });
      }

      // Return a summary
      const final = await tx.question.findUnique({
        where: { id: questionId },
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
                select: { id: true, name: true },
              },
            },
          },
          tags: {
            include: {
              tag: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          options: true,
          solution: true,
        },
      });

      return final;
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create/update question' },
        { status: 500 },
      );
    }

    const payload = {
      id: result.id,
      examId: result.examId,
      subject: result.subject,
      year: result.year,
      shift: result.shift,
      marks: result.marks,
      type: result.type,
      difficulty: result.difficulty,
      isFormulaBased: result.isFormulaBased,
      question: result.question,
      hasSolution: result.hasSolution,
      topics: result.topics.map((qt) => qt.topic),
      tags: result.tags.map((qt) => qt.tag),
      options:
        result.options?.map((o) => ({
          id: o.id,
          label: o.label,
          text: o.text,
          isCorrect: o.isCorrect,
        })) ?? [],
      solution: result.solution
        ? {
            id: result.solution.id,
            answerText: result.solution.answerText,
            explanation: result.solution.explanation,
          }
        : null,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };

    return NextResponse.json({ data: payload });
  } catch (err: any) {
    if (err.message === 'QUESTION_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Question not found for given id' },
        { status: 404 },
      );
    }
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('POST /api/admin/questions error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
