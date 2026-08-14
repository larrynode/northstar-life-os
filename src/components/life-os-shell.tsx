"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  Download,
  EyeOff,
  FileText,
  Flame,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Lock,
  LockKeyhole,
  Moon,
  Network,
  NotebookPen,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  UnlockKeyhole,
  Upload,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { decryptVaultEntry, deriveVaultKey, encryptVaultEntry } from "@/lib/vault-crypto";
import type {
  DashboardEventSummary,
  DashboardHabitSummary,
  DashboardInboxSummary,
  DashboardPriority,
  DashboardProjectSummary,
  DashboardReviewSummary,
  DashboardSnapshot,
  DashboardTaskSummary,
} from "@/lib/types";

type ViewId = "home" | "strategy" | "studio" | "projects" | "calendar" | "learning" | "finance" | "health" | "relationships" | "journal" | "knowledge" | "vault" | "settings";
type Modal = "task" | "project" | "habit" | "event" | "inbox" | "review" | "command" | "search" | "import" | null;
type SearchResult = { title: string; type: string; copy: string };
type ImportPreviewState = { total: number; valid: number; invalid: number; duplicates: number; additions: number; errors: Array<{ index: number; message: string }>; rows: Array<{ id: string | null; type: string; title: string | null }> };

const NAV_GROUPS: { label: string; items: { id: ViewId; label: string; icon: LucideIcon }[] }[] = [
  { label: "总览", items: [{ id: "home", label: "指挥中心", icon: LayoutDashboard }, { id: "strategy", label: "战略中心", icon: Compass }] },
  { label: "行动", items: [{ id: "studio", label: "创业工作室", icon: Rocket }, { id: "projects", label: "项目任务", icon: ListTodo }, { id: "calendar", label: "日历习惯", icon: CalendarDays }] },
  { label: "生活", items: [{ id: "learning", label: "学习投资", icon: BookOpen }, { id: "finance", label: "财务", icon: WalletCards }, { id: "health", label: "健康", icon: HeartPulse }, { id: "relationships", label: "关系", icon: UsersRound }] },
  { label: "沉淀", items: [{ id: "journal", label: "日记复盘", icon: NotebookPen }, { id: "knowledge", label: "知识图谱", icon: Network }, { id: "vault", label: "私密库", icon: LockKeyhole }] },
];

const MOBILE_NAV: { id: ViewId; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "首页", icon: LayoutDashboard },
  { id: "projects", label: "项目", icon: ListTodo },
  { id: "calendar", label: "习惯", icon: CalendarDays },
  { id: "journal", label: "复盘", icon: NotebookPen },
];

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  generatedAt: "2026-08-10T00:00:00.000Z",
  timezone: "Asia/Shanghai",
  focus: [
    { id: "open_tasks", label: "未完成任务", value: "0", note: "所有仍需推进的行动" },
    { id: "completed_today", label: "今日完成", value: "0", note: "按上海时区统计" },
    { id: "active_projects", label: "活跃项目", value: "0", note: "进度由任务自动计算" },
    { id: "habits_today", label: "今日习惯", value: "0 / 0", note: "还没有创建习惯" },
  ],
  tasks: [], projects: [], habits: [], schedule: [], inbox: [], reviews: [],
};

const DEMO_SNAPSHOT: DashboardSnapshot = {
  generatedAt: "2026-08-10T09:00:00.000+08:00",
  timezone: "Asia/Shanghai",
  focus: [
    { id: "open_tasks", label: "未完成任务", value: "4", note: "所有仍需推进的行动" },
    { id: "completed_today", label: "今日完成", value: "1", note: "按上海时区统计" },
    { id: "active_projects", label: "活跃项目", value: "3", note: "进度由任务自动计算" },
    { id: "habits_today", label: "今日习惯", value: "2 / 4", note: "今天的打卡进度" },
  ],
  tasks: [
    { id: "demo-task-1", title: "完成 Northstar 首次启动体验", status: "completed", done: true, priority: "高", projectId: "demo-project-1", projectName: "Northstar Life OS", dueAt: "2026-08-10T03:30:00.000Z", updatedAt: "2026-08-10T02:00:00.000Z" },
    { id: "demo-task-2", title: "给潜在用户发 3 封访谈邀请", status: "active", done: false, priority: "高", projectId: "demo-project-1", projectName: "Northstar Life OS", dueAt: "2026-08-10T06:00:00.000Z", updatedAt: "2026-08-10T01:00:00.000Z" },
    { id: "demo-task-3", title: "整理第二季度现金流预测", status: "active", done: false, priority: "中", projectId: "demo-project-2", projectName: "个人系统升级", dueAt: "2026-08-10T09:30:00.000Z", updatedAt: "2026-08-09T08:00:00.000Z" },
    { id: "demo-task-4", title: "读完《The Practice》第二章", status: "active", done: false, priority: "低", projectId: null, projectName: "收件箱", dueAt: null, updatedAt: "2026-08-09T07:00:00.000Z" },
    { id: "demo-task-5", title: "准备产品评审的 3 个决策", status: "active", done: false, priority: "中", projectId: "demo-project-1", projectName: "Northstar Life OS", dueAt: "2026-08-11T02:00:00.000Z", updatedAt: "2026-08-08T07:00:00.000Z" },
  ],
  projects: [
    { id: "demo-project-1", name: "Northstar Life OS", area: "创业", progress: 33, totalTasks: 3, openTasks: 2, completedTasks: 1 },
    { id: "demo-project-2", name: "个人系统升级", area: "生活", progress: 0, totalTasks: 1, openTasks: 1, completedTasks: 0 },
    { id: "demo-project-3", name: "持续学习", area: "成长", progress: 0, totalTasks: 0, openTasks: 0, completedTasks: 0 },
  ],
  habits: [
    { id: "demo-habit-1", name: "晨间书写", currentStreak: 12, longestStreak: 18, completionRate: 6 / 7, completedDates: ["2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09", "2026-08-10"], checkedToday: true },
    { id: "demo-habit-2", name: "运动 30 分钟", currentStreak: 2, longestStreak: 7, completionRate: 4 / 7, completedDates: ["2026-08-05", "2026-08-07", "2026-08-09", "2026-08-10"], checkedToday: true },
    { id: "demo-habit-3", name: "阅读", currentStreak: 0, longestStreak: 18, completionRate: 5 / 7, completedDates: ["2026-08-04", "2026-08-05", "2026-08-06", "2026-08-08", "2026-08-09"], checkedToday: false },
    { id: "demo-habit-4", name: "睡前拉伸", currentStreak: 0, longestStreak: 4, completionRate: 3 / 7, completedDates: ["2026-08-05", "2026-08-07", "2026-08-09"], checkedToday: false },
  ],
  schedule: [
    { id: "demo-event-1", title: "深度工作 · 产品策略", startAt: "2026-08-10T01:30:00.000Z", endAt: "2026-08-10T03:30:00.000Z", place: "书房" },
    { id: "demo-event-2", title: "用户访谈", startAt: "2026-08-10T05:30:00.000Z", endAt: "2026-08-10T06:30:00.000Z", place: "视频会议" },
    { id: "demo-event-3", title: "散步与思考", startAt: "2026-08-10T08:00:00.000Z", endAt: null, place: "滨江公园" },
  ],
  inbox: [
    { id: "demo-inbox-1", title: "周五前确认夏季旅行城市", createdAt: "2026-08-10T01:10:00.000Z" },
    { id: "demo-inbox-2", title: "问问小陈关于播客设备的建议", createdAt: "2026-08-09T02:10:00.000Z" },
  ],
  reviews: [
    { id: "demo-review-1", title: "给自己留白也是进度", copy: "完成了最重要的一件事，下午没有用忙碌掩盖疲惫。", nextStep: "先完成首次启动", createdAt: "2026-08-09T13:00:00.000Z" },
    { id: "demo-review-2", title: "把问题带到现场", copy: "用户访谈中的一个反复出现的词，值得做成下周的实验。", nextStep: "整理访谈模式", createdAt: "2026-08-08T13:00:00.000Z" },
  ],
};

