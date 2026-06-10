import { PrismaClient } from "@prisma/client";

function prismaClientSingleton() {
  return new PrismaClient({
    // Never include PIN hashes in query results unless a call site explicitly
    // opts back in (login does, via `omit: { pinHash: false }`). Endpoints like
    // GET /api/users return raw user rows, so without this the hash would be
    // sent to every logged-in client.
    omit: { user: { pinHash: true } },
  });
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
};

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (import.meta.env?.DEV)
  globalThis.prismaGlobal = prisma;
