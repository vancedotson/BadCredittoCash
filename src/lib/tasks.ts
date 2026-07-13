/**
 * Task taxonomy — priority, type, recurrence. Pure config shared by the store,
 * the task API, and the Tasks UI (labels + ordering + colors).
 */

export type TaskPriority = "high" | "normal" | "low";
export type TaskType = "call" | "email" | "follow_up" | "document" | "other";
export type Recurrence = "none" | "weekly" | "monthly";

export const PRIORITIES: TaskPriority[] = ["high", "normal", "low"];
export const PRIORITY_LABELS: Record<TaskPriority, string> = { high: "High", normal: "Normal", low: "Low" };
export const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };
export const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: "var(--color-red)",
  normal: "var(--color-slate)",
  low: "#cbd5e1",
};

export const TASK_TYPES: TaskType[] = ["call", "email", "follow_up", "document", "other"];
export const TYPE_LABELS: Record<TaskType, string> = {
  call: "Call",
  email: "Email",
  follow_up: "Follow-up",
  document: "Document",
  other: "Task",
};
/** Icon key resolved to a component in the UI. */
export const TYPE_ICON: Record<TaskType, "phone" | "mail" | "refresh" | "document" | "check"> = {
  call: "phone",
  email: "mail",
  follow_up: "refresh",
  document: "document",
  other: "check",
};

export const RECURRENCES: Recurrence[] = ["none", "weekly", "monthly"];
export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "Does not repeat",
  weekly: "Weekly",
  monthly: "Monthly",
};

export function isTaskPriority(v: unknown): v is TaskPriority {
  return typeof v === "string" && (PRIORITIES as string[]).includes(v);
}
export function isTaskType(v: unknown): v is TaskType {
  return typeof v === "string" && (TASK_TYPES as string[]).includes(v);
}
export function isRecurrence(v: unknown): v is Recurrence {
  return typeof v === "string" && (RECURRENCES as string[]).includes(v);
}
