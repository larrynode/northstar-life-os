import type Database from "better-sqlite3";
import { getRecord, listRecords } from "../db/records";
import type { NorthstarRecord } from "../types";

export interface GoalProgress {
  goalId: string;
  current: number;
  target: number;
  progress: number;
  remaining: number;
  complete: boolean;
}

function numeric(data: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return fallback;
}

export function calculateGoalProgress(goal: NorthstarRecord | { id: string; data?: Record<string, unknown>; status?: string | null }): GoalProgress {
  const data = goal.data ?? {};
  const target = numeric(data, ["target", "targetValue", "target_value", "total"], 1);
  const current = numeric(data, ["current", "currentValue", "current_value", "progress", "value"], goal.status === "completed" ? target : 0);
  const denominator = target === 0 ? 1 : Math.abs(target);
  const progress = Math.max(0, Math.min(1, current / denominator));
  return { goalId: goal.id, current, target, progress, remaining: Math.max(0, target - current), complete: progress >= 1 || goal.status === "completed" };
}

export function getGoalProgress(db: Database.Database, goalId: string): GoalProgress {
  const goal = getRecord(db, goalId);
  if (!goal) throw new Error(`goal not found: ${goalId}`);
  return calculateGoalProgress(goal);
}

export function listGoalProgress(db: Database.Database): GoalProgress[] {
  return listRecords(db, { type: "goal", archived: false, limit: 1000 }).map(calculateGoalProgress);
}
