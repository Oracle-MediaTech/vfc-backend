import {
  Prisma,
  SyncOperation,
  SyncStatus,
} from "@prisma/client";

export async function getNextSequence(
  tx: Prisma.TransactionClient,
): Promise<bigint> {
  const result = await tx.syncSequence.upsert({
    where: {
      id: 1,
    },

    update: {
      current: {
        increment: 1,
      },
    },

    create: {
      id: 1,
      current: 1,
    },

    select: {
      current: true,
    },
  });

  return result.current;
}

export async function createSyncChange(
  tx: Prisma.TransactionClient,
  data: {
    sourceDatabaseId: string;
    entity: string;
    entityId: string;
    operation: SyncOperation;
    entityVersion: number;
    payload: Prisma.InputJsonValue | null;
  },
) {
  const sequence = await getNextSequence(tx);

  return tx.syncChange.create({
    data: {
      sourceDatabaseId: data.sourceDatabaseId,
      entity: data.entity,
      entityId: data.entityId,
      operation: data.operation,
      entityVersion: data.entityVersion,
      payload: data.payload ?? Prisma.JsonNull,
      sequence,
    },
  });
}

export async function getPendingChanges(
  databaseId: string,
  limit = 100,
) {
  return prisma.syncChange.findMany({
    where: {
      sourceDatabaseId: databaseId,
      status: SyncStatus.PENDING,
    },

    orderBy: {
      sequence: "asc",
    },

    take: limit,
  });
}

export async function markChangesAsSynced(
  ids: string[],
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  await prisma.syncChange.updateMany({
    where: {
      id: {
        in: ids,
      },
    },

    data: {
      status: SyncStatus.SYNCED,
      syncedAt: new Date(),
    },
  });
}