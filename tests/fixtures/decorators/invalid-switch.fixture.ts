import { Flow, Switch } from "../../../src/authoring/decorator";

@Flow("invalid-switch")
export class InvalidSwitchFlow {
  @Switch((ctx: { kind: string }) => ctx.kind)
  static broken: void;
}
