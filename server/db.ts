import { eq, and, desc, asc, gte, lte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { 
  InsertUser, 
  User,
  users,
  subjects,
  documents,
  lessons,
  quizQuestions,
  quizAttempts,
  flashcards,
  flashcardReviews,
  notes,
  studySessions,
  progressStats,
  dailyProgressLog,
  chatSessions,
  chatMessages,
  betaFeedback
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { computeSM2 } from './sm2';
import { createHash, randomUUID } from "crypto";

let _db: ReturnType<typeof drizzle> | null = null;

// Build a mysql2 config from a DATABASE_URL connection string. TiDB
// Serverless requires TLS and does not accept insecure transport, so we pass
// explicit `ssl` options rather than relying on the URL query string (which
// mysql2 does not honour for `ssl`). `rejectUnauthorized` defaults to false so
// the public TiDB endpoint works without shipping a pinned CA certificate;
// set SSL_REJECT_UNAUTHORIZED=true to enforce cert verification against the
// system CA store when a proper CA is configured.
function buildDbConfig(url: string): mysql.PoolOptions {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {};
  }
  const strictSsl = String(process.env.SSL_REJECT_UNAUTHORIZED || "").toLowerCase() === "true";
  const ssl =
    parsed.searchParams.get("ssl") || strictSsl
      ? { rejectUnauthorized: strictSsl }
      : { rejectUnauthorized: false };
  return {
    host: parsed.hostname,
    port: Number(parsed.port || "4000"),
    user: decodeURIComponent(parsed.username || ""),
    password: decodeURIComponent(parsed.password || ""),
    database: decodeURIComponent(parsed.pathname.split("/")[1] || ""),
    ssl,
  };
}


// mysql2's INSERT result is a [ResultSetHeader, FieldPacket[]] tuple where
// insertId is the new row's auto-increment id. Centralizing the extraction
// here means every create* helper below can return that id consistently.
function extractInsertId(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  const id = (header as { insertId?: number } | undefined)?.insertId;
  if (typeof id !== "number") {
    throw new Error("Insert did not return an insertId");
  }
  return id;
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = mysql.createPool(buildDbConfig(process.env.DATABASE_URL));
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===== In-memory fallback store =====
// Used whenever DATABASE_URL isn't configured (e.g. local dev without a
// MySQL/TiDB instance). This lets NIM API-key login/auth work end-to-end
// without a database; nothing here persists across a server restart.
let warnedNoDatabase = false;
function warnNoDatabaseOnce() {
  if (warnedNoDatabase) return;
  warnedNoDatabase = true;
  console.warn(
    "[Database] DATABASE_URL is not set - using an in-memory user store. " +
    "Data will not persist across restarts. Set DATABASE_URL and run `pnpm db:push` for persistence."
  );
}

const memoryUsersById = new Map<number, User>();
const memoryUsersByApiKeyHash = new Map<string, number>();
const memoryUsersByEmail = new Map<string, number>();
let memoryUserNextId = 1;

// In-memory stores for other entities
const memorySubjectsById = new Map<number, any>();
const memorySubjectsByUserId = new Map<number, number[]>();
let memorySubjectNextId = 1;

const memoryDocumentsById = new Map<number, any>();
const memoryDocumentsBySubjectId = new Map<number, number[]>();
let memoryDocumentNextId = 1;

const memoryLessonsById = new Map<number, any>();
const memoryLessonsBySubjectId = new Map<number, number[]>();
let memoryLessonNextId = 1;

const memoryQuizQuestionsById = new Map<number, any>();
const memoryQuizQuestionsByLessonId = new Map<number, number[]>();
let memoryQuizQuestionNextId = 1;

const memoryQuizAttemptsById = new Map<number, any>();
let memoryQuizAttemptNextId = 1;

const memoryFlashcardsById = new Map<number, any>();
const memoryFlashcardsBySubjectId = new Map<number, number[]>();
let memoryFlashcardNextId = 1;

const memoryNotesById = new Map<number, any>();
const memoryNotesBySubjectId = new Map<number, number[]>();
let memoryNoteNextId = 1;

const memoryStudySessionsById = new Map<number, any>();
const memoryStudySessionsByUserId = new Map<number, number[]>();
let memoryStudySessionNextId = 1;

const memoryProgressStatsByUserId = new Map<number, any>();

const memoryDailyProgressLogByUserId = new Map<number, Map<string, any>>();

const memoryChatSessionsById = new Map<number, any>();
const memoryChatSessionsByUserId = new Map<number, number[]>();
let memoryChatSessionNextId = 1;

const memoryChatMessagesById = new Map<number, any>();
const memoryChatMessagesBySessionId = new Map<number, number[]>();
let memoryChatMessageNextId = 1;

function memoryCreateUser(userData: { name: string; email: string | null; apiKeyHash: string | null; passwordHash?: string | null; loginMethod?: string }): User {
  warnNoDatabaseOnce();
  const now = new Date();
  const id = memoryUserNextId++;
  const isGoogleUser = !userData.apiKeyHash;
  const hashToUse = userData.apiKeyHash || `google-${createHash("sha256").update(userData.email || "").digest("hex").slice(0, 16)}`;
  const user: User = {
    id,
    openId: isGoogleUser ? `google-${createHash("sha256").update(userData.email || "").digest("hex").slice(0, 16)}` : `api-${createHash("sha256").update(userData.apiKeyHash!).digest("hex").slice(0, 16)}`,
    name: userData.name,
    email: userData.email,
    loginMethod: userData.loginMethod ?? (isGoogleUser ? "google" : "nim-api"),
    role: "user",
    apiKeyHash: userData.apiKeyHash,
    passwordHash: userData.passwordHash ?? null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  } as User;
  memoryUsersById.set(id, user);
  if (!isGoogleUser) {
    memoryUsersByApiKeyHash.set(userData.apiKeyHash!, id);
  }
  return user;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    return Array.from(memoryUsersById.values()).find(user => user.openId === openId);
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== Subjects =====
export async function getUserSubjects(userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const subjectIds = memorySubjectsByUserId.get(userId) || [];
    return subjectIds.map(id => memorySubjectsById.get(id)).filter(Boolean);
  }
  return db.select().from(subjects).where(eq(subjects.userId, userId)).orderBy(desc(subjects.createdAt));
}

export async function getSubject(subjectId: number, userId: number) {
  const database = await getDb();
  if (!database) {
    warnNoDatabaseOnce();
    const subject = memorySubjectsById.get(subjectId);
    return subject && subject.userId === userId ? subject : null;
  }
  const rows = await database.select().from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createSubject(userId: number, title: string, description?: string, color?: string) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const now = new Date();
    const id = memorySubjectNextId++;
    const subject = {
      id,
      userId,
      title,
      description: description || null,
      color: color || "purple",
      createdAt: now,
      updatedAt: now,
    };
    memorySubjectsById.set(id, subject);
    const userSubjects = memorySubjectsByUserId.get(userId) || [];
    userSubjects.push(id);
    memorySubjectsByUserId.set(userId, userSubjects);
    return { id };
  }
  
  const result = await db.insert(subjects).values({
    userId,
    title,
    description,
    color: color || "purple",
  });
  
  return result;
}

export async function updateSubject(subjectId: number, userId: number, updates: Partial<{ title: string; description: string; color: string }>) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const subject = memorySubjectsById.get(subjectId);
    if (!subject || subject.userId !== userId) return;
    Object.assign(subject, updates, { updatedAt: new Date() });
    return;
  }
  
  return db.update(subjects)
    .set(updates)
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
}

