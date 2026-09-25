-- CreateTable
CREATE TABLE "GameSave" (
    "id" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "initialGrid" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "currentGrid" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "won" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);
