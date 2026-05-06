-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "subcategoryId" TEXT;

-- CreateTable
CREATE TABLE "DocumentSubcategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "order" DOUBLE PRECISION,
    "universeId" TEXT,
    "seriesId" TEXT,
    "storyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSubcategory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "DocumentSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSubcategory" ADD CONSTRAINT "DocumentSubcategory_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSubcategory" ADD CONSTRAINT "DocumentSubcategory_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSubcategory" ADD CONSTRAINT "DocumentSubcategory_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
