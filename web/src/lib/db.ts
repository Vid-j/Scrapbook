import { PrismaClient } from "@prisma/client";

// One client per process; Next dev hot reload would otherwise open many.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma's default logging never includes query parameters, so message text
// does not reach the logs. Keep it at warn/error.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
