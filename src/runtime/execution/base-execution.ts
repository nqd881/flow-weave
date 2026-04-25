import { IStopControl } from "../../contracts";
import { StopSignal } from "../execution-signals";

export abstract class BaseExecution implements IStopControl {
  protected stopRequested = false;
  protected readonly stopListeners = new Set<() => any>();
  protected detachFromParentStop?: () => void;

  constructor(protected readonly parentExecution?: BaseExecution) {}

  requestStop(): void {
    if (this.stopRequested) {
      return;
    }

    this.stopRequested = true;

    for (const listener of [...this.stopListeners]) {
      try {
        void Promise.resolve(listener()).catch(() => undefined);
      } catch {}
    }
  }

  isStopRequested(): boolean {
    return this.stopRequested;
  }

  onStopRequested(action: () => any) {
    this.addStopListener(action);
  }

  attachStopListener(action: () => any): () => void {
    return this.addStopListener(action);
  }

  protected async runAfterFinish(primaryThrowable?: unknown) {
    try {
      await this.afterFinish(primaryThrowable);
    } catch {}
  }

  throwIfStopRequested() {
    if (this.stopRequested) {
      throw new StopSignal();
    }
  }

  protected addStopListener(action: () => any): () => void {
    if (this.stopRequested) {
      try {
        void Promise.resolve(action()).catch(() => undefined);
      } catch {}

      return () => undefined;
    }

    this.stopListeners.add(action);

    return () => {
      this.stopListeners.delete(action);
    };
  }

  protected bindParentStop() {
    if (!this.parentExecution || this.detachFromParentStop) {
      return;
    }

    if (this.parentExecution.isStopRequested()) {
      this.requestStop();
      return;
    }

    this.detachFromParentStop = this.parentExecution.addStopListener(() => {
      this.requestStop();
    });
  }

  protected unbindParentStop() {
    this.detachFromParentStop?.();
    this.detachFromParentStop = undefined;
  }

  protected async runWithParentStopBinding<T>(work: () => Promise<T>): Promise<T> {
    this.bindParentStop();

    try {
      return await work();
    } finally {
      this.unbindParentStop();
    }
  }

  protected async afterFinish(_primaryThrowable?: unknown): Promise<void> {}
}
