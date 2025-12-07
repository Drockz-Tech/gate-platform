-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subject_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "subjectId" TEXT,
    "year" INTEGER NOT NULL,
    "shift" TEXT,
    "question" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "hasSolution" BOOLEAN NOT NULL DEFAULT false,
    "isFormulaBased" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionTopic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    CONSTRAINT "QuestionTopic_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Solution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    CONSTRAINT "Solution_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuestionTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionTag_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "numericAnswer" REAL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeTakenSeconds" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bookmark_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionFeedback_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "questionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuestionReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timeLimit" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MockQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mockId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "MockQuestion_mockId_fkey" FOREIGN KEY ("mockId") REFERENCES "Mock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MockQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MockSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mockId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MockSubmission_mockId_fkey" FOREIGN KEY ("mockId") REFERENCES "Mock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MockSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MockQuestionResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "numericAnswer" REAL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeTakenSeconds" INTEGER NOT NULL,
    CONSTRAINT "MockQuestionResponse_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "MockSubmission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MockQuestionResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_code_key" ON "Exam"("code");

-- CreateIndex
CREATE INDEX "Exam_code_idx" ON "Exam"("code");

-- CreateIndex
CREATE INDEX "Subject_examId_idx" ON "Subject"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_examId_name_key" ON "Subject"("examId", "name");

-- CreateIndex
CREATE INDEX "Topic_subjectId_idx" ON "Topic"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_subjectId_name_key" ON "Topic"("subjectId", "name");

-- CreateIndex
CREATE INDEX "Question_examId_year_idx" ON "Question"("examId", "year");

-- CreateIndex
CREATE INDEX "Question_examId_subjectId_idx" ON "Question"("examId", "subjectId");

-- CreateIndex
CREATE INDEX "Question_examId_difficulty_idx" ON "Question"("examId", "difficulty");

-- CreateIndex
CREATE INDEX "Question_examId_type_idx" ON "Question"("examId", "type");

-- CreateIndex
CREATE INDEX "Question_examId_isFormulaBased_idx" ON "Question"("examId", "isFormulaBased");

-- CreateIndex
CREATE INDEX "Question_subjectId_year_idx" ON "Question"("subjectId", "year");

-- CreateIndex
CREATE INDEX "QuestionTopic_topicId_idx" ON "QuestionTopic"("topicId");

-- CreateIndex
CREATE INDEX "QuestionTopic_questionId_idx" ON "QuestionTopic"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionTopic_questionId_topicId_key" ON "QuestionTopic"("questionId", "topicId");

-- CreateIndex
CREATE INDEX "Option_questionId_idx" ON "Option"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Solution_questionId_key" ON "Solution"("questionId");

-- CreateIndex
CREATE INDEX "Solution_questionId_idx" ON "Solution"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Tag_slug_idx" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "QuestionTag_tagId_idx" ON "QuestionTag"("tagId");

-- CreateIndex
CREATE INDEX "QuestionTag_questionId_idx" ON "QuestionTag"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionTag_questionId_tagId_key" ON "QuestionTag"("questionId", "tagId");

-- CreateIndex
CREATE INDEX "QuestionAttempt_userId_idx" ON "QuestionAttempt"("userId");

-- CreateIndex
CREATE INDEX "QuestionAttempt_questionId_idx" ON "QuestionAttempt"("questionId");

-- CreateIndex
CREATE INDEX "QuestionAttempt_userId_questionId_idx" ON "QuestionAttempt"("userId", "questionId");

-- CreateIndex
CREATE INDEX "QuestionAttempt_questionId_isCorrect_idx" ON "QuestionAttempt"("questionId", "isCorrect");

-- CreateIndex
CREATE INDEX "Bookmark_userId_idx" ON "Bookmark"("userId");

-- CreateIndex
CREATE INDEX "Bookmark_questionId_idx" ON "Bookmark"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_questionId_key" ON "Bookmark"("userId", "questionId");

-- CreateIndex
CREATE INDEX "QuestionFeedback_userId_idx" ON "QuestionFeedback"("userId");

-- CreateIndex
CREATE INDEX "QuestionFeedback_questionId_idx" ON "QuestionFeedback"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionFeedback_userId_questionId_key" ON "QuestionFeedback"("userId", "questionId");

-- CreateIndex
CREATE INDEX "QuestionReport_questionId_idx" ON "QuestionReport"("questionId");

-- CreateIndex
CREATE INDEX "QuestionReport_userId_idx" ON "QuestionReport"("userId");

-- CreateIndex
CREATE INDEX "Mock_userId_idx" ON "Mock"("userId");

-- CreateIndex
CREATE INDEX "MockQuestion_mockId_idx" ON "MockQuestion"("mockId");

-- CreateIndex
CREATE INDEX "MockQuestion_questionId_idx" ON "MockQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "MockQuestion_mockId_questionId_key" ON "MockQuestion"("mockId", "questionId");

-- CreateIndex
CREATE INDEX "MockSubmission_mockId_idx" ON "MockSubmission"("mockId");

-- CreateIndex
CREATE INDEX "MockSubmission_userId_idx" ON "MockSubmission"("userId");

-- CreateIndex
CREATE INDEX "MockSubmission_mockId_userId_idx" ON "MockSubmission"("mockId", "userId");

-- CreateIndex
CREATE INDEX "MockQuestionResponse_submissionId_idx" ON "MockQuestionResponse"("submissionId");

-- CreateIndex
CREATE INDEX "MockQuestionResponse_questionId_idx" ON "MockQuestionResponse"("questionId");
