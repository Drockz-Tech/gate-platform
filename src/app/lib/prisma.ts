// lib/prisma.ts
//
// Central Prisma client used across the app.
// - Uses a global singleton in development to avoid "too many clients" errors.
// - Uses minimal logging in production, verbose in development.

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

const createPrismaClient = () =>
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  });

export const prisma: PrismaClient =
  global.__prisma__ ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma__ = prisma;
}
