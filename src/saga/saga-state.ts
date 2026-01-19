export enum SagaState {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
  CompletedWithError = "completed-with-error",
  Compensating = "compensating",
  Compensated = "compensated",
  CompensatedWithError = "compensated-with-error",
}
