/**
 * ESLite Schema Migrations for Poly Data Client-Side Stores
 *
 * Uses the ESLite Schema Migration System (estream-io #555) with
 * schema_version tracking and onMigrate() hooks.
 *
 * Stores:
 *   /polydata/files    — File metadata + manifest cache
 *   /polydata/index    — Encrypted search index
 *   /polydata/offline  — Offline manifest + encrypted cache
 *   /polydata/classify — Classification policy cache
 */

import type { ESLiteStore, ESLiteMigration } from '@estream/sdk-browser';
import { ESLITE_TABLES } from '../generated/types';

// ─── /polydata/files — File metadata + manifest cache ────────────────────────

export const filesMigrations: ESLiteMigration[] = [
  {
    version: 1,
    description: 'Initial file metadata schema',
    up: async (store: ESLiteStore) => {
      await store.createTable(ESLITE_TABLES.FILES, {
        columns: {
          file_id: { type: 'blob', primaryKey: true },        // FileId (16 bytes)
          name: { type: 'text', indexed: true },
          path: { type: 'text', indexed: true },
          size: { type: 'integer' },
          classification: { type: 'text', indexed: true },     // Classification enum
          manifest_hash: { type: 'blob' },                     // SHA3-256 of SignedManifest
          manifest_cached: { type: 'blob', nullable: true },   // Serialized SignedManifest
          wrapped_file_key: { type: 'blob' },                  // WrappedFileKey
          created_at: { type: 'integer', indexed: true },
          updated_at: { type: 'integer', indexed: true },
          version_count: { type: 'integer', default: 1 },
          owner_spark_did: { type: 'text' },
        },
      });
    },
  },
  {
    version: 2,
    description: 'Add sharing metadata to file records',
    up: async (store: ESLiteStore) => {
      await store.addColumn(ESLITE_TABLES.FILES, 'shared_with_count', {
        type: 'integer',
        default: 0,
      });
      await store.addColumn(ESLITE_TABLES.FILES, 'ephemeral_link_active', {
        type: 'boolean',
        default: false,
      });
    },
  },
];

// ─── /polydata/index — Encrypted search index ────────────────────────────────

export const indexMigrations: ESLiteMigration[] = [
  {
    version: 1,
    description: 'Initial encrypted search index',
    up: async (store: ESLiteStore) => {
      await store.createTable(ESLITE_TABLES.INDEX, {
        columns: {
          term_hash: { type: 'blob', primaryKey: true },   // SHA3-256 of search term
          file_ids: { type: 'blob' },                       // Encrypted list of FileIds
          term_count: { type: 'integer' },
          last_updated: { type: 'integer' },
        },
      });
    },
  },
  {
    version: 2,
    description: 'Add classification-scoped index partitions',
    up: async (store: ESLiteStore) => {
      await store.addColumn(ESLITE_TABLES.INDEX, 'classification', {
        type: 'text',
        indexed: true,
        default: 'PUBLIC',
      });
    },
  },
];

// ─── /polydata/offline — Offline manifest + encrypted cache ──────────────────

export const offlineMigrations: ESLiteMigration[] = [
  {
    version: 1,
    description: 'Initial offline cache schema',
    up: async (store: ESLiteStore) => {
      await store.createTable(ESLITE_TABLES.OFFLINE, {
        columns: {
          file_id: { type: 'blob', primaryKey: true },
          encrypted_data: { type: 'blob' },                  // Device-bound key encrypted
          manifest: { type: 'blob' },                         // Cached SignedManifest
          classification: { type: 'text', indexed: true },
          cached_at: { type: 'integer', indexed: true },
          expires_at: { type: 'integer', indexed: true, nullable: true },
          size_bytes: { type: 'integer' },
        },
        ttl: {
          column: 'expires_at',
          cleanupInterval: 60_000, // check every 60s
        },
      });
    },
  },
  {
    version: 2,
    description: 'Add sync state tracking for selective offline',
    up: async (store: ESLiteStore) => {
      await store.addColumn(ESLITE_TABLES.OFFLINE, 'sync_state', {
        type: 'text',
        default: 'synced', // synced | pending | stale
      });
      await store.addColumn(ESLITE_TABLES.OFFLINE, 'last_sync_at', {
        type: 'integer',
        nullable: true,
      });
    },
  },
];

// ─── /polydata/classify — Classification policy cache ────────────────────────

export const classifyMigrations: ESLiteMigration[] = [
  {
    version: 1,
    description: 'Initial classification policy cache',
    up: async (store: ESLiteStore) => {
      await store.createTable(ESLITE_TABLES.CLASSIFY, {
        columns: {
          path_pattern: { type: 'text', primaryKey: true },  // glob pattern
          classification: { type: 'text' },                    // Classification enum
          source: { type: 'text' },                            // 'manual' | 'inherited' | 'eslm' | 'policy'
          confidence: { type: 'real', nullable: true },        // ESLM confidence (0.0-1.0)
          applied_at: { type: 'integer' },
          policy_hash: { type: 'blob', nullable: true },       // hash of .polyclassification
        },
      });
    },
  },
  {
    version: 2,
    description: 'Add ESLM feedback tracking to classification cache',
    up: async (store: ESLiteStore) => {
      await store.addColumn(ESLITE_TABLES.CLASSIFY, 'human_reviewed', {
        type: 'boolean',
        default: false,
      });
      await store.addColumn(ESLITE_TABLES.CLASSIFY, 'human_rating', {
        type: 'integer',
        nullable: true,
      });
    },
  },
];

// ─── Migration Registry ──────────────────────────────────────────────────────

export async function runAllMigrations(store: ESLiteStore): Promise<void> {
  await store.migrate(ESLITE_TABLES.FILES, filesMigrations);
  await store.migrate(ESLITE_TABLES.INDEX, indexMigrations);
  await store.migrate(ESLITE_TABLES.OFFLINE, offlineMigrations);
  await store.migrate(ESLITE_TABLES.CLASSIFY, classifyMigrations);
}
