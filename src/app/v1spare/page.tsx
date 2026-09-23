import { redirect } from "next/navigation";

/** Retire the historical marketing page that contained placeholder proof. */
export default function V1SparePage(): never {
  redirect("/");
}
