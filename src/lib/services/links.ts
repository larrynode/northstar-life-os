import type Database from "better-sqlite3";
import { createLink, getLinkedRecords, listLinks, removeLink } from "../db/records";
export { createLink, getLinkedRecords, listLinks, removeLink };

/** Add a relation once; traversal is intentionally bidirectional. */
export function linkBothWays(db: Database.Database, fromId: string, toId: string, relation = "related", metadata: Record<string, unknown> = {}) {
  return createLink(db, fromId, toId, relation, metadata);
}