const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

function dateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function cloneDemo(): DashboardSnapshot {
  const snapshot = JSON.parse(JSON.stringify(DEMO_SNAPSHOT)) as DashboardSnapshot;
  const originalAnchor = new Date(DEMO_SNAPSHOT.generatedAt).getTime();
  const currentAnchor = new Date(`${dateKey(new Date())}T09:00:00+08:00`);
  const offset = currentAnchor.getTime() - originalAnchor;
  const shiftDateTime = (value: string) => new Date(new Date(value).getTime() + offset).toISOString();
  const shiftDate = (value: string) => dateKey(new Date(new Date(`${value}T12:00:00+08:00`).getTime() + offset));

  snapshot.generatedAt = currentAnchor.toISOString();
  snapshot.tasks = snapshot.tasks.map((task) => ({
    ...task,
    dueAt: task.dueAt ? shiftDateTime(task.dueAt) : null,
    updatedAt: shiftDateTime(task.updatedAt),
  }));
  snapshot.habits = snapshot.habits.map((habit) => ({
    ...habit,
    completedDates: habit.completedDates.map(shiftDate),
  }));
  snapshot.schedule = snapshot.schedule.map((event) => ({
    ...event,
    startAt: shiftDateTime(event.startAt),
    endAt: event.endAt ? shiftDateTime(event.endAt) : null,
  }));
  snapshot.inbox = snapshot.inbox.map((item) => ({ ...item, createdAt: shiftDateTime(item.createdAt) }));
  snapshot.reviews = snapshot.reviews.map((review) => ({ ...review, createdAt: shiftDateTime(review.createdAt) }));

  return demoRecalculate(snapshot);
}

function formatDateTime(value: string | null): string {
  if (!value) return "稍后";
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "long", day: "numeric" }).format(new Date(value));
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

function demoRecalculate(snapshot: DashboardSnapshot): DashboardSnapshot {
  const today = dateKey(new Date());
  const projects = snapshot.projects.map((project) => {
    const assigned = snapshot.tasks.filter((task) => task.projectId === project.id);
    const completedTasks = assigned.filter((task) => task.done).length;
    return { ...project, totalTasks: assigned.length, completedTasks, openTasks: assigned.length - completedTasks, progress: assigned.length ? Math.round((completedTasks / assigned.length) * 100) : 0 };
  });
  const checked = snapshot.habits.filter((habit) => habit.checkedToday).length;
  return {
    ...snapshot,
    generatedAt: new Date().toISOString(),
    projects,
    focus: [
      { id: "open_tasks", label: "未完成任务", value: String(snapshot.tasks.filter((task) => !task.done).length), note: "所有仍需推进的行动" },
      { id: "completed_today", label: "今日完成", value: String(snapshot.tasks.filter((task) => task.done && dateKey(task.updatedAt) === today).length), note: "按上海时区统计" },
      { id: "active_projects", label: "活跃项目", value: String(projects.length), note: "进度由任务自动计算" },
      { id: "habits_today", label: "今日习惯", value: `${checked} / ${snapshot.habits.length}`, note: snapshot.habits.length ? "今天的打卡进度" : "还没有创建习惯" },
    ],
  };
}

function Panel({ title, icon: Icon, action, children, className = "" }: { title: string; icon?: LucideIcon; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={cn("card card-pad", className)}><div className="section-head"><div className="panel-title">{Icon ? <span className="panel-icon"><Icon size={14} /></span> : null}<h2 className="section-title">{title}</h2></div>{action}</div>{children}</section>;
}

function MetricCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon?: LucideIcon }) {
  return <div className="card metric-card"><div className="metric-top"><span className="metric-label">{label}</span>{Icon ? <span className="panel-icon"><Icon size={14} /></span> : null}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></div>;
}

function EmptyState({ icon: Icon = Inbox, title, copy, action }: { icon?: LucideIcon; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="empty"><Icon size={21} /><div className="empty-title">{title}</div><p className="empty-copy">{copy}</p>{action}</div>;
}

function TaskList({ tasks, onToggle, onAdd }: { tasks: DashboardTaskSummary[]; onToggle: (id: string) => void; onAdd?: () => void }) {
  return <div className="task-list">{tasks.length ? tasks.map((task) => <div className="task-row" key={task.id}><button className={cn("check", task.done && "done")} onClick={() => onToggle(task.id)} aria-label={task.done ? "标记未完成" : "完成任务"}>{task.done ? <Check size={12} strokeWidth={3} /> : null}</button><div className="task-body"><div className={cn("task-title", task.done && "done")}>{task.title}</div><div className="task-meta"><span className={cn("tag", task.priority === "高" ? "tag-rose" : task.priority === "中" ? "tag-yellow" : "")}>{task.priority}优先级</span><span>{task.projectName}</span><span>·</span><span>{formatDateTime(task.dueAt)}</span></div></div></div>) : <EmptyState icon={CheckCircle2} title="今天没有待办" copy="从一个清晰的下一步开始。" action={onAdd ? <button className="btn btn-primary" onClick={onAdd}><Plus size={14} />添加任务</button> : null} />}</div>;
}

function ScheduleList({ items }: { items: DashboardEventSummary[] }) {
  if (!items.length) return <EmptyState icon={CalendarDays} title="还没有日程" copy="给重要的事情留出明确时间。" />;
  return <div className="agenda">{items.map((item) => <div className="agenda-row" key={item.id}><div className="agenda-time">{new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(item.startAt))}</div><div className="agenda-line" /><div className="agenda-main"><div className="agenda-name">{item.title}</div><div className="agenda-place">{formatDate(item.startAt)}{item.place ? ` · ${item.place}` : ""}</div></div></div>)}</div>;
}

