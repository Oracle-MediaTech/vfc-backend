import type { SyncOperation } from "@prisma/client";

export interface SyncChangePayload {
  id: string;

  sourceDatabaseId: string;

  entity: string;

  entityId: string;

  operation: SyncOperation;

  entityVersion: number;

  payload: Record<string, unknown> | null;

  sequence: string;

  createdAt: string;
}

export interface PushChangesRequest {
  sourceDatabaseId: string;

  changes: SyncChangePayload[];
}

export interface PullChangesResponse {
  sourceDatabaseId: string;

  changes: SyncChangePayload[];

  lastSequence: string;

  hasMore: boolean;
}

export interface SyncResult {
  pushed: number;

  pulled: number;

  conflicts: number;

  failed: number;

  lastPushedSequence: string;

  lastPulledSequence: string;
}