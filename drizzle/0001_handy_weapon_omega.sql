CREATE TABLE `speakerProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` varchar(36) NOT NULL,
	`speakerKey` varchar(64) NOT NULL,
	`defaultName` varchar(64) NOT NULL,
	`displayName` varchar(64),
	`suggestion` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `speakerProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `speakerProfiles_job_key_uq` UNIQUE(`jobId`,`speakerKey`)
);
--> statement-breakpoint
CREATE TABLE `transcriptTurns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` varchar(36) NOT NULL,
	`position` int NOT NULL,
	`speakerKey` varchar(64) NOT NULL,
	`startMs` int NOT NULL,
	`endMs` int NOT NULL,
	`text` text NOT NULL,
	`confidence` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transcriptTurns_id` PRIMARY KEY(`id`),
	CONSTRAINT `transcriptTurns_job_position_uq` UNIQUE(`jobId`,`position`)
);
--> statement-breakpoint
CREATE TABLE `transcriptionJobs` (
	`id` varchar(36) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`sourceType` enum('upload','url') NOT NULL,
	`sourceUrl` text,
	`sourceKey` varchar(512),
	`audioKey` varchar(512),
	`sourceName` varchar(255),
	`sourceMimeType` varchar(127),
	`sourceBytes` int,
	`jobStage` enum('uploading','extracting_audio','transcribing','diarizing','complete','failed') NOT NULL DEFAULT 'uploading',
	`progress` int NOT NULL DEFAULT 0,
	`transcriptText` text,
	`detectedLanguage` varchar(16),
	`errorMessage` text,
	`providerMetadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transcriptionJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `speakerProfiles_job_idx` ON `speakerProfiles` (`jobId`);--> statement-breakpoint
CREATE INDEX `transcriptTurns_job_idx` ON `transcriptTurns` (`jobId`);--> statement-breakpoint
CREATE INDEX `transcriptionJobs_session_created_idx` ON `transcriptionJobs` (`sessionId`,`createdAt`);