function Dashboard({ snapshot, onToggleTask, onAddTask, onNavigate, demoMode }: { snapshot: DashboardSnapshot; onToggleTask: (id: string) => void; onAddTask: () => void; onNavigate: (view: ViewId) => void; demoMode: boolean }) {
  const openHabit = snapshot.habits.find((habit) => !habit.checkedToday);
  const prompt = !snapshot.tasks.length ? "先写下一个真正需要推进的下一步。" : openHabit ? `「${openHabit.name}」今天还没有打卡。` : snapshot.inbox.length ? "收件箱里还有内容等待澄清。" : "今天的系统很安静，可以留一点时间给复盘。";
  return <><div className="headline"><div><div className="eyebrow">{formatLongDate(snapshot.generatedAt)}</div><h1 className="page-title">{demoMode ? "欢迎体验" : "今天，从清晰开始"}</h1><p className="page-intro">只处理真实存在的事，给下一步留出空间。</p></div><div className="headline-actions"><button className="btn" onClick={() => onNavigate("journal")}><NotebookPen size={14} />写下此刻</button><button className="btn btn-primary" onClick={onAddTask}><Plus size={15} />新建任务</button></div></div><div className="grid grid-4" style={{ marginBottom: 15 }}>{snapshot.focus.map((item, index) => <MetricCard key={item.id} {...item} icon={[ListTodo, CheckCircle2, Target, Flame][index]} />)}</div><div className="view-grid"><div className="grid" style={{ gap: 15 }}><Panel title="今日聚焦" icon={Target} action={<button className="section-link" onClick={() => onNavigate("projects")}>管理任务 <ChevronRight size={12} /></button>}><TaskList tasks={snapshot.tasks.slice(0, 5)} onToggle={onToggleTask} onAdd={onAddTask} /></Panel><Panel title="本周习惯" icon={Flame} action={<button className="section-link" onClick={() => onNavigate("calendar")}>查看全部 <ChevronRight size={12} /></button>}>{snapshot.habits.length ? <div className="habit-grid">{snapshot.habits.slice(0, 5).map((habit) => <div className="habit-item" key={habit.id}><div className="habit-name">{habit.name}</div><div style={{ color: "#8b9890", fontSize: 10, marginTop: 6 }}>{habit.currentStreak} 天 · {Math.round(habit.completionRate * 100)}%</div></div>)}</div> : <EmptyState icon={Flame} title="还没有习惯" copy="创建一个值得稳定重复的小动作。" />}</Panel></div><div className="grid" style={{ gap: 15 }}><Panel title="近期安排" icon={CalendarDays} action={<button className="section-link" onClick={() => onNavigate("calendar")}>打开日历 <ArrowUpRight size={12} /></button>}><ScheduleList items={snapshot.schedule.slice(0, 4)} /></Panel><Panel title="一个真实提醒" icon={Sparkles}><div className="insight"><span className="insight-bullet" /><div><p>{prompt}</p><small>根据当前任务、习惯和收件箱生成</small></div></div></Panel><div className="card card-pad quote-card"><div className="eyebrow">今日北极星</div><div className="quote-text">“清晰不是知道所有答案，而是知道下一步要问什么。”</div></div></div></div></>;
}

function ProjectsView({ snapshot, onToggleTask, onOpen }: { snapshot: DashboardSnapshot; onToggleTask: (id: string) => void; onOpen: (modal: Modal) => void }) {
  return <><div className="headline"><div><div className="eyebrow">项目任务</div><h1 className="page-title">把意图落到下一步</h1><p className="page-intro">项目进度由已完成任务自动计算。</p></div><div className="headline-actions"><button className="btn" onClick={() => onOpen("project")}><Plus size={14} />新建项目</button><button className="btn btn-primary" onClick={() => onOpen("task")}><Plus size={14} />新建任务</button></div></div>{snapshot.projects.length ? <div className="grid grid-3" style={{ marginBottom: 15 }}>{snapshot.projects.map((project) => <div className="card card-pad" key={project.id}><span className="tag tag-green">{project.area}</span><div className="list-title" style={{ marginTop: 10 }}>{project.name}</div><div className="progress-label"><span>{project.openTasks} 个进行中任务</span><span>{project.progress}%</span></div><div className="progress"><span style={{ width: `${project.progress}%` }} /></div></div>)}</div> : <div className="card card-pad" style={{ marginBottom: 15 }}><EmptyState icon={Target} title="还没有项目" copy="先建立一个容器，再把任务归到清晰的方向里。" action={<button className="btn btn-primary" onClick={() => onOpen("project")}><Plus size={14} />创建第一个项目</button>} /></div>}<div className="view-grid"><Panel title="所有任务" icon={ListTodo}><TaskList tasks={snapshot.tasks} onToggle={onToggleTask} onAdd={() => onOpen("task")} /></Panel><Panel title="收件箱" icon={Inbox} action={<span className="tag">{snapshot.inbox.length} 条</span>}>{snapshot.inbox.length ? snapshot.inbox.map((item) => <div className="insight" key={item.id}><span className="insight-bullet" /><div><p>{item.title}</p><small>{formatDate(item.createdAt)} · 还未分类</small></div></div>) : <EmptyState icon={Inbox} title="收件箱是空的" copy="先捕捉，不必立即分类。" />}<button className="btn" style={{ width: "100%", marginTop: 14 }} onClick={() => onOpen("inbox")}><Plus size={13} />快速收集</button></Panel></div></>;
}

function CalendarView({ snapshot, onOpen, onCheckIn }: { snapshot: DashboardSnapshot; onOpen: (modal: Modal) => void; onCheckIn: (id: string) => void }) {
  return <><div className="headline"><div><div className="eyebrow">日历习惯</div><h1 className="page-title">给节奏一点形状</h1><p className="page-intro">未来 7 天 · Asia/Shanghai</p></div><div className="headline-actions"><button className="btn" onClick={() => onOpen("event")}><Plus size={14} />添加日程</button><button className="btn btn-primary" onClick={() => onOpen("habit")}><Plus size={14} />添加习惯</button></div></div><div className="view-grid"><Panel title="近期日程" icon={CalendarDays}><ScheduleList items={snapshot.schedule} />{snapshot.schedule.length ? <button className="btn" style={{ marginTop: 10 }} onClick={() => onOpen("event")}><Plus size={13} />添加日程</button> : null}</Panel><Panel title="本周习惯" icon={Flame}>{snapshot.habits.length ? <div className="grid" style={{ gap: 16 }}>{snapshot.habits.map((habit) => <div key={habit.id}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><div><div className="list-title">{habit.name}</div><div className="list-sub">连续 {habit.currentStreak} 天 · 最长 {habit.longestStreak} 天</div></div><button className={cn("btn", habit.checkedToday && "btn-primary")} disabled={habit.checkedToday} onClick={() => onCheckIn(habit.id)}>{habit.checkedToday ? <><Check size={13} />今天已完成</> : "今天打卡"}</button></div><div className="progress-label"><span>最近 7 天完成率</span><span>{Math.round(habit.completionRate * 100)}%</span></div><div className="progress"><span style={{ width: `${Math.round(habit.completionRate * 100)}%` }} /></div></div>)}</div> : <EmptyState icon={Flame} title="还没有习惯" copy="从一个足够小、可以每天完成的动作开始。" action={<button className="btn btn-primary" onClick={() => onOpen("habit")}><Plus size={14} />创建第一个习惯</button>} />}</Panel></div></>;
}