export async function deleteSubject(subjectId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const subject = memorySubjectsById.get(subjectId);
    if (!subject || subject.userId !== userId) return;
    memorySubjectsById.delete(subjectId);
    const userSubjects = memorySubjectsByUserId.get(userId) || [];
    memorySubjectsByUserId.set(userId, userSubjects.filter(id => id !== subjectId));
    return;
  }
  
  return db.delete(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
}

// ===== Documents =====
export async function createDocument(
  userId: number,
  subjectId: number,
  filename: string,
  fileType: string,
  fileSize: number,
  storageKey: string,
  extractedText?: string
) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const now = new Date();
    const id = memoryDocumentNextId++;
    const doc = {
      id,
      userId,
      subjectId,
      filename,
      fileType,
      fileSize,
      storageKey,
      extractedText: extractedText || null,
      createdAt: now,
      updatedAt: now,
    };
    memoryDocumentsById.set(id, doc);
    const subjectDocs = memoryDocumentsBySubjectId.get(subjectId) || [];
    subjectDocs.push(id);
    memoryDocumentsBySubjectId.set(subjectId, subjectDocs);
    return { id };
  }
  
  const result = await db.insert(documents).values({
    userId,
    subjectId,
    filename,
    fileType,
    fileSize,
    storageKey,
    extractedText,
  });
  
  return { id: extractInsertId(result) };
}

export async function getSubjectDocuments(subjectId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const docIds = memoryDocumentsBySubjectId.get(subjectId) || [];
    return docIds.map(id => memoryDocumentsById.get(id)).filter(d => d && d.userId === userId);
  }
  
  return db.select().from(documents)
    .where(and(eq(documents.subjectId, subjectId), eq(documents.userId, userId)))
    .orderBy(desc(documents.createdAt));
}

export async function getDocument(documentId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const doc = memoryDocumentsById.get(documentId);
    return (doc && doc.userId === userId) ? doc : null;
  }
  
  const result = await db.select().from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Look up a document by its storage key (e.g. `youtube/<videoId>`) for a given
 * user. Used to reuse a previously-fetched YouTube transcript instead of
 * calling YouTube again (transcript caching).
 */
export async function getDocumentByKey(userId: number, storageKey: string) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    for (const doc of memoryDocumentsById.values()) {
      if (doc.userId === userId && doc.storageKey === storageKey) return doc;
    }
    return null;
  }

  const result = await db.select().from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.storageKey, storageKey)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function deleteDocument(documentId: number, userId: number) {
  const database = await getDb();
  if (!database) {
    const doc = memoryDocumentsById.get(documentId);
    if (!doc || doc.userId !== userId) return;
    memoryDocumentsById.delete(documentId);
    const ids = memoryDocumentsBySubjectId.get(doc.subjectId) || [];
    memoryDocumentsBySubjectId.set(doc.subjectId, ids.filter(id => id !== documentId));
    return;
  }
  await database.delete(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
}

// ===== Lessons =====
export async function createLesson(
  userId: number,
  subjectId: number,
  title: string,
  data: {
    excerpt?: string;
    beginnerExplanation?: string;
    collegeExplanation?: string;
    advancedExplanation?: string;
    keyTerms?: string[];
    analogies?: Array<{ title: string; body: string }>;
    takeaways?: string[];
    examples?: string[];
    misconceptions?: string[];
    visualPrompt?: string;
    documentId?: number;
  }
) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const now = new Date();
    const id = memoryLessonNextId++;
    const lesson = {
      id,
      userId,
      subjectId,
      title,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    memoryLessonsById.set(id, lesson);
    const subjectLessons = memoryLessonsBySubjectId.get(subjectId) || [];
    subjectLessons.push(id);
    memoryLessonsBySubjectId.set(subjectId, subjectLessons);
    return { id };
  }
  
  const result = await db.insert(lessons).values({
    userId,
    subjectId,
    title,
    ...data,
  });
  
  return { id: extractInsertId(result) };
}

