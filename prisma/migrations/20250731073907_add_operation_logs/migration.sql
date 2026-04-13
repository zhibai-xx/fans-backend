-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('USER_ACTION', 'MEDIA_ACTION', 'ADMIN_ACTION', 'SYSTEM_ACTION');

-- CreateEnum
CREATE TYPE "OperationResult" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "LoginType" AS ENUM ('PASSWORD', 'OAUTH', 'REMEMBER_ME');

-- CreateEnum
CREATE TYPE "LoginResult" AS ENUM ('SUCCESS', 'FAILED', 'BLOCKED');

-- CreateTable
CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL,
    "operation_type" "OperationType" NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" TEXT,
    "target_name" VARCHAR(200),
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "description" VARCHAR(500),
    "result" "OperationResult" NOT NULL DEFAULT 'SUCCESS',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "OperationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginLog" (
    "id" TEXT NOT NULL,
    "login_type" "LoginType" NOT NULL DEFAULT 'PASSWORD',
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" VARCHAR(500) NOT NULL,
    "location" VARCHAR(100),
    "result" "LoginResult" NOT NULL DEFAULT 'SUCCESS',
    "fail_reason" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER,

    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationLog_user_id_created_at_idx" ON "OperationLog"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "OperationLog_module_action_idx" ON "OperationLog"("module", "action");

-- CreateIndex
CREATE INDEX "OperationLog_operation_type_created_at_idx" ON "OperationLog"("operation_type", "created_at");

-- CreateIndex
CREATE INDEX "OperationLog_target_type_target_id_idx" ON "OperationLog"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "LoginLog_user_id_created_at_idx" ON "LoginLog"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "LoginLog_ip_address_created_at_idx" ON "LoginLog"("ip_address", "created_at");

-- CreateIndex
CREATE INDEX "LoginLog_result_created_at_idx" ON "LoginLog"("result", "created_at");

-- AddForeignKey
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginLog" ADD CONSTRAINT "LoginLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
