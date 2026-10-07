-- CreateEnum
CREATE TYPE "SyncOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('PUSH', 'PULL');

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "AttendanceSession" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ChurchSettings" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "DepartmentPosition" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "InvoiceDepartment" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "InvoicePayment" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PositionPermission" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ServiceDay" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ServiceDayDepartmentLateTime" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ServiceDayService" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ServiceDayVariation" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ServiceDayVariationService" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SessionIncome" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SessionService" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SpecialProgram" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SpecialProgramService" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "SyncChange" (
    "id" TEXT NOT NULL,
    "sourceDatabaseId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" "SyncOperation" NOT NULL,
    "entityVersion" INTEGER NOT NULL,
    "payload" JSONB,
    "sequence" BIGINT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "SyncChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncConflict" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "localVersion" INTEGER NOT NULL,
    "remoteVersion" INTEGER NOT NULL,
    "localPayload" JSONB NOT NULL,
    "remotePayload" JSONB NOT NULL,
    "sourceDatabaseId" TEXT NOT NULL,
    "remoteDatabaseId" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SyncConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "localDatabaseId" TEXT NOT NULL,
    "remoteDatabaseId" TEXT NOT NULL,
    "lastPushedSequence" BIGINT NOT NULL DEFAULT 0,
    "lastPulledSequence" BIGINT NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncDatabase" (
    "id" TEXT NOT NULL,
    "databaseId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncSequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "current" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "SyncSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncChange_sourceDatabaseId_status_idx" ON "SyncChange"("sourceDatabaseId", "status");

-- CreateIndex
CREATE INDEX "SyncChange_entity_entityId_idx" ON "SyncChange"("entity", "entityId");

-- CreateIndex
CREATE INDEX "SyncChange_createdAt_idx" ON "SyncChange"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncChange_sourceDatabaseId_sequence_key" ON "SyncChange"("sourceDatabaseId", "sequence");

-- CreateIndex
CREATE INDEX "SyncConflict_entity_entityId_idx" ON "SyncConflict"("entity", "entityId");

-- CreateIndex
CREATE INDEX "SyncConflict_resolved_idx" ON "SyncConflict"("resolved");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_localDatabaseId_remoteDatabaseId_key" ON "SyncState"("localDatabaseId", "remoteDatabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncDatabase_databaseId_key" ON "SyncDatabase"("databaseId");
