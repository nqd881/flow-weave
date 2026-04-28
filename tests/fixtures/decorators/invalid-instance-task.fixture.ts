import { Task } from "../../../src/authoring/decorator";

export class InvalidDecoratorTarget {
  @Task()
  run() {}
}
