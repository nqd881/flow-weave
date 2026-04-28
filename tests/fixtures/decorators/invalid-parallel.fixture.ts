import { Flow, Parallel } from "../../../src/authoring/decorator";

@Flow("invalid-parallel")
export class InvalidParallelFlow {
  @Parallel()
  static broken: void;
}
