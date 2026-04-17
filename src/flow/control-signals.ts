export abstract class ControlSignal extends Error {}

export class StopSignal extends ControlSignal {
  constructor() {
    super("Execution was stopped.");
  }
}

export class BreakLoopSignal extends ControlSignal {
  constructor() {
    super("Execution requested to break the enclosing loop.");
  }
}
