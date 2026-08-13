CREATE TABLE `betaFeedback` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `rating` int NOT NULL,
  `category` varchar(40) NOT NULL,
  `message` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `betaFeedback_id` PRIMARY KEY(`id`)
);
