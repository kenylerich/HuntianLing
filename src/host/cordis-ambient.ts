/**
 * Compile-time stand-in for `@deepseek-ai/cordis` when vendor `lib/` is absent.
 * Runtime still loads the real package via Node module resolution.
 */

export interface Context {
  plugin<T = unknown>(value: Plugin<T>, config?: T): unknown;
  provide(name: string, value: unknown): unknown;
  get(name: string): unknown;
  effect(execute: () => unknown, label?: string): unknown;
}

export interface Plugin<T = unknown> {
  name?: string;
  inject?: readonly string[] | Record<string, unknown>;
  provide?: string | readonly string[];
  apply(ctx: Context, config?: T): unknown;
}

export abstract class Service {
  public name!: string;
}