export async function getSubjectLessons(subjectId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const lessonIds = memoryLessonsBySubjectId.get(subjectId) || [];
    return lessonIds.map(id => memoryLessonsById.get(id)).filter(l => l && l.userId === userId);
  }
  
  return db.select().from(lessons)
    .where(and(eq(lessons.subjectId, subjectId), eq(lessons.userId, userId)))
    .orderBy(desc(lessons.createdAt));
}

export async function getLesson(lessonId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const lesson = memoryLessonsById.get(lessonId);
    return (lesson && lesson.userId === userId) ? lesson : null;
  }
  
  const result = await db.select().from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.userId, userId)))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateLesson(lessonId: number, userId: number, updates: { title?: string }) {
  const database = await getDb();
  if (!database) {
    const lesson = memoryLessonsById.get(lessonId);
    if (!lesson || lesson.userId !== userId) return null;
    Object.assign(lesson, updates, { updatedAt: new Date() });
    return lesson;
  }
  return database.update(lessons).set({ ...updates, updatedAt: new Date() }).where(and(eq(lessons.id, lessonId), eq(lessons.userId, userId)));
}

export async function deleteLesson(lessonId: number, userId: number) {
  const database = await getDb();
  if (!database) {
    const lesson = memoryLessonsById.get(lessonId);
    if (!lesson || lesson.userId !== userId) return;
    memoryLessonsById.delete(lessonId);
    const ids = memoryLessonsBySubjectId.get(lesson.subjectId) || [];
    memoryLessonsBySubjectId.set(lesson.subjectId, ids.filter(id => id !== lessonId));
    for (const [id, q] of memoryQuizQuestionsById) if (q.lessonId === lessonId) memoryQuizQuestionsById.delete(id);
    for (const [id, card] of memoryFlashcardsById) if (card.lessonId === lessonId) memoryFlashcardsById.delete(id);
    return;
  }
  await database.delete(quizAttempts).where(and(eq(quizAttempts.lessonId, lessonId), eq(quizAttempts.userId, userId)));
  await database.delete(quizQuestions).where(and(eq(quizQuestions.lessonId, lessonId), eq(quizQuestions.userId, userId)));
  const lessonCards = await database.select({ id: flashcards.id }).from(flashcards).where(and(eq(flashcards.lessonId, lessonId), eq(flashcards.userId, userId)));
  if (lessonCards.length) {
    const cardIds = lessonCards.map(card => card.id);
    await database.delete(flashcardReviews).where(and(eq(flashcardReviews.userId, userId), inArray(flashcardReviews.flashcardId, cardIds)));
    await database.delete(flashcards).where(and(eq(flashcards.userId, userId), inArray(flashcards.id, cardIds)));
  }
  return database.delete(lessons).where(and(eq(lessons.id, lessonId), eq(lessons.userId, userId)));
}

// ===== Quiz Questions =====
export async function createQuizQuestion(
  userId: number,
  lessonId: number,
  question: string,
  options: string[],
  correctAnswerIndex: number,
  explanation?: string,
  difficulty?: string
) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const now = new Date();
    const id = memoryQuizQuestionNextId++;
    const q = {
      id,
      userId,
      lessonId,
      question,
      options,
      correctAnswerIndex,
      explanation: explanation || null,
      difficulty: (difficulty || "medium") as "easy" | "medium" | "hard",
      createdAt: now,
    };
    memoryQuizQuestionsById.set(id, q);
    const lessonQuestions = memoryQuizQuestionsByLessonId.get(lessonId) || [];
    lessonQuestions.push(id);
    memoryQuizQuestionsByLessonId.set(lessonId, lessonQuestions);
    return { id };
  }
  
  const result = await db.insert(quizQuestions).values({
    userId,
    lessonId,
    question,
    options,
    correctAnswerIndex,
    explanation,
    difficulty: (difficulty || "medium") as "easy" | "medium" | "hard",
  });
  return { id: extractInsertId(result) };
}

export async function getLessonQuizQuestions(lessonId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const qIds = memoryQuizQuestionsByLessonId.get(lessonId) || [];
    return qIds.map(id => memoryQuizQuestionsById.get(id)).filter(q => q && q.userId === userId);
  }
  
  return db.select().from(quizQuestions)
    .where(and(eq(quizQuestions.lessonId, lessonId), eq(quizQuestions.userId, userId)));
}

// ===== Quiz Attempts =====
export async function recordQuizAttempt(
  userId: number,
  lessonId: number,
  questionId: number,
  selectedAnswerIndex: number,
  isCorrect: boolean
) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const now = new Date();
    const id = memoryQuizAttemptNextId++;
    const attempt = {
      id,
      userId,
      lessonId,
      questionId,
      selectedAnswerIndex,
      isCorrect,
      createdAt: now,
    };
    memoryQuizAttemptsById.set(id, attempt);
    return;
  }
  
  return db.insert(quizAttempts).values({
    userId,
    lessonId,
    questionId,
    selectedAnswerIndex,
    isCorrect,
  });
}

