import { 
  int, 
  mysqlEnum, 
  mysqlTable, 
  text, 
  timestamp, 
  varchar,
  boolean,
  decimal,
  json,
  longtext
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  apiKeyHash: varchar("apiKeyHash", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Subjects — user's study topics
 */
export const subjects = mysqlTable("subjects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 20 }).default("purple").notNull(), // e.g., "purple", "blue", "green"
  icon: varchar("icon", { length: 50 }), // lucide icon name
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = typeof subjects.$inferInsert;

/**
 * Documents — uploaded files (PDF, DOCX, PPTX)
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subjectId: int("subjectId").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileType: varchar("fileType", { length: 20 }).notNull(), // "pdf", "docx", "pptx"
  fileSize: int("fileSize").notNull(),
  storageKey: varchar("storageKey", { length: 255 }).notNull(), // S3 key
  extractedText: longtext("extractedText"), // Full text extracted from document
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Lessons — AI-generated study material from documents
 */
export const lessons = mysqlTable("lessons", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subjectId: int("subjectId").notNull(),
  documentId: int("documentId"),
  title: varchar("title", { length: 255 }).notNull(),
  excerpt: text("excerpt"), // Short summary
  
  // Beginner explanation
  beginnerExplanation: longtext("beginnerExplanation"),
  
  // College-level explanation
  collegeExplanation: longtext("collegeExplanation"),
  
  // Key terms (JSON array)
  keyTerms: json("keyTerms").$type<string[]>(),
  
  // Analogies (JSON array of objects with title and body)
  analogies: json("analogies").$type<Array<{ title: string; body: string }>>(),
  
  // Takeaways (JSON array)
  takeaways: json("takeaways").$type<string[]>(),
  
  // Real-world examples (JSON array)
  examples: json("examples").$type<string[]>(),
  
  // Misconceptions (JSON array)
  misconceptions: json("misconceptions").$type<string[]>(),
  
  // Suggested visual prompt for image generation
  visualPrompt: text("visualPrompt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;

/**
 * Quiz Questions — generated from lessons
 */
export const quizQuestions = mysqlTable("quizQuestions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  lessonId: int("lessonId").notNull(),
  question: text("question").notNull(),
  
  // JSON array of answer options
  options: json("options").$type<string[]>().notNull(),
  
  // Index of correct answer (0-based)
  correctAnswerIndex: int("correctAnswerIndex").notNull(),
  
  // Explanation for the correct answer
  explanation: text("explanation"),
  
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("medium").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = typeof quizQuestions.$inferInsert;

/**
 * Quiz Attempts — user's quiz responses
 */
export const quizAttempts = mysqlTable("quizAttempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  lessonId: int("lessonId").notNull(),
  questionId: int("questionId").notNull(),
  selectedAnswerIndex: int("selectedAnswerIndex").notNull(),
  isCorrect: boolean("isCorrect").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertQuizAttempt = typeof quizAttempts.$inferInsert;

/**
 * Flashcards — spaced repetition cards
 */
export const flashcards = mysqlTable("flashcards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subjectId: int("subjectId").notNull(),
  lessonId: int("lessonId"),
  
  front: text("front").notNull(), // Question or prompt
  back: text("back").notNull(), // Answer
  
  // Spaced repetition fields
  interval: int("interval").default(1).notNull(), // Days until next review
  easeFactor: decimal("easeFactor", { precision: 3, scale: 2 }).default("2.5").notNull(), // SM-2 algorithm
  nextReviewDate: timestamp("nextReviewDate").defaultNow().notNull(),
  repetitions: int("repetitions").default(0).notNull(), // Number of times reviewed
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Flashcard = typeof flashcards.$inferSelect;
export type InsertFlashcard = typeof flashcards.$inferInsert;

/**
 * Flashcard Review History — track review responses
 */
export const flashcardReviews = mysqlTable("flashcardReviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  flashcardId: int("flashcardId").notNull(),
  
  // Quality of response (0-5): 0=forgot, 1=hard, 2=ok, 3=good, 4=very good, 5=perfect
  quality: int("quality").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FlashcardReview = typeof flashcardReviews.$inferSelect;
export type InsertFlashcardReview = typeof flashcardReviews.$inferInsert;

/**
 * Notes — rich-text notes per subject
 */
export const notes = mysqlTable("notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subjectId: int("subjectId").notNull(),
  lessonId: int("lessonId"),
  
  title: varchar("title", { length: 255 }).notNull(),
  content: longtext("content").notNull(), // HTML or markdown
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

/**
 * Study Sessions — revision planner entries
 */
export const studySessions = mysqlTable("studySessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subjectId: int("subjectId").notNull(),
  
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  
  scheduledDate: timestamp("scheduledDate").notNull(),
  durationMinutes: int("durationMinutes").default(30).notNull(),
  
  status: mysqlEnum("status", ["planned", "in_progress", "completed", "skipped"]).default("planned").notNull(),
  
  actualDurationMinutes: int("actualDurationMinutes"),
  completedAt: timestamp("completedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StudySession = typeof studySessions.$inferSelect;
export type InsertStudySession = typeof studySessions.$inferInsert;

/**
 * Progress Tracking — aggregate stats per user
 */
export const progressStats = mysqlTable("progressStats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  
  // Study streak (consecutive days)
  currentStreak: int("currentStreak").default(0).notNull(),
  longestStreak: int("longestStreak").default(0).notNull(),
  lastStudyDate: timestamp("lastStudyDate"),
  
  // Daily goals
  dailyGoalMinutes: int("dailyGoalMinutes").default(60).notNull(),
  todayStudyMinutes: int("todayStudyMinutes").default(0).notNull(),
  
  // Totals
  totalLessonsCompleted: int("totalLessonsCompleted").default(0).notNull(),
  totalQuizzesTaken: int("totalQuizzesTaken").default(0).notNull(),
  totalFlashcardsReviewed: int("totalFlashcardsReviewed").default(0).notNull(),
  totalStudyMinutes: int("totalStudyMinutes").default(0).notNull(),
  
  // Average quiz score
  averageQuizScore: decimal("averageQuizScore", { precision: 5, scale: 2 }).default("0"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProgressStats = typeof progressStats.$inferSelect;
export type InsertProgressStats = typeof progressStats.$inferInsert;

/**
 * Daily Progress Log — track daily activity
 */
export const dailyProgressLog = mysqlTable("dailyProgressLog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  
  lessonsCompleted: int("lessonsCompleted").default(0).notNull(),
  quizzesTaken: int("quizzesTaken").default(0).notNull(),
  flashcardsReviewed: int("flashcardsReviewed").default(0).notNull(),
  studyMinutes: int("studyMinutes").default(0).notNull(),
  averageQuizScore: decimal("averageQuizScore", { precision: 5, scale: 2 }).default("0"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyProgressLog = typeof dailyProgressLog.$inferSelect;
export type InsertDailyProgressLog = typeof dailyProgressLog.$inferInsert;

/**
 * Chat Sessions — AI tutor conversations
 */
export const chatSessions = mysqlTable("chatSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subjectId: int("subjectId"),
  lessonId: int("lessonId"),
  title: varchar("title", { length: 255 }),
  teachingMode: varchar("teachingMode", { length: 50 }).default("teacher"), // teacher, eli10, exam, interview, quick
  pinned: boolean("pinned").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

/**
 * Chat Messages — individual messages in a conversation
 */
export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  userId: int("userId").notNull(),
  role: varchar("role", { length: 20 }).notNull(), // "user", "assistant", "system"
  content: longtext("content").notNull(),
  // Metadata for context-aware responses
  metadata: json("metadata").$type<{
    lessonId?: number;
    documentIds?: number[];
    subjectId?: number;
    teachingMode?: string;
    thinking?: string;
    attachments?: Array<{ id: string; name: string; size: number; type: string; url?: string }>;
    studyContext?: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;


/**
 * Beta feedback — lightweight product feedback for the public beta.
 */
export const betaFeedback = mysqlTable("betaFeedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  rating: int("rating").notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BetaFeedback = typeof betaFeedback.$inferSelect;
export type InsertBetaFeedback = typeof betaFeedback.$inferInsert;
