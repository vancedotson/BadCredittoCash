export function evergreenTrainingEnabled(): boolean {
  return process.env.EVERGREEN_TRAINING_ENABLED === "true";
}
