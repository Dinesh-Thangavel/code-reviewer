-- CreateTable
CREATE TABLE `Repository` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `autoReview` BOOLEAN NOT NULL DEFAULT true,
    `installationId` VARCHAR(191) NULL,
    `strictness` ENUM('RELAXED', 'BALANCED', 'STRICT') NOT NULL DEFAULT 'BALANCED',
    `languages` TEXT NULL,
    `ignorePaths` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Repository_fullName_key`(`fullName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PullRequest` (
    `id` VARCHAR(191) NOT NULL,
    `repoId` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `author` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'CLOSED', 'MERGED') NOT NULL DEFAULT 'OPEN',
    `riskLevel` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'LOW',
    `headSha` VARCHAR(191) NULL,
    `baseBranch` VARCHAR(191) NULL DEFAULT 'main',
    `lastReviewedCommitSha` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PullRequest_repoId_number_key`(`repoId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Review` (
    `id` VARCHAR(191) NOT NULL,
    `prId` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `confidenceScore` DOUBLE NOT NULL,
    `riskLevel` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'LOW',
    `filesChanged` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Issue` (
    `id` VARCHAR(191) NOT NULL,
    `reviewId` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `suggestedFix` TEXT NULL,
    `language` VARCHAR(191) NOT NULL,
    `fixStatus` ENUM('PENDING', 'APPLIED', 'REJECTED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `appliedAt` DATETIME(3) NULL,
    `commitSha` VARCHAR(191) NULL,
    `fixBranch` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PullRequest` ADD CONSTRAINT `PullRequest_repoId_fkey` FOREIGN KEY (`repoId`) REFERENCES `Repository`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_prId_fkey` FOREIGN KEY (`prId`) REFERENCES `PullRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Issue` ADD CONSTRAINT `Issue_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
