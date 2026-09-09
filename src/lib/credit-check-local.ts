import "server-only";

import { mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { CreditCheckSubmission } from "./credit-check-validation";

export async function saveLocalCreditCheckSubmission(submission: CreditCheckSubmission): Promise<string> {
  if (process.env.NODE_ENV !== "development") throw new Error("Local credit-check storage is development-only.");
  const directory = join(process.cwd(), ".local", "credit-check");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  // A separate file per submission avoids concurrent requests overwriting data.
  // The token is deliberately excluded from persistence and responses.
  const record = {
    id,
    createdAt: new Date().toISOString(),
    source: "credit-check",
    name: submission.name,
    email: submission.email,
    phone: submission.phone,
    answers: submission.answers,
    attribution: submission.attribution,
    visitorId: submission.visitorId ?? null,
  };
  const file = await open(join(directory, `${id}.json`), "wx", 0o600);
  try {
    await file.writeFile(JSON.stringify(record, null, 2), "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
  return id;
}
