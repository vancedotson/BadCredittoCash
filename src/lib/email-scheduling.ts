export function scheduledFor(delay: string, index: number, anchor?: Date, now = new Date()): Date {
  if (delay === "immediately") return now;
  if ((process.env.EMAIL_MODE ?? "test") !== "production") {
    return new Date(now.getTime() + Math.max(1, index) * 5 * 60 * 1000);
  }
  if (delay === "1 day before" && anchor) {
    return new Date(Math.max(now.getTime(), anchor.getTime() - 24 * 60 * 60 * 1000));
  }
  if (delay === "weekly") return new Date(now.getTime() + (index + 1) * 7 * 24 * 60 * 60 * 1000);
  const match = delay.match(/^\+(\d+)\s+(hour|day)s?/);
  if (!match) throw new Error(`Unsupported sequence delay: ${delay}`);
  const amount = Number(match[1]);
  const unitMs = match[2] === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + amount * unitMs);
}
