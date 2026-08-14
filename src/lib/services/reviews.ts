import type Database from "better-sqlite3";
import { listActivity, listRecords } from "../db/records";

export type ReviewPeriod = "daily" | "weekly" | "monthly";
export interface ReviewAggregate {
  period: ReviewPeriod;
  start: string;
  end: string;
  activities: number;
  byKind: Record<string, number>;
  completed: number;
  open: number;
  highlights: string[];
}

function range(period: ReviewPeriod, anchor = new Date()): { start: Date; end: Date } {
  const end = new Date(anchor);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  if (period === "daily") start.setHours(0, 0, 0, 0);
  else if (period === "weekly") { start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); }
  else { start.setHours(0, 0, 0, 0); start.setDate(1); }
  return { start, end };
}

export function aggregateReview(db: Database.Database, period: ReviewPeriod = "daily", anchor = new Date()): ReviewAggregate {
  const bounds = range(period, anchor);
  const activities = listActivity(db, { since: bounds.start.toISOString(), until: bounds.end.toISOString(), limit: 10000 });
  const byKind: Record<string, number> = {};
  const highlights: string[] = [];
  for (const activity of activities) {
    byKind[activity.kind] = (byKind[activity.kind] ?? 0) + 1;
    const text = activity.content.text ?? activity.content.note ?? activity.content.title;
    if (typeof text === "string" && text.trim()) highlights.push(text.trim());
  }
  const records = listRecords(db, { archived: false, limit: 10000 });
  const completed = records.filter((record) => record.status === "completed" && record.updatedAt >= bounds.start.toISOString() && record.updatedAt <= bounds.end.toISOString()).length;
  const open = records.filter((record) => !["completed", "cancelled", "archived"].includes(record.status ?? "")).length;
  return { period, start: bounds.start.toISOString(), end: bounds.end.toISOString(), activities: activities.length, byKind, completed, open, highlights: highlights.slice(0, 20) };
}
