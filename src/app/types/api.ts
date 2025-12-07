// types/api.ts
//
// Shared TypeScript types for your exam platform.
// Use these on the frontend (and optionally in backend route handlers)
// so that your UI is always in sync with API responses & schema.

export type QuestionType = 'MCQ' | 'MSQ' | 'NAT';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

/* -------------------- Core entities -------------------- */

export interface Exam {
  id: string;
  code: string; // e.g. "GATE_CSE"
  name: string;
  createdAt: string; // ISO datetime
  updatedAt: string;
}

export interface Subject {
  id: string;
  name: string;
  examId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: string;
  name: string;
  subjectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

/* -------------------- Questions -------------------- */

// Minimal question listing item (used in /api/questions)
export interface QuestionListItem {
  id: string;
  question: string;
  year: number;
  shift: string | null;
  marks: number;
  type: QuestionType;
  difficulty: Difficulty;
  isFormulaBased: boolean;
  hasSolution: boolean;
  createdAt: string;

  subject: {
    id: string;
    name: string;
  } | null;

  topics: {
    id: string;
    name: string;
  }[];

  tags: {
    id: string;
    name: string;
    slug: string;
  }[];
}

export interface QuestionListResponse {
  data: QuestionListItem[];
  pagination: {
    total: number;
    take: number;
    skip: number;
  };
  filters: {
    examCode: string;
    subjectId: string | null;
    topicIds: string[];
    yearFrom: number | null;
    yearTo: number | null;
    difficulties: Difficulty[];
    types: QuestionType[];
    marks: number[];
    formulaBased: boolean | null;
    hasSolution: boolean | null;
    tagIds: string[];
    tagSlugs: string[];
    onlyBookmarked: boolean;
    onlyUnattempted: boolean;
    sortBy: string;
  };
}

/* ---------- Full question (detail view) ---------- */

export interface QuestionOption {
  id: string;
  label: string; // "A", "B", ...
  text: string;
  isCorrect: boolean; // Frontend can decide when to reveal
}

export interface QuestionSolution {
  id: string;
  answerText: string;
  explanation: string;
}

export interface QuestionStats {
  attempts: number;
  correct: number;
  correctRate: number | null; // 0–1 or null if no attempts
}

export interface QuestionDetail {
  id: string;
  examId: string;
  subject: {
    id: string;
    name: string;
  } | null;
  year: number;
  shift: string | null;
  marks: number;
  type: QuestionType;
  difficulty: Difficulty;
  isFormulaBased: boolean;
  hasSolution: boolean;
  question: string;
  createdAt: string;
  updatedAt: string;

  options: QuestionOption[];
  solution: QuestionSolution | null;

  topics: {
    id: string;
    name: string;
  }[];

  tags: {
    id: string;
    name: string;
    slug: string;
  }[];

