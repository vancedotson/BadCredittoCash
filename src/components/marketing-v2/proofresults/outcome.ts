/** Whether an outcome is a removal/deletion (green) vs. another positive
 *  resolution like "paid as agreed" (trust/gold). Brand red is errors-only. */
export function isRemoval(outcome: string) {
  return /remov|delet/i.test(outcome);
}
