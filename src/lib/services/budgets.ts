import type Database from "better-sqlite3";
import { listRecords } from "../db/records";

export interface BudgetStats {
  budgetId?: string;
  income: number;
  spent: number;
  budgeted: number;
  remaining: number;
  utilization: number;
  byCategory: Record<string, number>;
}

function number(value: unknown): number { return typeof value === "number" ? value : Number(value ?? 0) || 0; }

export function calculateBudgetStats(db: Database.Database, budgetId?: string): BudgetStats {
  const budgets = listRecords(db, { type: "budget", archived: false, limit: 1000 }).filter((record) => !budgetId || record.id === budgetId);
  const transactions = listRecords(db, { type: "transaction", archived: false, limit: 10000 }).filter((record) => !budgetId || record.data.budgetId === budgetId);
  let budgeted = 0;
  let income = 0;
  let spent = 0;
  const byCategory: Record<string, number> = {};
  for (const budget of budgets) budgeted += number(budget.data.amount ?? budget.data.budgeted ?? budget.data.limit);
  for (const transaction of transactions) {
    const amount = number(transaction.data.amount ?? transaction.data.value);
    const kind = String(transaction.data.kind ?? transaction.data.type ?? "expense").toLowerCase();
    if (kind === "income" || kind === "credit") income += Math.abs(amount);
    else {
      spent += Math.abs(amount);
      const category = String(transaction.data.category ?? "uncategorized");
      byCategory[category] = (byCategory[category] ?? 0) + Math.abs(amount);
    }
  }
  if (!budgeted && budgets.length === 0) budgeted = spent + number((listRecords(db, { type: "finance", archived: false, limit: 1 })[0]?.data as Record<string, unknown> | undefined)?.budget);
  const remaining = budgeted - spent;
  return { budgetId, income, spent, budgeted, remaining, utilization: budgeted > 0 ? spent / budgeted : 0, byCategory };
}
