/*
  Warnings:

  - You are about to drop the `UserExample` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "UserExample_email_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "UserExample";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "hashedPassword" TEXT,
    "fullName" TEXT NOT NULL,
    "salt" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiresAt" DATETIME,
    "roles" TEXT
);
INSERT INTO "new_User" ("email", "fullName", "hashedPassword", "id", "resetToken", "resetTokenExpiresAt", "roles", "salt") SELECT "email", "fullName", "hashedPassword", "id", "resetToken", "resetTokenExpiresAt", "roles", "salt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "new_OAuth" (
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerUsername" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OAuth" ("createdAt", "provider", "providerUserId", "providerUsername", "userId") SELECT "createdAt", "provider", "providerUserId", "providerUsername", "userId" FROM "OAuth";
DROP TABLE "OAuth";
ALTER TABLE "new_OAuth" RENAME TO "OAuth";
CREATE INDEX "OAuth_userId_idx" ON "OAuth"("userId");
CREATE UNIQUE INDEX "OAuth_provider_providerUserId_key" ON "OAuth"("provider", "providerUserId");
CREATE UNIQUE INDEX "OAuth_userId_provider_key" ON "OAuth"("userId", "provider");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
