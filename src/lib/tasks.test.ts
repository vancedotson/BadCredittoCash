import { describe, expect, it } from "vitest";
import { isRecurrence, isTaskPriority, isTaskType, PRIORITIES, RECURRENCES, TASK_TYPES } from "./tasks";

describe("task field validation", () => {
  it.each(PRIORITIES)("accepts priority %s", (value) => {
    expect(isTaskPriority(value)).toBe(true);
  });

  it.each(TASK_TYPES)("accepts task type %s", (value) => {
    expect(isTaskType(value)).toBe(true);
  });

  it.each(RECURRENCES)("accepts recurrence %s", (value) => {
    expect(isRecurrence(value)).toBe(true);
  });

  it.each([undefined, null, 1, "", "urgent", "High", " high"])(
    "rejects invalid priority %j",
    (value) => expect(isTaskPriority(value)).toBe(false),
  );

  it.each([undefined, null, {}, "", "sms", "Follow-up", "call "])(
    "rejects invalid task type %j",
    (value) => expect(isTaskType(value)).toBe(false),
  );

  it.each([undefined, null, [], "", "daily", "Weekly", "monthly "])(
    "rejects invalid recurrence %j",
    (value) => expect(isRecurrence(value)).toBe(false),
  );
});
