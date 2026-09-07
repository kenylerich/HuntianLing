/**
 * Compile-time stand-in for `@deepseek-ai/cordis` when vendor `lib/` is absent.
 * Runtime still loads the real package via Node module resolution.
 */

export interface Context {
  plugin(value: unknown): unknown;
  provide(name: string, value: unknown): unknown;
  get(name: string): unknown;
}

export interface Plugin {
  name?: string;
  apply(ctx: Context): void;
}

export abstract class Service {
  public name!: string;
}
