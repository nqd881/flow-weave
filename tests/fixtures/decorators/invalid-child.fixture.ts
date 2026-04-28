import { ChildFlow, Flow } from "../../../src/authoring/decorator";

export class NotDecoratedFlow {}

@Flow("invalid-child")
export class InvalidChildFlow {
  @ChildFlow(NotDecoratedFlow as any)
  static broken: void;
}
