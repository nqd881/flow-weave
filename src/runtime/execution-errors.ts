export abstract class ExecutionError extends Error {}

export class UncaughtBreakLoopError extends ExecutionError {
  constructor() {
    super("break() must be used inside while() or forEach().");
  }
}

export class UnsupportedParallelBreakError extends ExecutionError {
  constructor() {
    super("break() is not supported inside parallel or parallelForEach branches.");
  }
}

export class InvalidExecutionStateError extends ExecutionError {
  constructor() {
    super("Execution must be pending to start.");
  }
}

export class StepOutcomeResolutionError extends ExecutionError {
  constructor() {
    super("Step outcome must be resolved before finish.");
  }
}

export class InvalidRetryMaxAttemptsError extends ExecutionError {
  constructor() {
    super("Step retry maxAttempts must be a positive integer.");
  }
}

export class InvalidRetryInitialDelayError extends ExecutionError {
  constructor() {
    super("Step retry initialDelayMs must be a non-negative finite number.");
  }
}

export class InvalidRetryMaxDelayError extends ExecutionError {
  constructor() {
    super("Step retry maxDelayMs must be a non-negative finite number.");
  }
}

export class InvalidRetryBackoffError extends ExecutionError {
  constructor() {
    super("Step retry backoff must be 'constant' or 'exponential'.");
  }
}

export class InvalidDelayDurationError extends ExecutionError {
  constructor() {
    super("Delay duration must be a non-negative finite number.");
  }
}
