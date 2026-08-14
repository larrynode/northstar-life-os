import type Database from "better-sqlite3";
import { getRecord, listActivity, listRecords, logActivity } from "../db/records";
import type { NorthstarRecord } from "../types";

export interface HabitContinuity {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  completedDates: string[];
  completionRate: number;
}

function day(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`invalid habit date: ${String(value)}`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function calculateHabitContinuity(db: Database.Database, habit: NorthstarRecord | string, asOf = new Date()): HabitContinuity {
  const record = typeof habit === "string" ? getRecord(db, habit) : habit;
  if (!record) throw new Error(`habit not found: ${typeof habit === "string" ? habit : habit.id}`);
  const activities = listActivity(db, { recordId: record.id, kind: "habit_checkin", limit: 10000 });
  const dates = [...new Set(activities.map((entry) => day(entry.occurredAt)))].sort();
  const dateSet = new Set(dates);
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const date of dates) {
    const current = new Date(`${date}T00:00:00.000Z`);
    if (previous && (current.getTime() - previous.getTime()) === 86_400_000) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
    previous = current;
  }
  const cursor = new Date(`${day(asOf)}T00:00:00.000Z`);
  let currentStreak = 0;
  while (dateSet.has(cursor.toISOString().slice(0, 10))) {
    currentStreak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  const periodDays = Math.max(1, Number(record.data.frequencyDays ?? record.data.periodDays ?? 30));
  const start = new Date(`${day(asOf)}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - periodDays + 1);
  const completedInPeriod = dates.filter((date) => date >= start.toISOString().slice(0, 10)).length;
  return { habitId: record.id, currentStreak, longestStreak: longest, completedDates: dates, completionRate: Math.min(1, completedInPeriod / periodDays) };
}

export function listHabitContinuity(db: Database.Database, asOf = new Date()): HabitContinuity[] {
  return listRecords(db, { type: "habit", archived: false, limit: 1000 }).map((habit) => calculateHabitContinuity(db, habit, asOf));
}

export function checkInHabit(db: Database.Database, habitId: string, occurredAt = new Date()): { created: boolean; date: string; continuity: HabitContinuity } {
  const habit = getRecord(db, habitId);
  if (!habit || habit.type !== "habit") throw new Error(`habit not found: ${habitId}`);
  const targetDate = day(occurredAt);
  const existing = listActivity(db, { recordId: habitId, kind: "habit_checkin", limit: 10_000 }).find((entry) => day(entry.occurredAt) === targetDate);
  if (!existing) logActivity(db, { recordId: habitId, kind: "habit_checkin", occurredAt, content: { date: targetDate } });
  return { created: !existing, date: targetDate, continuity: calculateHabitContinuity(db, habit, occurredAt) };
}
