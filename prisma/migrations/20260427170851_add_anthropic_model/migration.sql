-- CreateEnum
CREATE TYPE "AnthropicModel" AS ENUM ('HAIKU', 'SONNET', 'OPUS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "anthropicModel" "AnthropicModel" NOT NULL DEFAULT 'HAIKU';
