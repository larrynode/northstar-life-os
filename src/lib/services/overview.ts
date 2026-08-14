import type Database from "better-sqlite3";
import { listRecords } from "../db/records";
import { calculateHabitContinuity } from "./habits";
import type {
  DashboardEventSummary,
  DashboardHabitSummary,
  DashboardPriority,
  DashboardProjectSummary,
  DashboardSnapshot,
  DashboardTaskSummary,
  NorthstarRecord,
} from "../types";

export const DASHBOARD_TIMEZONE = "Asia/Shanghai" as const;

const CLOSED_STATUSES = new Set(["completed", "cancelled", "archived"]);

export function dateKeyInTimeZone(value: string | Date, timeZone = DASHBOARD_TIMEZONE): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`invalid date: ${String(value)}`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addCalendarDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function priority(value: unknown): DashboardPriority {
  return value === "高" || value === "低" ? value : "中";
}

function isDone(record: NorthstarRecord): boolean {
  return record.status === "completed" || record.data.done === true;
}

function projectForTask(
  task: NorthstarRecord,
  projectsById: Map<string, NorthstarRecord>,
  projectsByName: Map<string, NorthstarRecord>,
): { projectId: string | null; projectName: string } {
  const direct = text(task.data.projectId);
  if (direct && projectsById.has(direct)) {
    const project = projectsById.get(direct)!;
    return { projectId: project.id, projectName: project.title ?? "未命名项目" };
  }
  const legacy = text(task.data.project);
  const legacyProject = projectsById.get(legacy) ?? projectsByName.get(legacy.toLocaleLowerCase("zh-CN"));
  if (legacyProject) return { projectId: legacyProject.id, projectName: legacyProject.title ?? "未命名项目" };
  for (const tag of task.tags) {
    const taggedProject = projectsByName.get(tag.toLocaleLowerCase("zh-CN"));
    if (taggedProject) return { projectId: taggedProject.id, projectName: taggedProject.title ?? "未命名项目" };
  }
  return { projectId: null, projectName: legacy || "收件箱" };
}

export function buildDashboardSnapshot(db: Database.Database, anchor = new Date()): DashboardSnapshot {
  const records = listRecords(db, { archived: false, limit: 10_000, order: "desc" });
  const projects = records.filter((record) => record.type === "project" && !CLOSED_STATUSES.has(record.status ?? ""));
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const projectsByName = new Map(projects.flatMap((project) => project.title ? [[project.title.toLocaleLowerCase("zh-CN"), project] as const] : []));

  const taskRecords = records.filter((record) => record.type === "task");
  const taskAssignments = new Map(taskRecords.map((task) => [task.id, projectForTask(task, projectsById, projectsByName)]));
  const tasks: DashboardTaskSummary[] = taskRecords.map((task) => {
    const assignment = taskAssignments.get(task.id)!;
    return {
      id: task.id,
      title: task.title ?? "未命名任务",
      status: task.status,
      done: isDone(task),
      priority: priority(task.data.priority),
      projectId: assignment.projectId,
      projectName: assignment.projectName,
      dueAt: task.dueAt,
      updatedAt: task.updatedAt,
    };
  }).sort((left, right) => {
    if (left.done !== right.done) return left.done ? 1 : -1;
    if (left.dueAt && right.dueAt) return left.dueAt.localeCompare(right.dueAt);
    if (left.dueAt !== right.dueAt) return left.dueAt ? -1 : 1;
    return right.updatedAt.localeCompare(left.updatedAt);
  });

  const projectSummaries: DashboardProjectSummary[] = projects.map((project) => {
    const assigned = taskRecords.filter((task) => taskAssignments.get(task.id)?.projectId === project.id);
    const completedTasks = assigned.filter(isDone).length;
    const totalTasks = assigned.length;
    return {
      id: project.id,
      name: project.title ?? "未命名项目",
      area: text(project.data.area, "其他"),
      progress: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
      totalTasks,
      openTasks: totalTasks - completedTasks,
      completedTasks,
    };
  });

  const today = dateKeyInTimeZone(anchor);
  const habits: DashboardHabitSummary[] = records.filter((record) => record.type === "habit").map((habit) => {
    const continuity = calculateHabitContinuity(db, habit, anchor);
    return {
      id: habit.id,
      name: habit.title ?? "未命名习惯",
      currentStreak: continuity.currentStreak,
      longestStreak: continuity.longestStreak,
      completionRate: continuity.completionRate,
      completedDates: continuity.completedDates,
      checkedToday: continuity.completedDates.includes(today),
    };
  });

  const lastScheduleDay = addCalendarDays(today, 6);
  const schedule: DashboardEventSummary[] = records.filter((record) => record.type === "event" && record.startAt).flatMap((event) => {
    try {
      const dateKey = dateKeyInTimeZone(event.startAt!);
      if (dateKey < today || dateKey > lastScheduleDay) return [];
      return [{
        id: event.id,
        title: event.title ?? "未命名日程",
        startAt: event.startAt!,
        endAt: event.endAt,
        place: text(event.data.location ?? event.data.place),
      }];
    } catch {
      return [];
    }
  }).sort((left, right) => left.startAt.localeCompare(right.startAt));

  const reviews = records.filter((record) => ["journal", "daily_review", "weekly_review", "monthly_review"].includes(record.type)).map((record) => ({
    id: record.id,
    title: record.title ?? "一段记录",
    copy: text(record.data.copy ?? record.data.text),
    nextStep: text(record.data.nextStep),
    createdAt: record.createdAt,
  }));
  const inbox = records.filter((record) => record.type === "inbox").map((record) => ({ id: record.id, title: record.title ?? "未命名收集", createdAt: record.createdAt }));

  const completedToday = tasks.filter((task) => task.done && dateKeyInTimeZone(task.updatedAt) === today).length;
  const checkedHabits = habits.filter((habit) => habit.checkedToday).length;
  return {
    generatedAt: anchor.toISOString(),
    timezone: DASHBOARD_TIMEZONE,
    focus: [
      { id: "open_tasks", label: "未完成任务", value: String(tasks.filter((task) => !task.done).length), note: "所有仍需推进的行动" },
      { id: "completed_today", label: "今日完成", value: String(completedToday), note: "按上海时区统计" },
      { id: "active_projects", label: "活跃项目", value: String(projectSummaries.length), note: "进度由任务自动计算" },
      { id: "habits_today", label: "今日习惯", value: `${checkedHabits} / ${habits.length}`, note: habits.length ? "今天的打卡进度" : "还没有创建习惯" },
    ],
    tasks,
    projects: projectSummaries,
    habits,
    schedule,
    inbox,
    reviews,
  };
}
