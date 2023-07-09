-- CreateTable
CREATE TABLE "OAuth" (
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerUsername" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserExample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OAuth_userId_idx" ON "OAuth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuth_provider_providerUserId_key" ON "OAuth"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuth_userId_provider_key" ON "OAuth"("userId", "provider");