export async function getLessonQuizScore(lessonId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const attempts = Array.from(memoryQuizAttemptsById.values())
      .filter(a => a.lessonId === lessonId && a.userId === userId);
    const total = attempts.length;
    const correct = attempts.filter(a => a.isCorrect).length;
    return {
      total,
      correct,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  }
  
  const attempts = await db.select().from(quizAttempts)
    .where(and(eq(quizAttempts.lessonId, lessonId), eq(quizAttempts.userId, userId)));
  
  const total = attempts.length;
  const correct = attempts.filter(a => a.isCorrect).length;
  
  return {
    total,
    correct,
    percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
  };
}

// ===== Flashcards =====
export async function createFlashcard(
  userId: number,
  subjectId: number,
  front: string,
  back: string,
  lessonId?: number
) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const now = new Date();
    const id = memoryFlashcardNextId++;
    const fc = {
      id,
      userId,
      subjectId,
      front,
      back,
      lessonId: lessonId || null,
      interval: 0,
      easeFactor: "2.5",
      repetitions: 0,
      nextReviewDate: now,
      createdAt: now,
      updatedAt: now,
    };
    memoryFlashcardsById.set(id, fc);
    const subjectFcs = memoryFlashcardsBySubjectId.get(subjectId) || [];
    subjectFcs.push(id);
    memoryFlashcardsBySubjectId.set(subjectId, subjectFcs);
    return { id };
  }
  
  const result = await db.insert(flashcards).values({
    userId,
    subjectId,
    front,
    back,
    lessonId,
  });
  return { id: extractInsertId(result) };
}

export async function getSubjectFlashcards(subjectId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const fcIds = memoryFlashcardsBySubjectId.get(subjectId) || [];
    return fcIds.map(id => memoryFlashcardsById.get(id)).filter(f => f && f.userId === userId);
  }
  
  return db.select().from(flashcards)
    .where(and(eq(flashcards.subjectId, subjectId), eq(flashcards.userId, userId)))
    .orderBy(asc(flashcards.nextReviewDate));
}

export async function updateFlashcard(flashcardId: number, userId: number, front: string, back: string) {
  const database = await getDb();
  if (!database) {
    const card = memoryFlashcardsById.get(flashcardId);
    if (!card || card.userId !== userId) return null;
    Object.assign(card, { front, back, updatedAt: new Date() });
    return card;
  }
  return database.update(flashcards).set({ front, back, updatedAt: new Date() }).where(and(eq(flashcards.id, flashcardId), eq(flashcards.userId, userId)));
}

export async function deleteFlashcard(flashcardId: number, userId: number) {
  const database = await getDb();
  if (!database) {
    const card = memoryFlashcardsById.get(flashcardId);
    if (!card || card.userId !== userId) return;
    memoryFlashcardsById.delete(flashcardId);
    const ids = memoryFlashcardsBySubjectId.get(card.subjectId) || [];
    memoryFlashcardsBySubjectId.set(card.subjectId, ids.filter(id => id !== flashcardId));
    return;
  }
  await database.delete(flashcardReviews).where(and(eq(flashcardReviews.flashcardId, flashcardId), eq(flashcardReviews.userId, userId)));
  return database.delete(flashcards).where(and(eq(flashcards.id, flashcardId), eq(flashcards.userId, userId)));
}

export async function getFlashcardsForReview(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const now = new Date();
    const allFcs = Array.from(memoryFlashcardsById.values())
      .filter(f => f.userId === userId && f.nextReviewDate <= now)
      .sort((a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime());
    return allFcs.slice(0, limit);
  }
  
  const now = new Date();
  return db.select().from(flashcards)
    .where(and(
      eq(flashcards.userId, userId),
      lte(flashcards.nextReviewDate, now)
    ))
    .orderBy(asc(flashcards.nextReviewDate))
    .limit(limit);
}

export async function updateFlashcardAfterReview(
  flashcardId: number,
  quality: number, // 0-5: SM-2 algorithm
  userId: number
) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const card = memoryFlashcardsById.get(flashcardId);
    if (!card || card.userId !== userId) throw new Error("Flashcard not found");
    
    const { interval: newInterval, easeFactor: newEaseFactor, repetitions: newRepetitions, nextReviewDate } = computeSM2(
      {
        interval: card.interval,
        easeFactor: parseFloat(card.easeFactor.toString()),
        repetitions: card.repetitions,
      },
      quality
    );

    // Update flashcard
    Object.assign(card, {
      interval: newInterval,
      easeFactor: newEaseFactor.toString(),
      nextReviewDate,
      repetitions: newRepetitions,
      updatedAt: new Date(),
    });
    return;
  }
  
  // Get current flashcard
  const card = await db.select().from(flashcards)
    .where(and(eq(flashcards.id, flashcardId), eq(flashcards.userId, userId)))
    .limit(1);
  
  if (!card.length) throw new Error("Flashcard not found");
  
  const current = card[0];

  const { interval: newInterval, easeFactor: newEaseFactor, repetitions: newRepetitions, nextReviewDate } = computeSM2(
    {
      interval: current.interval,
      easeFactor: parseFloat(current.easeFactor.toString()),
      repetitions: current.repetitions,
    },
    quality
  );

  // Record review
  await db.insert(flashcardReviews).values({
    userId,
    flashcardId,
    quality,
  });
  
  // Update flashcard
  return db.update(flashcards)
    .set({
      interval: newInterval,
      easeFactor: newEaseFactor.toString() as any,
      nextReviewDate,
      repetitions: newRepetitions,
    })
    .where(eq(flashcards.id, flashcardId));
}