  isBookmarked: boolean;
  stats: QuestionStats;
}

export interface QuestionDetailResponse {
  data: QuestionDetail;
}

/* ---------- Question attempt (practice mode) ---------- */

export interface QuestionAttemptResponseData {
  attemptId: string;
  isCorrect: boolean;
  correctOptionIds: string[];
  correctNumericAnswer: number | null;
}

export interface QuestionAttemptResponse {
  data: QuestionAttemptResponseData;
}

/* ---------- Bookmark toggle ---------- */

export interface BookmarkToggleResponse {
  data: {
    isBookmarked: boolean;
  };
}

/* ---------- Difficulty feedback ---------- */

export interface QuestionFeedbackStats {
  counts: {
    EASY: number;
    MEDIUM: number;
    HARD: number;
  };
  total: number;
}

export interface QuestionFeedbackStatsResponse {
  data: QuestionFeedbackStats;
}

/* -------------------- Mocks -------------------- */

export interface MockQuestionItem {
  id: string; // MockQuestion id
  order: number;
  questionId: string;
  question: {
    question: any;
    id: string;
    year: number;
    shift: string | null;
    marks: number;
    type: QuestionType;
    difficulty: Difficulty;
    isFormulaBased: boolean;
    questionText: string;
    subject: {
      id: string;
      name: string;
    } | null;
    topics: {
      id: string;
      name: string;
    }[];
    options: QuestionOption[];
  };
}

export interface MockLatestSubmissionSummary {
  id: string;
  totalScore: number;
  createdAt: string;
}

export interface MockDetail {
  id: string;
  name: string;
  timeLimit: number | null;
  createdAt: string;
  latestSubmission: MockLatestSubmissionSummary | null;
  questions: MockQuestionItem[];
}

export interface MockDetailResponse {
  data: MockDetail;
}

export interface CreatedMockQuestionSummary {
  id: string; // MockQuestion id
  order: number;
  questionId: string;
  question: {
    id: string;
    year: number;
    shift: string | null;
    marks: number;
    type: QuestionType;
    difficulty: Difficulty;
    isFormulaBased: boolean;
    subject: {
      id: string;
      name: string;
    } | null;
    topics: {
      id: string;
      name: string;
    }[];
  };
}

export interface CreatedMock {
  id: string;
  name: string;
  timeLimit: number | null;
  createdAt: string;
  questions: CreatedMockQuestionSummary[];
}

export interface CreatedMockResponse {
  data: CreatedMock;
}

/* ---------- Mock submission ---------- */

export interface MockSubmittedQuestionResult {
  questionId: string;
  selectedOptionId?: string;
  numericAnswer?: number;
  isCorrect: boolean;
  correctOptionIds?: string[];
  correctNumericAnswer?: number | null;
  timeTakenSeconds: number;
}

export interface MockSubmitResponse {
  data: {
    submissionId: string;
    totalScore: number;
    responses: MockSubmittedQuestionResult[];
  };
}

/* ---------- Mock analysis ---------- */

export interface MockOverallStats {
  totalQuestions: number;
  attempted: number;
  correct: number;
  totalScore: number;
  maxScore: number;
  accuracy: number; // 0–1
  avgTimePerQuestion: number; // seconds
  totalTimeTaken: number; // seconds
}

export interface SubjectAnalysis {
  subjectId: string;
  subjectName: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  score: number;
  accuracy: number; // 0–1
}

export interface TopicAnalysis {
  topicId: string;
  topicName: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  score: number;
  accuracy: number; // 0–1
}

export interface DifficultyBucketStats {
  totalQuestions: number;
  attempted: number;
  correct: number;
  accuracy: number; // 0–1
}

export interface MockAnalysisData {
  mock: {
    id: string;
    name: string;
    timeLimit: number | null;
    createdAt: string;
  };
  submission: {
    id: string;
    totalScore: number;
    createdAt: string;
  };
  overall: MockOverallStats;
  bySubject: SubjectAnalysis[];
  byTopic: TopicAnalysis[];
  byDifficulty: {
    EASY: DifficultyBucketStats;
    MEDIUM: DifficultyBucketStats;
    HARD: DifficultyBucketStats;
  };
  weakTopics: {
    topicId: string;
    topicName: string;
    attempted: number;
    correct: number;
    accuracy: number;
  }[];
}

export interface MockAnalysisResponse {
  data: MockAnalysisData;
}

/* -------------------- Admin entities -------------------- */

export interface AdminExam {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminExamListResponse {
  data: AdminExam[];
}

export interface AdminExamResponse {
  data: AdminExam;
}

export interface AdminSubjectResponse {
  data: Subject;
}

export interface AdminSubjectsByExamResponse {
  data: {
    exam: {
      id: string;
      code: string;
      name: string;
    };
    subjects: {
      id: string;
      name: string;
      examId: string;
      createdAt: string;
      updatedAt: string;
    }[];
  };
}

export interface AdminTopicsForSubjectResponse {
  data: {
    subject: {
      id: string;
      name: string;
      examId: string;
      exam: {
        code: string;
        name: string;
      };
    };
    topics: {
      id: string;
      name: string;
      subjectId: string;
      createdAt: string;
      updatedAt: string;
    }[];
  };
}

export interface AdminTopicsByExamResponse {
  data: {
    exam: {
      id: string;
      code: string;
      name: string;
    };
    subjects: {
      id: string;
      name: string;
      topics: {
        id: string;
        name: string;
        subjectId: string;
        createdAt: string;
        updatedAt: string;
      }[];
    }[];
  };
}

export interface AdminTagsListResponse {
  data: Tag[];
}

export interface AdminTagResponse {
  data: Tag;
}

export interface AdminQuestionSummary {
  id: string;
  examId: string;
  subject: { id: string; name: string } | null;
  year: number;
  shift: string | null;
  marks: number;
  type: QuestionType;
  difficulty: Difficulty;
  isFormulaBased: boolean;
  question: string;
  hasSolution: boolean;
  topics: { id: string; name: string }[];
  tags: { id: string; name: string; slug: string }[];
  options: QuestionOption[];
  solution: QuestionSolution | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminQuestionResponse {
  data: AdminQuestionSummary;
}
