-- CreateTable
CREATE TABLE "SmokeTest" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmokeTest_pkey" PRIMARY KEY ("id")
);