// ===== Notes =====
export async function createNote(
  userId: number,
  subjectId: number,
  title: string,
  content: string,
  lessonId?: number
) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const now = new Date();
    const id = memoryNoteNextId++;
    const note = {
      id,
      userId,
      subjectId,
      title,
      content,
      lessonId: lessonId || null,
      createdAt: now,
      updatedAt: now,
    };
    memoryNotesById.set(id, note);
    const subjectNotes = memoryNotesBySubjectId.get(subjectId) || [];
    subjectNotes.push(id);
    memoryNotesBySubjectId.set(subjectId, subjectNotes);
    return { id };
  }
  
  const result = await db.insert(notes).values({
    userId,
    subjectId,
    title,
    content,
    lessonId,
  });
  return { id: extractInsertId(result) };
}

export async function updateNote(noteId: number, userId: number, content: string, title?: string) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const note = memoryNotesById.get(noteId);
    if (!note || note.userId !== userId) return;
    note.content = content;
    if (title !== undefined) note.title = title;
    note.updatedAt = new Date();
    return;
  }
  
  return db.update(notes)
    .set({ content, ...(title !== undefined ? { title } : {}), updatedAt: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
}

export async function getSubjectNotes(subjectId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const noteIds = memoryNotesBySubjectId.get(subjectId) || [];
    return noteIds.map(id => memoryNotesById.get(id)).filter(n => n && n.userId === userId);
  }
  
  return db.select().from(notes)
    .where(and(eq(notes.subjectId, subjectId), eq(notes.userId, userId)))
    .orderBy(desc(notes.updatedAt));
}

export async function getNote(noteId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const note = memoryNotesById.get(noteId);
    return (note && note.userId === userId) ? note : null;
  }
  
  const result = await db.select().from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function deleteNote(noteId: number, userId: number) {
  const database = await getDb();
  if (!database) {
    const note = memoryNotesById.get(noteId);
    if (!note || note.userId !== userId) return;
    memoryNotesById.delete(noteId);
    const ids = memoryNotesBySubjectId.get(note.subjectId) || [];
    memoryNotesBySubjectId.set(note.subjectId, ids.filter(id => id !== noteId));
    return;
  }
  return database.delete(notes).where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
}

// ===== Study Sessions =====
export async function createStudySession(
  userId: number,
  subjectId: number,
  title: string,
  scheduledDate: Date,
  durationMinutes?: number,
  description?: string
) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const now = new Date();
    const id = memoryStudySessionNextId++;
    const session = {
      id,
      userId,
      subjectId,
      title,
      scheduledDate,
      durationMinutes: durationMinutes || 30,
      description: description || null,
      status: "planned" as const,
      createdAt: now,
      updatedAt: now,
    };
    memoryStudySessionsById.set(id, session);
    const userSessions = memoryStudySessionsByUserId.get(userId) || [];
    userSessions.push(id);
    memoryStudySessionsByUserId.set(userId, userSessions);
    return { id };
  }
  
  return db.insert(studySessions).values({
    userId,
    subjectId,
    title,
    scheduledDate,
    durationMinutes: durationMinutes || 30,
    description,
  });
}

export async function getUserStudySessions(userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const sessionIds = memoryStudySessionsByUserId.get(userId) || [];
    return sessionIds.map(id => memoryStudySessionsById.get(id)).filter(Boolean);
  }
  
  return db.select().from(studySessions)
    .where(eq(studySessions.userId, userId))
    .orderBy(desc(studySessions.scheduledDate));
}

export async function updateStudySessionStatus(
  sessionId: number,
  userId: number,
  status: "planned" | "in_progress" | "completed" | "skipped",
  actualDurationMinutes?: number
) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const session = memoryStudySessionsById.get(sessionId);
    if (!session || session.userId !== userId) return;
    session.status = status;
    session.updatedAt = new Date();
    if (status === "completed") {
      session.completedAt = new Date();
      if (actualDurationMinutes) session.actualDurationMinutes = actualDurationMinutes;
    }
    return;
  }
  
  const updates: any = { status };
  if (status === "completed") {
    updates.completedAt = new Date();
    if (actualDurationMinutes) {
      updates.actualDurationMinutes = actualDurationMinutes;
    }
  }
  
  return db.update(studySessions)
    .set(updates)
    .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)));
}

// ===== Progress Stats =====
export async function getOrCreateProgressStats(userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    let stats = memoryProgressStatsByUserId.get(userId);
    if (!stats) {
      stats = {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        dailyGoalMinutes: 60,
        todayStudyMinutes: 0,
        totalLessonsCompleted: 0,
        totalQuizzesTaken: 0,
        totalFlashcardsReviewed: 0,
        totalStudyMinutes: 0,
        averageQuizScore: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryProgressStatsByUserId.set(userId, stats);
    }
    return stats;
  }
  
  const existing = await db.select().from(progressStats)
    .where(eq(progressStats.userId, userId))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  await db.insert(progressStats).values({ userId });
  const created = await db.select().from(progressStats)
    .where(eq(progressStats.userId, userId))
    .limit(1);
  
  return created[0];
}

export async function updateProgressStats(userId: number, updates: Partial<any>) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    let stats = memoryProgressStatsByUserId.get(userId);
    if (!stats) {
      stats = {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        dailyGoalMinutes: 60,
        todayStudyMinutes: 0,
        totalLessonsCompleted: 0,
        totalQuizzesTaken: 0,
        totalFlashcardsReviewed: 0,
        totalStudyMinutes: 0,
        averageQuizScore: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryProgressStatsByUserId.set(userId, stats);
    }
    Object.assign(stats, updates, { updatedAt: new Date() });
    return;
  }
  
  return db.update(progressStats)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(progressStats.userId, userId));
}

