import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/lib/db/client";
import { applyDraft, createDraft, createLink, createRecord, getLinkedRecords, listRecords, logActivity, reviewDraft } from "../../src/lib/db/records";
import { calculateBudgetStats } from "../../src/lib/services/budgets";
import { getGoalProgress } from "../../src/lib/services/goals";
import { calculateHabitContinuity, checkInHabit } from "../../src/lib/services/habits";
import { aggregateReview } from "../../src/lib/services/reviews";
import { buildDashboardSnapshot, dateKeyInTimeZone } from "../../src/lib/services/overview";
import { resolveDataPaths } from "../../src/lib/paths";
import { attachFile, attachmentPath, listAttachments } from "../../src/lib/attachments";

const tempRoots: string[] = [];
function dbFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-test-"));
  tempRoots.push(root);
  const handle = createDatabase({ paths: resolveDataPaths({ NORTHSTAR_DATA_DIR: root }) });
  return handle;
}
afterEach(() => { for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe("Northstar records and migrations", () => {
  it("creates idempotent schema and round-trips typed data/tags", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-test-"));
    tempRoots.push(root);
    const paths = resolveDataPaths({ NORTHSTAR_DATA_DIR: root });
    const handle = createDatabase({ paths });
    const record = createRecord(handle.db, { type: "goal", title: "Ship", data: { target: 10, current: 4 }, tags: ["work", "#focus"] });
    expect(getGoalProgress(handle.db, record.id).progress).toBe(0.4);
    expect(listRecords(handle.db, { type: "goal" })[0].tags).toEqual(["focus", "work"]);
    handle.close();
    const reopened = createDatabase({ paths });
    expect(reopened.db.prepare("SELECT version FROM schema_migrations").get()).toEqual({ version: 1 });
    reopened.close();
  });

  it("traverses links in either direction", () => {
    const handle = dbFixture();
    const a = createRecord(handle.db, { type: "project", title: "A" });
    const b = createRecord(handle.db, { type: "task", title: "B" });
    createLink(handle.db, a.id, b.id, "contains");
    expect(getLinkedRecords(handle.db, a.id)[0].id).toBe(b.id);
    expect(getLinkedRecords(handle.db, b.id)[0].id).toBe(a.id);
    handle.close();
  });

  it("requires draft approval before applying", () => {
    const handle = dbFixture();
    const draft = createDraft(handle.db, { operation: "create", entityType: "note", payload: { title: "Draft" } });
    expect(() => applyDraft(handle.db, draft.id)).toThrow(/approved/);
    reviewDraft(handle.db, draft.id, "approve");
    expect(applyDraft(handle.db, draft.id)).toMatchObject({ type: "note", title: "Draft" });
    handle.close();
  });

  it("computes habit continuity, budget stats and review aggregates", () => {
    const handle = dbFixture();
    const habit = createRecord(handle.db, { type: "habit", title: "Walk", data: { frequencyDays: 7 } });
    logActivity(handle.db, { recordId: habit.id, kind: "habit_checkin", occurredAt: new Date("2026-08-09T10:00:00Z") });
    logActivity(handle.db, { recordId: habit.id, kind: "habit_checkin", occurredAt: new Date("2026-08-10T10:00:00Z") });
    expect(calculateHabitContinuity(handle.db, habit, new Date("2026-08-10T12:00:00Z")).currentStreak).toBe(2);
    createRecord(handle.db, { type: "budget", title: "August", data: { amount: 100 } });
    createRecord(handle.db, { type: "transaction", title: "Lunch", data: { amount: 20, category: "food" } });
    expect(calculateBudgetStats(handle.db).remaining).toBe(80);
    expect(aggregateReview(handle.db, "monthly").activities).toBe(2);
    handle.close();
  });

  it("stores attachment metadata and copies bytes into the protected attachment directory", () => {
    const handle = dbFixture();
    const record = createRecord(handle.db, { type: "learning_note", title: "Source note" });
    const source = path.join(handle.paths.root, "source.txt");
    fs.writeFileSync(source, "local attachment");
    const attachment = attachFile(handle.db, source, { recordId: record.id, originalName: "notes.txt", mediaType: "text/plain", paths: handle.paths });
    expect(listAttachments(handle.db, record.id)).toEqual([attachment]);
    expect(fs.readFileSync(attachmentPath(attachment, handle.paths), "utf8")).toBe("local attachment");
    expect(fs.statSync(attachmentPath(attachment, handle.paths)).mode & 0o777).toBe(0o600);
    handle.close();
  });

  it("returns a complete honest dashboard snapshot for an empty database", () => {
    const handle = dbFixture();
    const snapshot = buildDashboardSnapshot(handle.db, new Date("2026-08-10T12:00:00.000Z"));
    expect(snapshot).toMatchObject({
      timezone: "Asia/Shanghai",
      tasks: [], projects: [], habits: [], schedule: [], inbox: [], reviews: [],
      focus: [
        { id: "open_tasks", value: "0" },
        { id: "completed_today", value: "0" },
        { id: "active_projects", value: "0" },
        { id: "habits_today", value: "0 / 0" },
      ],
    });
    handle.close();
  });

  it("derives project progress and resolves current plus legacy task assignments", () => {
    const handle = dbFixture();
    const project = createRecord(handle.db, { type: "project", title: "Northstar", data: { area: "work" } });
    createRecord(handle.db, { type: "task", title: "Current", status: "completed", data: { projectId: project.id, priority: "高" } });
    createRecord(handle.db, { type: "task", title: "Legacy field", status: "active", data: { project: "Northstar" } });
    createRecord(handle.db, { type: "task", title: "Legacy tag", status: "active", tags: ["Northstar"] });
    const snapshot = buildDashboardSnapshot(handle.db, new Date("2026-08-10T12:00:00.000Z"));
    expect(snapshot.projects[0]).toMatchObject({ id: project.id, totalTasks: 3, completedTasks: 1, openTasks: 2, progress: 33 });
    expect(snapshot.tasks.every((task) => task.projectId === project.id && task.projectName === "Northstar")).toBe(true);
    handle.close();
  });

  it("uses Shanghai calendar days for metrics, events and idempotent habit check-ins", () => {
    const handle = dbFixture();
    const anchor = new Date("2026-08-10T16:30:00.000Z"); // 2026-08-11 00:30 in Shanghai
    expect(dateKeyInTimeZone(anchor)).toBe("2026-08-11");
    const task = createRecord(handle.db, { type: "task", title: "Across midnight", status: "completed" });
    handle.db.prepare("UPDATE records SET updated_at = ? WHERE id = ?").run("2026-08-10T16:05:00.000Z", task.id);
    createRecord(handle.db, { type: "event", title: "Early Shanghai event", startAt: "2026-08-10T16:15:00.000Z" });
    const habit = createRecord(handle.db, { type: "habit", title: "Read", data: { periodDays: 7 } });
    expect(checkInHabit(handle.db, habit.id, anchor).created).toBe(true);
    expect(checkInHabit(handle.db, habit.id, new Date("2026-08-10T17:00:00.000Z")).created).toBe(false);
    expect(handle.db.prepare("SELECT COUNT(*) AS count FROM activity WHERE record_id = ?").get(habit.id)).toEqual({ count: 1 });
    const snapshot = buildDashboardSnapshot(handle.db, anchor);
    expect(snapshot.focus.find((metric) => metric.id === "completed_today")?.value).toBe("1");
    expect(snapshot.schedule).toHaveLength(1);
    expect(snapshot.habits[0]).toMatchObject({ checkedToday: true, currentStreak: 1 });
    handle.close();
  });
});
