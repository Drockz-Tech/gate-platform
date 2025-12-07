// prisma/seed.ts

import 'dotenv/config';
// IMPORT FROM YOUR GENERATED LOCATION
// Make sure this path matches where you generated the client in schema.prisma
import { PrismaClient, Difficulty, QuestionType } from '../src/generated/client';

// --- FIX: Initialize with 'log' ---
// This satisfies the "non-empty options" rule while avoiding the "unknown property: datasources" error.
// The client will automatically pick up DATABASE_URL from .env because of 'dotenv/config'.
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db'
})

export const prisma = new PrismaClient({ adapter })
async function main() {
  console.log('🚀 Seeding started...');

  /* -------------------- 1. Exam -------------------- */

  const exam = await prisma.exam.upsert({
    where: { code: 'GATE_CSE' },
    update: {},
    create: {
      code: 'GATE_CSE',
      name: 'GATE Computer Science and Information Technology',
    },
  });

  console.log('✅ Exam upserted:', exam.code);

  /* -------------------- 2. Subjects -------------------- */

  const subjectNames = [
    'Discrete Mathematics',
    'Digital Logic',
    'Computer Organization and Architecture',
    'Programming & Data Structures',
    'Algorithms',
    'Theory of Computation',
    'Compiler Design',
    'Operating Systems',
    'Databases',
    'Computer Networks',
    'Software Engineering',
    'Engineering Mathematics',
  ];

  const subjectsByName: Record<string, string> = {};

  for (const name of subjectNames) {
    const subject = await prisma.subject.upsert({
      where: {
        examId_name: {
          examId: exam.id,
          name,
        },
      },
      update: {},
      create: {
        examId: exam.id,
        name,
      },
    });

    subjectsByName[name] = subject.id;
  }

  console.log('✅ Subjects upserted:', Object.keys(subjectsByName).length);

  /* -------------------- 3. Topics (sample set) -------------------- */

  type TopicSeed = {
    subjectName: string;
    topics: string[];
  };

  const topicSeeds: TopicSeed[] = [
    {
      subjectName: 'Operating Systems',
      topics: [
        'Process Concepts',
        'CPU Scheduling',
        'Deadlocks',
        'Process Synchronization',
        'Memory Management',
        'File Systems',
      ],
    },
    {
      subjectName: 'Databases',
      topics: [
        'ER Modelling',
        'Relational Algebra',
        'Normalization',
        'Indexing',
        'Transactions & Concurrency',
      ],
    },
    {
      subjectName: 'Computer Networks',
      topics: [
        'OSI & TCP/IP Models',
        'Error Control & Flow Control',
        'IP Addressing & Subnetting',
        'Routing Algorithms',
        'Transport Layer (TCP/UDP)',
      ],
    },
    {
      subjectName: 'Algorithms',
      topics: [
        'Asymptotic Analysis',
        'Divide and Conquer',
        'Greedy Algorithms',
        'Dynamic Programming',
        'Graph Algorithms',
      ],
    },
  ];

  const topicsByName: Record<string, string> = {};

  for (const group of topicSeeds) {
    const subjectId = subjectsByName[group.subjectName];
    if (!subjectId) {
      console.warn(
        `⚠️ Subject not found for topics seeding: ${group.subjectName}`,
      );
      continue;
    }

    for (const topicName of group.topics) {
      const topic = await prisma.topic.upsert({
        where: {
          subjectId_name: {
            subjectId,
            name: topicName,
          },
        },
        update: {},
        create: {
          subjectId,
          name: topicName,
        },
      });

      topicsByName[`${group.subjectName}::${topicName}`] = topic.id;
    }
  }

  console.log('✅ Topics upserted:', Object.keys(topicsByName).length);

  /* -------------------- 4. Tags -------------------- */

  function slugify(input: string): string {
    return input
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const tagNames = [
    'High Weightage',
    'Tricky',
    'Must Revise',
    'GATE 2024 Pattern',
  ];

  const tagsByName: Record<string, string> = {};

  for (const name of tagNames) {
    const slug = slugify(name);
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: {
        name,
      },
      create: {
        name,
        slug,
      },
    });

    tagsByName[name] = tag.id;
  }

  console.log('✅ Tags upserted:', Object.keys(tagsByName).length);

  /* -------------------- 5. Example Question -------------------- */

  const osSubjectId = subjectsByName['Operating Systems'];
  const cpuSchedulingTopicId =
    topicsByName['Operating Systems::CPU Scheduling'];

  if (!osSubjectId || !cpuSchedulingTopicId) {
    console.warn(
      '⚠️ Skipping example question seeding (OS or CPU Scheduling topic missing)',
    );
  } else {
    // We’ll identify this example question by a unique combo (examId + year + marks + question snippet)
    const QUESTION_SNIPPET =
      'Which of the following CPU scheduling algorithms is non-preemptive';

    // Check if a similar question already exists
    const existing = await prisma.question.findFirst({
      where: {
        examId: exam.id,
        subjectId: osSubjectId,
        year: 2023,
        marks: 2,
        question: {
          contains: QUESTION_SNIPPET,
        },
      },
      select: { id: true },
    });

    if (existing) {
      console.log('ℹ️ Example question already exists, skipping creation.');
    } else {
      const questionText =
        'Which of the following CPU scheduling algorithms is non-preemptive?';

      // Create question
      const question = await prisma.question.create({
        data: {
          examId: exam.id,
          subjectId: osSubjectId,
          year: 2023,
          shift: 'Shift 1',
          question: questionText,
          marks: 2,
          type: QuestionType.MCQ,
          difficulty: Difficulty.MEDIUM,
          isFormulaBased: false,
          hasSolution: true,
        },
      });

      // Attach topic
      await prisma.questionTopic.create({
        data: {
          questionId: question.id,
          topicId: cpuSchedulingTopicId,
        },
      });

      // Attach tags: High Weightage + Must Revise
      const tagIdsToAttach = [
        tagsByName['High Weightage'],
        tagsByName['Must Revise'],
      ].filter(Boolean);

      if (tagIdsToAttach.length > 0) {
        await prisma.questionTag.createMany({
          data: tagIdsToAttach.map((tagId) => ({
            questionId: question.id,
            tagId,
          })),
        });
      }

      // Create options
      const options = [
        {
          label: 'A',
          text: 'Round Robin',
          isCorrect: false,
        },
        {
          label: 'B',
          text: 'Shortest Remaining Time First (SRTF)',
          isCorrect: false,
        },
        {
          label: 'C',
          text: 'First-Come First-Served (FCFS)',
          isCorrect: true,
        },
        {
          label: 'D',
          text: 'Preemptive Priority Scheduling',
          isCorrect: false,
        },
      ];

      await prisma.option.createMany({
        data: options.map((opt) => ({
          questionId: question.id,
          label: opt.label,
          text: opt.text,
          isCorrect: opt.isCorrect,
        })),
      });

      // Create solution
      await prisma.solution.create({
        data: {
          questionId: question.id,
          answerText: 'FCFS',
          explanation:
            'FCFS is a non-preemptive scheduling algorithm. Once a process is given the CPU, it runs until completion or blocking. Round Robin, SRTF, and preemptive priority scheduling are all preemptive algorithms.',
        },
      });

      console.log('✅ Example question created with id:', question.id);
    }
  }

  console.log('🎉 Seeding completed.');
}

/* -------------------- main runner -------------------- */

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });