CREATE TABLE `dailyProgressLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`lessonsCompleted` int NOT NULL DEFAULT 0,
	`quizzesTaken` int NOT NULL DEFAULT 0,
	`flashcardsReviewed` int NOT NULL DEFAULT 0,
	`studyMinutes` int NOT NULL DEFAULT 0,
	`averageQuizScore` decimal(5,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dailyProgressLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int NOT NULL,
	`filename` varchar(255) NOT NULL,
	`fileType` varchar(20) NOT NULL,
	`fileSize` int NOT NULL,
	`storageKey` varchar(255) NOT NULL,
	`extractedText` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `flashcardReviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`flashcardId` int NOT NULL,
	`quality` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `flashcardReviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `flashcards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int NOT NULL,
	`lessonId` int,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`interval` int NOT NULL DEFAULT 1,
	`easeFactor` decimal(3,2) NOT NULL DEFAULT '2.5',
	`nextReviewDate` timestamp NOT NULL DEFAULT (now()),
	`repetitions` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `flashcards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int NOT NULL,
	`documentId` int,
	`title` varchar(255) NOT NULL,
	`excerpt` text,
	`beginnerExplanation` longtext,
	`collegeExplanation` longtext,
	`keyTerms` json DEFAULT ('[]'),
	`analogies` json DEFAULT ('[]'),
	`takeaways` json DEFAULT ('[]'),
	`examples` json DEFAULT ('[]'),
	`misconceptions` json DEFAULT ('[]'),
	`visualPrompt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int NOT NULL,
	`lessonId` int,
	`title` varchar(255) NOT NULL,
	`content` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `progressStats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`currentStreak` int NOT NULL DEFAULT 0,
	`longestStreak` int NOT NULL DEFAULT 0,
	`lastStudyDate` timestamp,
	`dailyGoalMinutes` int NOT NULL DEFAULT 60,
	`todayStudyMinutes` int NOT NULL DEFAULT 0,
	`totalLessonsCompleted` int NOT NULL DEFAULT 0,
	`totalQuizzesTaken` int NOT NULL DEFAULT 0,
	`totalFlashcardsReviewed` int NOT NULL DEFAULT 0,
	`totalStudyMinutes` int NOT NULL DEFAULT 0,
	`averageQuizScore` decimal(5,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `progressStats_id` PRIMARY KEY(`id`),
	CONSTRAINT `progressStats_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `quizAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lessonId` int NOT NULL,
	`questionId` int NOT NULL,
	`selectedAnswerIndex` int NOT NULL,
	`isCorrect` boolean NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizAttempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lessonId` int NOT NULL,
	`question` text NOT NULL,
	`options` json NOT NULL,
	`correctAnswerIndex` int NOT NULL,
	`explanation` text,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizQuestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studySessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`scheduledDate` timestamp NOT NULL,
	`durationMinutes` int NOT NULL DEFAULT 30,
	`status` enum('planned','in_progress','completed','skipped') NOT NULL DEFAULT 'planned',
	`actualDurationMinutes` int,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studySessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`color` varchar(20) NOT NULL DEFAULT 'purple',
	`icon` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subjects_id` PRIMARY KEY(`id`)
);
