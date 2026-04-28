import { IFlowDef } from "../../../src";
import { Flow, Task, Try } from "../../../src/authoring/decorator";

@Flow("valid-try")
export class ValidTryFlow {
  declare static readonly flowDef: IFlowDef;

  @Task()
  static run() {}
}

@Flow("invalid-try")
export class InvalidTryFlow {
  @Try(ValidTryFlow)
  static broken: void;
}