// ===== Daily Progress Log =====
export async function getOrCreateDailyLog(userId: number, date: string) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    let userLogs = memoryDailyProgressLogByUserId.get(userId);
    if (!userLogs) {
      userLogs = new Map();
      memoryDailyProgressLogByUserId.set(userId, userLogs);
    }
    let log = userLogs.get(date);
    if (!log) {
      log = { userId, date, lessonsCompleted: 0, quizzesTaken: 0, flashcardsReviewed: 0, studyMinutes: 0, averageQuizScore: null, createdAt: new Date(), updatedAt: new Date() };
      userLogs.set(date, log);
    }
    return log;
  }
  
  const existing = await db.select().from(dailyProgressLog)
    .where(and(eq(dailyProgressLog.userId, userId), eq(dailyProgressLog.date, date)))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  await db.insert(dailyProgressLog).values({ userId, date });
  const created = await db.select().from(dailyProgressLog)
    .where(and(eq(dailyProgressLog.userId, userId), eq(dailyProgressLog.date, date)))
    .limit(1);
  
  return created[0];
}

export async function updateDailyLog(userId: number, date: string, updates: Partial<any>) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    let userLogs = memoryDailyProgressLogByUserId.get(userId);
    if (!userLogs) {
      userLogs = new Map();
      memoryDailyProgressLogByUserId.set(userId, userLogs);
    }
    let log = userLogs.get(date);
    if (!log) {
      log = { userId, date, lessonsCompleted: 0, quizzesTaken: 0, flashcardsReviewed: 0, studyMinutes: 0, averageQuizScore: null, createdAt: new Date(), updatedAt: new Date() };
      userLogs.set(date, log);
    }
    Object.assign(log, updates, { updatedAt: new Date() });
    return;
  }
  
  return db.update(dailyProgressLog)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(dailyProgressLog.userId, userId), eq(dailyProgressLog.date, date)));
}

export async function getUserProgressHistory(userId: number, days = 30) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    let userLogs = memoryDailyProgressLogByUserId.get(userId);
    if (!userLogs) return [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    return Array.from(userLogs.values())
      .filter(log => log.date >= startDateStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];
  
  return db.select().from(dailyProgressLog)
    .where(and(
      eq(dailyProgressLog.userId, userId),
      gte(dailyProgressLog.date, startDateStr)
    ))
    .orderBy(asc(dailyProgressLog.date));
}

// ===== Chat Sessions =====
export async function createChatSession(
  userId: number,
  data: {
    subjectId?: number;
    lessonId?: number;
    title?: string;
    teachingMode?: string;
    pinned?: boolean;
  }
) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const now = new Date();
    const id = memoryChatSessionNextId++;
    const session = {
      id,
      userId,
      ...data,
      pinned: data.pinned ?? false,
      createdAt: now,
      updatedAt: now,
    };
    memoryChatSessionsById.set(id, session);
    const userSessions = memoryChatSessionsByUserId.get(userId) || [];
    userSessions.push(id);
    memoryChatSessionsByUserId.set(userId, userSessions);
    return { id };
  }
  
  const result = await db.insert(chatSessions).values({
    userId,
    ...data,
    pinned: data.pinned ?? false,
  });
  
  return { id: extractInsertId(result) };
}

export async function getUserChatSessions(userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const sessionIds = memoryChatSessionsByUserId.get(userId) || [];
    return sessionIds.map(id => memoryChatSessionsById.get(id)).filter(Boolean);
  }
  
  return db.select().from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.pinned), desc(chatSessions.updatedAt));
}

export async function getChatSession(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const session = memoryChatSessionsById.get(sessionId);
    return (session && session.userId === userId) ? session : null;
  }
  
  const result = await db.select().from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateChatSession(
  sessionId: number,
  userId: number,
  updates: Partial<{ title: string; teachingMode: string; pinned: boolean }>
) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const session = memoryChatSessionsById.get(sessionId);
    if (!session || session.userId !== userId) return;
    Object.assign(session, updates, { updatedAt: new Date() });
    return;
  }
  
  return db.update(chatSessions)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
}

export async function deleteChatSession(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const session = memoryChatSessionsById.get(sessionId);
    if (!session || session.userId !== userId) return;
    memoryChatSessionsById.delete(sessionId);
    // Delete messages
    const msgIds = memoryChatMessagesBySessionId.get(sessionId) || [];
    msgIds.forEach(id => memoryChatMessagesById.delete(id));
    memoryChatMessagesBySessionId.delete(sessionId);
    // Remove from user sessions
    const userSessions = memoryChatSessionsByUserId.get(userId) || [];
    memoryChatSessionsByUserId.set(userId, userSessions.filter(id => id !== sessionId));
    return;
  }
  
  // Delete messages first (foreign key constraint)
  await db.delete(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId));
  
  return db.delete(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
}

// ===== Chat Messages =====
export async function createChatMessage(
  userId: number,
  sessionId: number,
  role: "user" | "assistant" | "system",
  content: string,
  metadata?: Record<string, any>
) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const now = new Date();
    const id = memoryChatMessageNextId++;
    const msg = {
      id,
      userId,
      sessionId,
      role,
      content,
      metadata: metadata || {},
      createdAt: now,
    };
    memoryChatMessagesById.set(id, msg);
    const sessionMsgs = memoryChatMessagesBySessionId.get(sessionId) || [];
    sessionMsgs.push(id);
    memoryChatMessagesBySessionId.set(sessionId, sessionMsgs);
    return { id };
  }
  
  const result = await db.insert(chatMessages).values({
    userId,
    sessionId,
    role,
    content,
    metadata: metadata || {},
  });
  
  return { id: extractInsertId(result) };
}