function JournalView({ reviews, onOpen }: { reviews: DashboardReviewSummary[]; onOpen: () => void }) {
  return <><div className="headline"><div><div className="eyebrow">日记复盘</div><h1 className="page-title">让经历留下回声</h1><p className="page-intro">不求完整，只保留真实发生过的东西。</p></div><button className="btn btn-primary" onClick={onOpen}><Plus size={14} />开始今日复盘</button></div><Panel title="最近的回声" icon={RefreshCw}>{reviews.length ? <div className="timeline">{reviews.map((review) => <div className="timeline-item" key={review.id}><div className="timeline-date">{formatDate(review.createdAt)}</div><div className="timeline-title">{review.title}</div><div className="timeline-copy">{review.copy}</div>{review.nextStep ? <div className="list-sub">下一步：{review.nextStep}</div> : null}</div>)}</div> : <EmptyState icon={NotebookPen} title="还没有复盘" copy="写下今天值得保留的一件事。" action={<button className="btn btn-primary" onClick={onOpen}>开始第一次复盘</button>} />}</Panel></>;
}

const DEFERRED_META: Record<Exclude<ViewId, "home" | "projects" | "calendar" | "journal" | "vault" | "settings">, { eyebrow: string; title: string; copy: string; icon: LucideIcon }> = {
  strategy: { eyebrow: "战略中心", title: "长期方向还没有配置", copy: "真实目标和愿景会在后续版本接入；当前不会用演示数字替代。", icon: Compass },
  studio: { eyebrow: "创业工作室", title: "实验工作流尚未启用", copy: "等核心任务闭环稳定后，再把实验、验证和发布接入真实数据。", icon: Rocket },
  learning: { eyebrow: "学习投资", title: "学习数据尚未配置", copy: "书籍、课程和知识卡片会在后续版本接入。", icon: BookOpen },
  finance: { eyebrow: "财务", title: "财务模块暂缓", copy: "账目语义和统计模型将在核心闭环稳定后统一。", icon: WalletCards },
  health: { eyebrow: "健康", title: "健康数据尚未配置", copy: "当前不会根据不存在的记录生成健康趋势。", icon: HeartPulse },
  relationships: { eyebrow: "关系", title: "关系数据尚未配置", copy: "联系人和跟进将在后续版本接入真实投影。", icon: UsersRound },
  knowledge: { eyebrow: "知识图谱", title: "知识关系尚未配置", copy: "普通内容仍可通过右上角搜索；图谱不会展示虚构连接。", icon: Network },
};

function DeferredView({ view, demoMode }: { view: keyof typeof DEFERRED_META; demoMode: boolean }) {
  const meta = DEFERRED_META[view];
  const Icon = meta.icon;
  if (!demoMode) return <><div className="headline"><div><div className="eyebrow">{meta.eyebrow}</div><h1 className="page-title">{meta.title}</h1><p className="page-intro">{meta.copy}</p></div></div><div className="card card-pad"><EmptyState icon={Icon} title="这里保持诚实的空白" copy="当真实数据源接入后，这里才会出现属于你的内容。" /></div></>;
  const samples: Record<string, string[]> = {
    strategy: ["让 Northstar 成为稳定的每周工具", "建立可持续的创作节奏", "保持身体在有能量的区间"],
    studio: ["首次启动体验", "用户访谈 #08", "晨间书写挑战"],
    learning: ["The Practice · 第 2 / 8 章", "产品思维 101 · 第 7 / 12 节", "本周新增 4 条洞见"],
    finance: ["本月收入 ¥18,000", "本月支出 ¥10,228", "储蓄率 32.8%"],
    health: ["睡眠 7h 32m", "本周运动 2h 10m", "今天能量 78%"],
    relationships: ["本周联系 6 人", "待跟进 3 条", "周末给爸妈视频"],
    knowledge: ["节奏感 ↔ 小步实验", "用户反馈 ↔ 北极星", "注意力 ↔ 有余裕"],
  };
  return <><div className="headline"><div><div className="eyebrow">{meta.eyebrow} · 演示</div><h1 className="page-title">示例内容</h1><p className="page-intro">这些内容只用于展示，不会写入真实数据库。</p></div></div><div className="grid grid-3">{samples[view].map((sample) => <div className="card card-pad" key={sample}><span className="panel-icon"><Icon size={14} /></span><div className="list-title" style={{ marginTop: 12 }}>{sample}</div><div className="list-sub">演示数据 · 刷新后重置</div></div>)}</div></>;
}

function encodeBytes(bytes: Uint8Array) { let binary = ""; bytes.forEach((byte) => { binary += String.fromCharCode(byte); }); return btoa(binary); }
function decodeBytes(value: string) { const binary = atob(value); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }

function VaultView({ blocked }: { blocked: boolean }) {
  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const saltRef = useRef<Uint8Array | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); keyRef.current = null; saltRef.current = null; }, []);
  if (blocked) return <><div className="headline"><div><div className="eyebrow">私密库</div><h1 className="page-title">演示模式不会访问真实私密库</h1><p className="page-intro">退出演示模式后才能解锁本机密文。</p></div></div><div className="card card-pad"><EmptyState icon={LockKeyhole} title="私密库已隔离" copy="演示数据与真实私密内容永远不会混合。" /></div></>;
  const unlock = async () => {
    setError("");
    if (!password.trim()) { setError("请输入口令"); return; }
    try {
      const response = await fetch("/api/vault");
      const payload = await response.json();
      const salt = payload.ciphertext?.salt ? decodeBytes(payload.ciphertext.salt) : crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveVaultKey(password, salt);
      if (payload.ciphertext) setNote(await decryptVaultEntry(decodeBytes(payload.ciphertext.data), key, decodeBytes(payload.ciphertext.iv)));
      keyRef.current = key; saltRef.current = salt; setLocked(false); setPassword("");
      timer.current = setTimeout(() => { setLocked(true); setNote(""); keyRef.current = null; saltRef.current = null; }, 15 * 60_000);
    } catch { setError("口令不正确，或者这条内容无法解密"); }
  };
  const save = async () => {
    const key = keyRef.current; const salt = saltRef.current;
    if (!key || !salt) { setError("私密库已锁定，请重新解锁"); return; }
    try {
      const encrypted = await encryptVaultEntry(note, key);
      const ciphertext = { data: encodeBytes(encrypted.ciphertext), salt: encodeBytes(salt), iv: encodeBytes(encrypted.iv) };
      const response = await fetch("/api/vault", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ciphertext }) });
      if (!response.ok) throw new Error("save failed");
      setSaved(true); setTimeout(() => setSaved(false), 2200);
    } catch { setError("保存失败，请稍后重试"); }
  };
  if (locked) return <><div className="headline"><div><div className="eyebrow">私密库</div><h1 className="page-title">只属于你的安静角落</h1><p className="page-intro">内容在浏览器内加密，服务器只看见不可读的密文。</p></div></div><div className="card card-pad" style={{ maxWidth: 520, margin: "34px auto 0" }}><div className="field"><label className="field-label" htmlFor="vault-password">解锁口令</label><input id="vault-password" className="input" type="password" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void unlock()} placeholder="口令不会保存，也无法找回" /></div>{error ? <div style={{ color: "#ad6459", fontSize: 11, marginTop: 9 }}>{error}</div> : null}<div className="insight" style={{ marginTop: 15 }}><AlertTriangle size={14} /><div><p>首次使用请牢记口令。遗失口令将无法恢复内容。</p></div></div><button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={() => void unlock()}><UnlockKeyhole size={14} />解锁私密库</button></div></>;
  return <><div className="headline"><div><div className="eyebrow">私密库 · 已解锁</div><h1 className="page-title">只写给自己的话</h1><p className="page-intro">离开页面或 15 分钟后自动锁定。</p></div><button className="btn" onClick={() => { setLocked(true); setNote(""); keyRef.current = null; saltRef.current = null; }}><Lock size={14} />立即锁定</button></div><div className="card card-pad" style={{ maxWidth: 760, margin: "0 auto" }}><div className="field"><label className="field-label" htmlFor="vault-note">私密内容</label><textarea id="vault-note" className="textarea" style={{ minHeight: 250 }} value={note} onChange={(event) => setNote(event.target.value)} /></div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 13 }}><span className="list-sub"><ShieldCheck size={13} />仅密文离开浏览器</span><button className="btn btn-primary" onClick={() => void save()}><LockKeyhole size={13} />加密保存</button></div>{saved ? <div className="list-sub" style={{ color: "var(--accent)", marginTop: 10 }}>已加密保存</div> : null}</div></>;
}

