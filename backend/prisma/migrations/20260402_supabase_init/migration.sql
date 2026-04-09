-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE "StrictnessLevel" AS ENUM ('RELAXED', 'BALANCED', 'STRICT');
CREATE TYPE "PRStatus" AS ENUM ('OPEN', 'CLOSED', 'MERGED');
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "FixStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED', 'FAILED');
CREATE TYPE "RepositoryProvider" AS ENUM ('GITHUB', 'BITBUCKET');

-- Tables
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "githubId" TEXT,
    "githubUsername" TEXT,
    "githubToken" TEXT,
    "githubTokenExpiresAt" TIMESTAMP(3),
    "githubConnected" BOOLEAN NOT NULL DEFAULT FALSE,
    "bitbucketId" TEXT,
    "bitbucketUsername" TEXT,
    "bitbucketToken" TEXT,
    "bitbucketTokenExpiresAt" TIMESTAMP(3),
    "bitbucketConnected" BOOLEAN NOT NULL DEFAULT FALSE,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");
CREATE UNIQUE INDEX "User_bitbucketId_key" ON "User"("bitbucketId");

CREATE TABLE "Repository" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "provider" "RepositoryProvider" NOT NULL DEFAULT 'GITHUB',
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "autoReview" BOOLEAN NOT NULL DEFAULT TRUE,
    "installationId" TEXT,
    "userId" UUID,
    "githubRepoId" INTEGER,
    "bitbucketRepoUuid" TEXT,
    "bitbucketWorkspace" TEXT,
    "isUserConnected" BOOLEAN NOT NULL DEFAULT FALSE,
    "strictness" "StrictnessLevel" NOT NULL DEFAULT 'BALANCED',
    "languages" TEXT,
    "ignorePaths" TEXT,
    "configYaml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Repository_fullName_key" ON "Repository"("fullName");
CREATE INDEX "Repository_userId_idx" ON "Repository"("userId");
CREATE INDEX "Repository_provider_idx" ON "Repository"("provider");

CREATE TABLE "PullRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repoId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "status" "PRStatus" NOT NULL DEFAULT 'OPEN',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "headSha" TEXT,
    "baseBranch" TEXT DEFAULT 'main',
    "lastReviewedCommitSha" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PullRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PullRequest_repoId_number_key" ON "PullRequest"("repoId", "number");

CREATE TABLE "Review" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "prId" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "filesChanged" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Issue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reviewId" UUID NOT NULL,
    "severity" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedFix" TEXT,
    "alternativeFixes" TEXT,
    "language" TEXT NOT NULL,
    "fixStatus" "FixStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3),
    "commitSha" TEXT,
    "fixBranch" TEXT,
    "userFeedback" TEXT,
    "feedbackNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "repositoryId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

CREATE TABLE "Notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT FALSE,
    "link" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

CREATE TABLE "ReviewMetrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repositoryId" UUID,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewsCompleted" INTEGER NOT NULL DEFAULT 0,
    "reviewsFailed" INTEGER NOT NULL DEFAULT 0,
    "avgReviewTime" DOUBLE PRECISION NOT NULL,
    "totalIssues" INTEGER NOT NULL DEFAULT 0,
    "criticalIssues" INTEGER NOT NULL DEFAULT 0,
    "fixesApplied" INTEGER NOT NULL DEFAULT 0,
    "fixesRejected" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewMetrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewMetrics_repositoryId_date_key" ON "ReviewMetrics"("repositoryId", "date");
CREATE INDEX "ReviewMetrics_repositoryId_date_idx" ON "ReviewMetrics"("repositoryId", "date");

-- Foreign keys
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PullRequest" ADD CONSTRAINT "PullRequest_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PullRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