export async function getChatMessages(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    // Verify session belongs to user
    const session = memoryChatSessionsById.get(sessionId);
    if (!session || session.userId !== userId) return [];
    const msgIds = memoryChatMessagesBySessionId.get(sessionId) || [];
    return msgIds.map(id => memoryChatMessagesById.get(id)).filter(Boolean)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  
  // Verify session belongs to user
  const session = await getChatSession(sessionId, userId);
  if (!session) return [];
  
  return db.select().from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));
}

export async function getRecentChatMessages(
  sessionId: number,
  userId: number,
  limit = 20
) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const session = memoryChatSessionsById.get(sessionId);
    if (!session || session.userId !== userId) return [];
    const msgIds = memoryChatMessagesBySessionId.get(sessionId) || [];
    return msgIds.map(id => memoryChatMessagesById.get(id)).filter(Boolean)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .reverse();
  }
  
  const session = await getChatSession(sessionId, userId);
  if (!session) return [];
  
  return db.select().from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit)
    .then(rows => rows.reverse()); // Return in chronological order
}

// Get weak topics from quiz attempts for AI memory
export async function getWeakTopics(userId: number, subjectId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get recent quiz attempts with incorrect answers
  const attempts = await db.select().from(quizAttempts)
    .where(eq(quizAttempts.userId, userId))
    .orderBy(desc(quizAttempts.createdAt))
    .limit(100);
  
  const incorrectAttempts = attempts.filter(a => !a.isCorrect);
  if (!incorrectAttempts.length) return [];
  
  // Get the lesson IDs and question details
  const questionIdsArray = incorrectAttempts.map(a => a.questionId);
  const uniqueQuestionIds = Array.from(new Set(questionIdsArray));
  const questions = await db.select().from(quizQuestions)
    .where(eq(quizQuestions.userId, userId));
  
  const incorrectQuestions = questions.filter(q => uniqueQuestionIds.includes(q.id));
  
  // Extract topics from question content (simple keyword extraction)
  const topics = new Set<string>();
  for (const q of incorrectQuestions) {
    // Simple topic extraction - look for capitalized terms or key phrases
    const words = q.question.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    words.forEach(w => topics.add(w));
  }
  
  return Array.from(topics).slice(0, 10);
}

// ===== AI Memory Helpers =====
export async function getSubjectQuizStats(userId: number, subjectId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Get lessons for this subject
  const userLessons = await db.select().from(lessons)
    .where(and(eq(lessons.subjectId, subjectId), eq(lessons.userId, userId)));
  
  const lessonIds = userLessons.map(l => l.id);
  if (!lessonIds.length) return null;
  
  // Get quiz questions for these lessons
  const questions = await db.select().from(quizQuestions)
    .where(and(eq(quizQuestions.userId, userId)));
  
  const relevantQuestions = questions.filter(q => lessonIds.includes(q.lessonId));
  if (!relevantQuestions.length) return null;
  
  const questionIds = relevantQuestions.map(q => q.id);
  
  // Get attempts for these questions
  const attempts = await db.select().from(quizAttempts)
    .where(eq(quizAttempts.userId, userId));
  
  const relevantAttempts = attempts.filter(a => questionIds.includes(a.questionId));
  
  const totalQuizzes = relevantAttempts.length;
  const correctAttempts = relevantAttempts.filter(a => a.isCorrect).length;
  const avgScore = totalQuizzes > 0 ? Math.round((correctAttempts / totalQuizzes) * 100) : 0;
  
  // Get recent topics from questions
  const recentTopics = relevantQuestions
    .slice(0, 5)
    .map(q => q.question.split(" ")[0]) // Simple topic extraction
    .filter(Boolean);
  
  return { totalQuizzes, avgScore, recentTopics };
}

export async function getSubjectFlashcardStats(userId: number, subjectId: number) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const cards = Array.from(memoryFlashcardsById.values())
      .filter(c => c.userId === userId && c.subjectId === subjectId);
    
    if (!cards.length) return null;
    
    const now = new Date();
    const dueForReview = cards.filter(c => c.nextReviewDate <= now).length;
    const mastered = cards.filter(c => c.repetitions >= 3 && parseFloat(c.easeFactor) >= 2.5).length;
    const masteryPercent = cards.length > 0 ? Math.round((mastered / cards.length) * 100) : 0;
    
    return { totalCards: cards.length, dueForReview, masteryPercent };
  }
  
  const cards = await db.select().from(flashcards)
    .where(and(eq(flashcards.userId, userId), eq(flashcards.subjectId, subjectId)));
  
  if (!cards.length) return null;
  
  const now = new Date();
  const dueForReview = cards.filter(c => c.nextReviewDate <= now).length;
  const mastered = cards.filter(c => c.repetitions >= 3 && parseFloat(c.easeFactor) >= 2.5).length;
  const masteryPercent = cards.length > 0 ? Math.round((mastered / cards.length) * 100) : 0;
  
  return { totalCards: cards.length, dueForReview, masteryPercent };
}

export async function getRecentStudySessions(userId: number, subjectId?: number, limit = 5) {
  const db = await getDb();
  if (!db) {
    warnNoDatabaseOnce();
    const sessionIds = memoryStudySessionsByUserId.get(userId) || [];
    let sessions = sessionIds.map(id => memoryStudySessionsById.get(id)).filter(Boolean);
    
    if (subjectId) {
      sessions = sessions.filter(s => s.subjectId === subjectId);
    }
    
    return sessions
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
.slice(0, limit);
  }
  
  if (subjectId) {
    return db.select().from(studySessions)
      .where(and(eq(studySessions.userId, userId), eq(studySessions.subjectId, subjectId)))
      .orderBy(desc(studySessions.scheduledDate))
      .limit(limit);
  }
  
  return db.select().from(studySessions)
    .where(eq(studySessions.userId, userId))
    .orderBy(desc(studySessions.scheduledDate))
    .limit(limit);
}

