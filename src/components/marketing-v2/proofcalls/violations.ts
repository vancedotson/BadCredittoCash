/** Derive a short disc code and a statute label from a clip title. */
export function code(title: string) {
  if (title.includes("FDCPA")) return "FDCPA";
  if (title.includes("FCRA")) return "FCRA";
  return "REC";
}

export function statute(title: string) {
  if (title.includes("FDCPA")) return "FDCPA §807";
  if (title.includes("FCRA")) return "FCRA §1681";
  return "Admission";
}