function ModalFrame({ title, copy, onClose, children, actions, onSubmit }: { title: string; copy: string; onClose: () => void; children: React.ReactNode; actions: React.ReactNode; onSubmit?: (event: FormEvent<HTMLFormElement>) => void }) {
  const content = <><div className="modal-head"><div><h2 className="modal-title">{title}</h2><p className="modal-copy">{copy}</p></div><button type="button" className="icon-btn" onClick={onClose} aria-label="关闭"><X size={16} /></button></div><div className="modal-body">{children}</div><div className="modal-actions">{actions}</div></>;
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>{onSubmit ? <form className="modal" onSubmit={onSubmit}>{content}</form> : <div className="modal">{content}</div>}</div>;
}

export default function LifeOsShell() {
  const [view, setView] = useState<ViewId>("home");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_SNAPSHOT);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dark, setDark] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [taskDraft, setTaskDraft] = useState({ title: "", projectId: "", dueAt: "", priority: "中" as DashboardPriority });
  const [projectDraft, setProjectDraft] = useState({ title: "", area: "" });
  const [habitTitle, setHabitTitle] = useState("");
  const [eventDraft, setEventDraft] = useState({ title: "", startAt: "", endAt: "", location: "" });
  const [inboxTitle, setInboxTitle] = useState("");
  const [reviewDraft, setReviewDraft] = useState({ copy: "", nextStep: "" });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importContent, setImportContent] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2400); }, []);
  const loadOverview = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const response = await fetch("/api/overview", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data?.ok || !data.snapshot) throw new Error(data?.error ?? "overview unavailable");
      setSnapshot(data.snapshot as DashboardSnapshot);
    } catch (error) {
      setSnapshot(EMPTY_SNAPSHOT);
      setLoadError(error instanceof Error ? error.message : "无法加载本地数据");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const savedDemo = window.localStorage.getItem("northstar-demo-mode") === "true";
    const savedTheme = window.localStorage.getItem("northstar-theme") === "dark";
    queueMicrotask(() => {
      setDemoMode(savedDemo); setDark(savedTheme);
      if (savedDemo) { setSnapshot(cloneDemo()); setLoading(false); }
      else void loadOverview();
    });
    const listener = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setModal("command"); } if (event.key === "Escape") setModal(null); };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [loadOverview]);
  useEffect(() => { document.documentElement.style.colorScheme = dark ? "dark" : "light"; window.localStorage.setItem("northstar-theme", dark ? "dark" : "light"); }, [dark]);

  const setDemo = (enabled: boolean) => {
    setDemoMode(enabled); window.localStorage.setItem("northstar-demo-mode", String(enabled)); setLoadError("");
    if (enabled) { setSnapshot(cloneDemo()); setLoading(false); showToast("已进入演示模式，所有操作只在当前会话生效"); }
    else { showToast("已退出演示模式，正在加载真实数据"); void loadOverview(); }
  };

  const createRealItem = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.error ?? "保存失败");
    await loadOverview();
  };

  const toggleTask = async (id: string) => {
    const current = snapshot.tasks.find((task) => task.id === id);
    if (!current) return;
    if (demoMode) {
      setSnapshot((state) => demoRecalculate({ ...state, tasks: state.tasks.map((task) => task.id === id ? { ...task, done: !task.done, status: task.done ? "active" : "completed", updatedAt: new Date().toISOString() } : task) }));
      showToast("演示任务状态已更新（不会保存）"); return;
    }
    setSnapshot((state) => ({ ...state, tasks: state.tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task) }));
    try {
      const response = await fetch(`/api/items/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ done: !current.done }) });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error ?? "更新失败");
      await loadOverview(); showToast("任务状态已更新");
    } catch (error) {
      setSnapshot((state) => ({ ...state, tasks: state.tasks.map((task) => task.id === id ? current : task) }));
      showToast(error instanceof Error ? error.message : "更新失败，已回滚");
    }
  };

  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!taskDraft.title.trim()) return;
    try {
      if (demoMode) {
        const project = snapshot.projects.find((item) => item.id === taskDraft.projectId);
        const task: DashboardTaskSummary = { id: `demo-task-${Date.now()}`, title: taskDraft.title.trim(), status: "active", done: false, priority: taskDraft.priority, projectId: project?.id ?? null, projectName: project?.name ?? "收件箱", dueAt: taskDraft.dueAt ? new Date(taskDraft.dueAt).toISOString() : null, updatedAt: new Date().toISOString() };
        setSnapshot((state) => demoRecalculate({ ...state, tasks: [task, ...state.tasks] }));
      } else await createRealItem({ type: "task", title: taskDraft.title.trim(), projectId: taskDraft.projectId || null, priority: taskDraft.priority, dueAt: taskDraft.dueAt ? new Date(taskDraft.dueAt).toISOString() : null });
      setTaskDraft({ title: "", projectId: "", dueAt: "", priority: "中" }); setModal(null); showToast(demoMode ? "演示任务已创建（不会保存）" : "任务已创建");
    } catch (error) { showToast(error instanceof Error ? error.message : "任务创建失败"); }
  };

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!projectDraft.title.trim()) return;
    try {
      if (demoMode) {
        const project: DashboardProjectSummary = { id: `demo-project-${Date.now()}`, name: projectDraft.title.trim(), area: projectDraft.area.trim() || "其他", progress: 0, totalTasks: 0, openTasks: 0, completedTasks: 0 };
        setSnapshot((state) => demoRecalculate({ ...state, projects: [project, ...state.projects] }));
      } else await createRealItem({ type: "project", title: projectDraft.title.trim(), area: projectDraft.area.trim() || undefined });
      setProjectDraft({ title: "", area: "" }); setModal(null); showToast(demoMode ? "演示项目已创建（不会保存）" : "项目已创建");
    } catch (error) { showToast(error instanceof Error ? error.message : "项目创建失败"); }
  };

  const createHabit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!habitTitle.trim()) return;
    try {
      if (demoMode) {
        const habit: DashboardHabitSummary = { id: `demo-habit-${Date.now()}`, name: habitTitle.trim(), currentStreak: 0, longestStreak: 0, completionRate: 0, completedDates: [], checkedToday: false };
        setSnapshot((state) => demoRecalculate({ ...state, habits: [habit, ...state.habits] }));
      } else await createRealItem({ type: "habit", title: habitTitle.trim() });
      setHabitTitle(""); setModal(null); showToast(demoMode ? "演示习惯已创建（不会保存）" : "习惯已创建");
    } catch (error) { showToast(error instanceof Error ? error.message : "习惯创建失败"); }
  };

  const checkInHabit = async (id: string) => {
    const habit = snapshot.habits.find((item) => item.id === id); if (!habit || habit.checkedToday) return;
    try {
      if (demoMode) {
        const today = dateKey(new Date());
        setSnapshot((state) => demoRecalculate({ ...state, habits: state.habits.map((item) => item.id === id ? { ...item, checkedToday: true, currentStreak: item.currentStreak + 1, longestStreak: Math.max(item.longestStreak, item.currentStreak + 1), completedDates: [...new Set([...item.completedDates, today])], completionRate: Math.min(1, item.completionRate + 1 / 7) } : item) }));
      } else {
        const response = await fetch(`/api/habits/${id}/check-ins`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        const data = await response.json(); if (!response.ok || !data?.ok) throw new Error(data?.error ?? "打卡失败"); await loadOverview();
      }
      showToast(demoMode ? "演示习惯已打卡（不会保存）" : "今天的习惯已完成");
    } catch (error) { showToast(error instanceof Error ? error.message : "打卡失败"); }
  };

  const createEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!eventDraft.title.trim() || !eventDraft.startAt) return;
    try {
      if (demoMode) {
        const item: DashboardEventSummary = { id: `demo-event-${Date.now()}`, title: eventDraft.title.trim(), startAt: new Date(eventDraft.startAt).toISOString(), endAt: eventDraft.endAt ? new Date(eventDraft.endAt).toISOString() : null, place: eventDraft.location.trim() };
        setSnapshot((state) => demoRecalculate({ ...state, schedule: [...state.schedule, item].sort((left, right) => left.startAt.localeCompare(right.startAt)) }));
      } else await createRealItem({ type: "event", title: eventDraft.title.trim(), startAt: new Date(eventDraft.startAt).toISOString(), endAt: eventDraft.endAt ? new Date(eventDraft.endAt).toISOString() : null, location: eventDraft.location.trim() || undefined });
      setEventDraft({ title: "", startAt: "", endAt: "", location: "" }); setModal(null); showToast(demoMode ? "演示日程已创建（不会保存）" : "日程已创建");
    } catch (error) { showToast(error instanceof Error ? error.message : "日程创建失败"); }
  };

  const createInbox = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!inboxTitle.trim()) return;
    try {
      if (demoMode) {
        const item: DashboardInboxSummary = { id: `demo-inbox-${Date.now()}`, title: inboxTitle.trim(), createdAt: new Date().toISOString() };
        setSnapshot((state) => demoRecalculate({ ...state, inbox: [item, ...state.inbox] }));
      } else await createRealItem({ type: "inbox", title: inboxTitle.trim() });
      setInboxTitle(""); setModal(null); showToast(demoMode ? "演示内容已收集（不会保存）" : "已放入收件箱");
    } catch (error) { showToast(error instanceof Error ? error.message : "收集失败"); }
  };

  const createReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!reviewDraft.copy.trim()) return;
    try {
      if (demoMode) {
        const review: DashboardReviewSummary = { id: `demo-review-${Date.now()}`, title: "每日复盘", copy: reviewDraft.copy.trim(), nextStep: reviewDraft.nextStep.trim(), createdAt: new Date().toISOString() };
        setSnapshot((state) => demoRecalculate({ ...state, reviews: [review, ...state.reviews] }));
      } else await createRealItem({ type: "journal", title: "每日复盘", copy: reviewDraft.copy.trim(), nextStep: reviewDraft.nextStep.trim() });
      setReviewDraft({ copy: "", nextStep: "" }); setModal(null); showToast(demoMode ? "演示复盘已创建（不会保存）" : "今日复盘已保存");
    } catch (error) { showToast(error instanceof Error ? error.message : "复盘保存失败"); }
  };

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault(); const search = query.trim(); if (!search) return;
    if (demoMode) {
      const values: SearchResult[] = [
        ...snapshot.tasks.map((item) => ({ title: item.title, type: "task", copy: item.projectName })),
        ...snapshot.projects.map((item) => ({ title: item.name, type: "project", copy: item.area })),
        ...snapshot.habits.map((item) => ({ title: item.name, type: "habit", copy: `${item.currentStreak} 天` })),
        ...snapshot.reviews.map((item) => ({ title: item.title, type: "journal", copy: item.copy })),
      ];
      setSearchResults(values.filter((item) => `${item.title} ${item.copy}`.toLocaleLowerCase("zh-CN").includes(search.toLocaleLowerCase("zh-CN"))));
    } else {
      try { const response = await fetch(`/api/search?q=${encodeURIComponent(search)}`); const data = await response.json(); setSearchResults(data.results ?? []); } catch { setSearchResults([]); }
    }
    setModal("search");
  };

  const exportBackup = async () => {
    if (demoMode) { showToast("请退出演示模式后导出真实数据"); return; }
    try {
      const response = await fetch("/api/backup"); if (!response.ok) throw new Error("export failed");
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `northstar-backup-${dateKey(new Date())}.json`; anchor.click(); URL.revokeObjectURL(url); showToast("普通备份已导出（不含私密库）");
    } catch { showToast("导出失败，请稍后重试"); }
  };

  const previewImportFile = async (file: File) => {
    if (demoMode) { showToast("请退出演示模式后导入真实数据"); return; }
    setImportBusy(true); setImportFile(file); setImportPreview(null);
    try {
      const content = await file.text(); setImportContent(content);
      const response = await fetch("/api/import?action=preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceName: file.name, content }) });
      const data = await response.json(); if (!response.ok || !data?.ok) throw new Error(data?.error ?? "预览失败"); setImportPreview(data.preview);
    } catch (error) { setImportContent(""); showToast(error instanceof Error ? error.message : "预览失败"); }
    finally { setImportBusy(false); }
  };

  const applyImportFile = async () => {
    if (!importFile || !importContent || !importPreview || importPreview.invalid || importPreview.additions < 1) return;
    setImportBusy(true);
    try {
      const response = await fetch("/api/import?action=apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceName: importFile.name, content: importContent }) });
      const data = await response.json(); if (!response.ok || !data?.ok) throw new Error(data?.error ?? "导入失败"); await loadOverview(); setModal(null); setImportFile(null); setImportContent(""); setImportPreview(null); showToast(`已导入 ${data.result.applied} 条记录`);
    } catch (error) { showToast(error instanceof Error ? error.message : "导入失败"); }
    finally { setImportBusy(false); }
  };

  const navigate = (next: ViewId) => { setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const currentLabel = NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === view)?.label ?? "指挥中心";
  const renderView = () => {
    if (loading && !demoMode) return <div className="card card-pad"><EmptyState icon={RefreshCw} title="正在加载本地数据" copy="Northstar 正在读取安全的公开投影。" /></div>;
    if (loadError && !demoMode) return <div className="card card-pad"><EmptyState icon={AlertTriangle} title="无法加载本地数据" copy={loadError} action={<button className="btn btn-primary" onClick={() => void loadOverview()}><RefreshCw size={14} />重试</button>} /></div>;
    if (view === "home") return <Dashboard snapshot={snapshot} onToggleTask={(id) => void toggleTask(id)} onAddTask={() => setModal("task")} onNavigate={navigate} demoMode={demoMode} />;
    if (view === "projects") return <ProjectsView snapshot={snapshot} onToggleTask={(id) => void toggleTask(id)} onOpen={setModal} />;
    if (view === "calendar") return <CalendarView snapshot={snapshot} onOpen={setModal} onCheckIn={(id) => void checkInHabit(id)} />;
    if (view === "journal") return <JournalView reviews={snapshot.reviews} onOpen={() => setModal("review")} />;
    if (view === "vault") return <VaultView blocked={demoMode} />;
    if (view === "settings") return <><div className="headline"><div><div className="eyebrow">设置</div><h1 className="page-title">让系统适应你的生活</h1><p className="page-intro">真实数据和演示数据始终保持清晰边界。</p></div></div><div className="view-grid"><Panel title="外观与模式" icon={SlidersHorizontal}><div className="task-row"><div className="task-body"><div className="task-title">深色模式</div><div className="task-meta"><span>{dark ? "当前已开启" : "当前已关闭"}</span></div></div><button className={cn("btn", dark && "btn-primary")} onClick={() => setDark((value) => !value)}>{dark ? "已开启" : "开启"}</button></div><div className="task-row"><div className="task-body"><div className="task-title">演示模式</div><div className="task-meta"><span>{demoMode ? "交互只在当前会话生效" : "当前使用真实本地数据"}</span></div></div><button className={cn("btn", demoMode && "btn-primary")} onClick={() => setDemo(!demoMode)}>{demoMode ? "退出演示" : "进入演示"}</button></div></Panel><Panel title="数据与隐私" icon={ShieldCheck}><p className="list-sub">普通备份永远不包含私密库；演示模式不会访问任何真实数据操作。</p><div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}><button className="btn" disabled={demoMode} onClick={() => void exportBackup()}><Download size={13} />导出普通备份</button><button className="btn" disabled={demoMode} onClick={() => setModal("import")}><Upload size={13} />导入并预览</button></div><div className="list-sub" style={{ marginTop: 14 }}><EyeOff size={13} />私密库不会进入普通导入导出。</div></Panel></div></>;
    return <DeferredView view={view as keyof typeof DEFERRED_META} demoMode={demoMode} />;
  };

  return <div className={cn("app-shell", dark && "dark")}>
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><Compass size={18} /></span><div><div className="brand-name">northstar</div><div className="brand-sub">your life, in focus</div></div></div><nav className="nav-scroll">{NAV_GROUPS.map((group) => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map((item) => { const Icon = item.icon; return <button className={cn("nav-item", view === item.id && "active")} key={item.id} onClick={() => navigate(item.id)}><Icon size={15} /><span>{item.label}</span></button>; })}</div>)}<div className="nav-group"><div className="nav-label">系统</div><button className={cn("nav-item", view === "settings" && "active")} onClick={() => navigate("settings")}><Settings2 size={15} /><span>设置</span></button></div></nav><div className="sidebar-bottom"><div className="profile"><span className="avatar">北</span><div className="profile-copy"><div className="profile-name">本地用户</div><div className="profile-meta">{demoMode ? "演示空间 · 不保存" : "真实空间 · 本地保存"}</div></div></div></div></aside>
    <main className="main"><header className="topbar"><div className="crumb"><span>Northstar</span><ChevronRight size={13} /><strong>{currentLabel}</strong></div><div className="top-actions"><button className="search-trigger" onClick={() => setModal("command")} aria-label="打开命令面板"><Search size={14} /><span>搜索任何内容…</span><span className="kbd">⌘ K</span></button><button className="icon-btn" onClick={() => setDark((value) => !value)} aria-label="切换深色模式">{dark ? <Sun size={16} /> : <Moon size={16} />}</button><button className="icon-btn" onClick={() => setModal("task")} aria-label="新建任务"><Plus size={17} /></button></div></header>{demoMode ? <div style={{ margin: "14px 22px 0", padding: "10px 13px", borderRadius: 9, background: "#fbf2dc", color: "#87691f", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12 }}><span><Sparkles size={14} style={{ verticalAlign: "-2px", marginRight: 7 }} />演示模式：所有操作只在当前会话生效，刷新后重置。</span><button className="btn" onClick={() => setDemo(false)}>退出演示</button></div> : null}<div className="content">{renderView()}</div></main>
    <nav className="mobile-bar">{MOBILE_NAV.slice(0, 2).map((item) => { const Icon = item.icon; return <button className={cn("mobile-nav", view === item.id && "active")} onClick={() => navigate(item.id)} key={item.id}><Icon size={18} /><span>{item.label}</span></button>; })}<button className="mobile-nav" onClick={() => setModal("task")}><span className="mobile-nav-add"><Plus size={19} /></span><span>新建</span></button>{MOBILE_NAV.slice(2).map((item) => { const Icon = item.icon; return <button className={cn("mobile-nav", view === item.id && "active")} onClick={() => navigate(item.id)} key={item.id}><Icon size={18} /><span>{item.label}</span></button>; })}</nav>

    {modal === "task" ? <ModalFrame title="新建任务" copy="创建后会进入真实任务列表。" onClose={() => setModal(null)} onSubmit={createTask} actions={<><button type="button" className="btn" onClick={() => setModal(null)}>取消</button><button className="btn btn-primary" type="submit">创建任务</button></>}><div className="form-grid"><div className="field full"><label className="field-label" htmlFor="task-title">任务名称</label><input id="task-title" className="input" autoFocus value={taskDraft.title} onChange={(event) => setTaskDraft((value) => ({ ...value, title: event.target.value }))} /></div><div className="field"><label className="field-label" htmlFor="task-project">所属项目</label><select id="task-project" className="select" value={taskDraft.projectId} onChange={(event) => setTaskDraft((value) => ({ ...value, projectId: event.target.value }))}><option value="">收件箱</option>{snapshot.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div><div className="field"><label className="field-label" htmlFor="task-due">截止时间</label><input id="task-due" className="input" type="datetime-local" value={taskDraft.dueAt} onChange={(event) => setTaskDraft((value) => ({ ...value, dueAt: event.target.value }))} /></div><div className="field full"><label className="field-label">优先级</label><div style={{ display: "flex", gap: 7 }}>{(["高", "中", "低"] as DashboardPriority[]).map((item) => <button type="button" className={cn("btn", taskDraft.priority === item && "btn-primary")} onClick={() => setTaskDraft((value) => ({ ...value, priority: item }))} key={item}>{item}</button>)}</div></div></div></ModalFrame> : null}
    {modal === "project" ? <ModalFrame title="新建项目" copy="项目进度会根据任务完成情况自动计算。" onClose={() => setModal(null)} onSubmit={createProject} actions={<><button type="button" className="btn" onClick={() => setModal(null)}>取消</button><button className="btn btn-primary" type="submit">创建项目</button></>}><div className="field"><label className="field-label" htmlFor="project-title">项目名称</label><input id="project-title" className="input" autoFocus value={projectDraft.title} onChange={(event) => setProjectDraft((value) => ({ ...value, title: event.target.value }))} /></div><div className="field" style={{ marginTop: 12 }}><label className="field-label" htmlFor="project-area">所属领域</label><input id="project-area" className="input" value={projectDraft.area} onChange={(event) => setProjectDraft((value) => ({ ...value, area: event.target.value }))} placeholder="例如：工作、成长、生活" /></div></ModalFrame> : null}
    {modal === "habit" ? <ModalFrame title="新建习惯" copy="默认按最近 7 天计算完成率。" onClose={() => setModal(null)} onSubmit={createHabit} actions={<><button type="button" className="btn" onClick={() => setModal(null)}>取消</button><button className="btn btn-primary" type="submit">创建习惯</button></>}><div className="field"><label className="field-label" htmlFor="habit-title">习惯名称</label><input id="habit-title" className="input" autoFocus value={habitTitle} onChange={(event) => setHabitTitle(event.target.value)} placeholder="例如：晨间书写" /></div></ModalFrame> : null}
    {modal === "event" ? <ModalFrame title="添加日程" copy="时间以本机输入并保存为 ISO 时间。" onClose={() => setModal(null)} onSubmit={createEvent} actions={<><button type="button" className="btn" onClick={() => setModal(null)}>取消</button><button className="btn btn-primary" type="submit">创建日程</button></>}><div className="form-grid"><div className="field full"><label className="field-label" htmlFor="event-title">日程名称</label><input id="event-title" className="input" autoFocus value={eventDraft.title} onChange={(event) => setEventDraft((value) => ({ ...value, title: event.target.value }))} /></div><div className="field"><label className="field-label" htmlFor="event-start">开始时间</label><input id="event-start" className="input" required type="datetime-local" value={eventDraft.startAt} onChange={(event) => setEventDraft((value) => ({ ...value, startAt: event.target.value }))} /></div><div className="field"><label className="field-label" htmlFor="event-end">结束时间</label><input id="event-end" className="input" type="datetime-local" value={eventDraft.endAt} onChange={(event) => setEventDraft((value) => ({ ...value, endAt: event.target.value }))} /></div><div className="field full"><label className="field-label" htmlFor="event-location">地点</label><input id="event-location" className="input" value={eventDraft.location} onChange={(event) => setEventDraft((value) => ({ ...value, location: event.target.value }))} /></div></div></ModalFrame> : null}
    {modal === "inbox" ? <ModalFrame title="快速收集" copy="先捕捉，稍后再分类。" onClose={() => setModal(null)} onSubmit={createInbox} actions={<><button type="button" className="btn" onClick={() => setModal(null)}>取消</button><button className="btn btn-primary" type="submit">放入收件箱</button></>}><div className="field"><label className="field-label" htmlFor="inbox-title">内容</label><input id="inbox-title" className="input" autoFocus value={inboxTitle} onChange={(event) => setInboxTitle(event.target.value)} /></div></ModalFrame> : null}
    {modal === "review" ? <ModalFrame title="今日复盘" copy="不求完整，只求诚实。" onClose={() => setModal(null)} onSubmit={createReview} actions={<><button type="button" className="btn" onClick={() => setModal(null)}>稍后再写</button><button className="btn btn-primary" type="submit">完成复盘</button></>}><div className="field"><label className="field-label" htmlFor="review-copy">今天什么事情值得保留？</label><textarea id="review-copy" className="textarea" autoFocus value={reviewDraft.copy} onChange={(event) => setReviewDraft((value) => ({ ...value, copy: event.target.value }))} /></div><div className="field" style={{ marginTop: 12 }}><label className="field-label" htmlFor="review-next">明天最重要的一步是？</label><input id="review-next" className="input" value={reviewDraft.nextStep} onChange={(event) => setReviewDraft((value) => ({ ...value, nextStep: event.target.value }))} /></div></ModalFrame> : null}
    {modal === "command" ? <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}><div className="modal command-modal"><form className="command-input-wrap" onSubmit={(event) => void runSearch(event)}><Search size={16} /><input className="command-input" autoFocus placeholder="搜索任务、项目与复盘…" value={query} onChange={(event) => setQuery(event.target.value)} /></form><div className="command-list"><button className="command-item" onClick={() => setModal("task")}><span className="panel-icon"><Plus size={14} /></span><span className="command-item-copy"><span className="command-item-title">新建任务</span><span className="command-item-sub">放入真实行动列表</span></span></button><button className="command-item" onClick={() => setModal("review")}><span className="panel-icon"><NotebookPen size={14} /></span><span className="command-item-copy"><span className="command-item-title">开始今日复盘</span><span className="command-item-sub">给经历留下回声</span></span></button></div></div></div> : null}
    {modal === "search" ? <ModalFrame title="搜索结果" copy={`${demoMode ? "在演示数据" : "在普通本地内容"}中搜索「${query}」`} onClose={() => setModal(null)} actions={<button className="btn" onClick={() => setModal(null)}>关闭</button>}>{searchResults.length ? searchResults.map((result, index) => <div className="command-item" key={`${result.type}-${result.title}-${index}`}><span className="panel-icon"><FileText size={14} /></span><span className="command-item-copy"><span className="command-item-title">{result.title}</span><span className="command-item-sub">{result.type} · {result.copy}</span></span></div>) : <EmptyState icon={Search} title="没有找到匹配内容" copy="试试更短的关键词。" />}</ModalFrame> : null}
    {modal === "import" ? <ModalFrame title="导入并预览" copy="只支持 JSON；先预览，再事务应用。" onClose={() => setModal(null)} actions={<><button className="btn" onClick={() => setModal(null)}>取消</button><button className="btn btn-primary" disabled={importBusy || !importPreview || importPreview.invalid > 0 || importPreview.additions < 1} onClick={() => void applyImportFile()}>{importBusy ? "处理中…" : "确认应用"}</button></>}>{!importFile ? <button className="empty" style={{ width: "100%", minHeight: 180 }} onClick={() => fileInput.current?.click()}><Upload size={20} /><div className="empty-title">选择 JSON 文件</div><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void previewImportFile(file); }} /></button> : <><div className="task-row"><FileText size={18} /><div className="task-body"><div className="task-title">{importFile.name}</div><div className="task-meta">{importBusy ? "正在检查…" : "预览完成"}</div></div><button className="icon-btn" onClick={() => { setImportFile(null); setImportContent(""); setImportPreview(null); }}><X size={14} /></button></div>{importPreview ? <><div className="grid grid-3" style={{ marginTop: 14 }}><MetricCard label="可新增" value={String(importPreview.additions)} note="将写入数据库" /><MetricCard label="重复" value={String(importPreview.duplicates)} note="会自动跳过" /><MetricCard label="无效" value={String(importPreview.invalid)} note="存在时禁止应用" /></div>{importPreview.errors.length ? <div className="insight" style={{ marginTop: 14 }}><AlertTriangle size={14} /><div>{importPreview.errors.slice(0, 5).map((error) => <p key={`${error.index}-${error.message}`}>第 {error.index + 1} 条：{error.message}</p>)}</div></div> : null}</> : null}</>}</ModalFrame> : null}
    {toast ? <div className="toast"><CheckCircle2 size={15} />{toast}</div> : null}
  </div>;
}