// Authentication helpers
export async function getUserByApiKey(apiKeyHash: string) {
  const database = await getDb();
  if (!database) {
    const id = memoryUsersByApiKeyHash.get(apiKeyHash);
    return id !== undefined ? (memoryUsersById.get(id) ?? null) : null;
  }
  const result = await database.select().from(users).where(eq(users.apiKeyHash, apiKeyHash)).limit(1);
  return result[0] ?? null;
}

export async function getUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const database = await getDb();
  if (!database) {
    const id = memoryUsersByEmail.get(normalized);
    return id !== undefined ? (memoryUsersById.get(id) ?? null) : null;
  }
  const result = await database.select().from(users).where(eq(users.email, normalized)).limit(1);
  return result[0] ?? null;
}

export async function createUser(userData: {
  name: string;
  email: string | null;
  apiKeyHash: string | null;
  passwordHash?: string | null;
  loginMethod?: string;
  openId?: string;
}) {
  const database = await getDb();
  const email = userData.email?.trim().toLowerCase() ?? null;
  const openId = userData.openId ?? (email
    ? `email-${createHash("sha256").update(email).digest("hex").slice(0, 24)}`
    : `api-${createHash("sha256").update(userData.apiKeyHash || randomUUID()).digest("hex").slice(0, 24)}`);
  const loginMethod = userData.loginMethod ?? (userData.passwordHash ? "email" : userData.apiKeyHash ? "nim-api" : "google");

  if (!database) {
    const user = memoryCreateUser({ ...userData, email, loginMethod });
    user.openId = openId;
    memoryUsersById.set(user.id, user);
    if (email) memoryUsersByEmail.set(email, user.id);
    return user;
  }

  const result = await database.insert(users).values({
    openId,
    name: userData.name,
    email,
    apiKeyHash: userData.apiKeyHash,
    passwordHash: userData.passwordHash ?? null,
    loginMethod,
    role: "user",
  });
  const id = extractInsertId(result);
  const created = await database.select().from(users).where(eq(users.id, id)).limit(1);
  return created[0];
}

export async function updateUserName(userId: number, name: string) {
  const normalized = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!normalized) throw new Error("Name cannot be empty");

  const database = await getDb();
  if (!database) {
    const user = memoryUsersById.get(userId);
    if (!user) return null;
    user.name = normalized;
    user.updatedAt = new Date();
    memoryUsersById.set(userId, user);
    return user;
  }

  await database.update(users)
    .set({ name: normalized })
    .where(eq(users.id, userId));

  const result = await database.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0] ?? null;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) {
    return memoryUsersById.get(userId) ?? null;
  }
  
  const result = await db.select().from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createBetaFeedback(userId: number, rating: number, category: string, message: string) {
  const database = await getDb();
  if (!database) {
    warnNoDatabaseOnce();
    return { id: Date.now() };
  }
  const result = await database.insert(betaFeedback).values({ userId, rating, category, message });
  return { id: extractInsertId(result) };
}

// Export a user's study space as a portable JSON-safe object.
export async function exportUserStudyData(userId: number) {
  const database = await getDb();
  if (!database) {
    warnNoDatabaseOnce();
    const user = memoryUsersById.get(userId) ?? null;
    const userSubjects = Array.from(memorySubjectsById.values()).filter((s: any) => s?.userId === userId);
    const subjectIds = new Set(userSubjects.map((s: any) => s.id));
    const userDocuments = Array.from(memoryDocumentsById.values()).filter((d: any) => d?.userId === userId);
    const userLessons = Array.from(memoryLessonsById.values()).filter((l: any) => l?.userId === userId);
    const userNotes = Array.from(memoryNotesById.values()).filter((n: any) => n?.userId === userId);
    const userSessions = Array.from(memoryChatSessionsById.values()).filter((s: any) => s?.userId === userId);
    const userMessages = Array.from(memoryChatMessagesById.values()).filter((m: any) => m?.userId === userId);
    return { exportedAt: new Date().toISOString(), user, subjects: userSubjects, documents: userDocuments.filter((d: any) => subjectIds.has(d.subjectId)), lessons: userLessons.filter((l: any) => subjectIds.has(l.subjectId)), notes: userNotes.filter((n: any) => subjectIds.has(n.subjectId)), chatSessions: userSessions, chatMessages: userMessages };
  }

  const [userRows, subjectRows, documentRows, lessonRows, noteRows, sessionRows, messageRows] = await Promise.all([
    database.select().from(users).where(eq(users.id, userId)).limit(1),
    database.select().from(subjects).where(eq(subjects.userId, userId)),
    database.select().from(documents).where(eq(documents.userId, userId)),
    database.select().from(lessons).where(eq(lessons.userId, userId)),
    database.select().from(notes).where(eq(notes.userId, userId)),
    database.select().from(chatSessions).where(eq(chatSessions.userId, userId)),
    database.select().from(chatMessages).where(eq(chatMessages.userId, userId)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user: userRows[0] ?? null,
    subjects: subjectRows,
    documents: documentRows,
    lessons: lessonRows,
    notes: noteRows,
    chatSessions: sessionRows,
    chatMessages: messageRows,
  };
}
