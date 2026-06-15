-- AlterTable KnowledgePoint
ALTER TABLE "KnowledgePoint" ADD COLUMN "estimatedMinutes" INTEGER;

-- AlterTable DailyActivity
ALTER TABLE "DailyActivity" ADD COLUMN "studySeconds" INTEGER NOT NULL DEFAULT 0;
