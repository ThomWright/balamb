import {ReadonlyDeep} from "type-fest"
import {BalambError, RegistrationError, RunError} from "./errors"

export type Id = string

export interface BalambType {
  /**
   * Plant the seeds, concurrently, in dependency order.
   *
   * Must not contain duplicate IDs, or define circular dependencies.
   */
  run(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seeds: Array<SeedDef<any, any>>,
    opts?: {concurrency: number},
  ): Promise<RunResult | BalambError>

  /**
   * Register seeds to run.
   *
   * Must not contain duplicate IDs, or define circular dependencies.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(seeds: Array<SeedDef<any, any>>): SeedPlanter | RegistrationError
}

/**
 * Defines a `Seed` (a task to be run), along with some metadata.
 */
export type SeedDef<Result, Dependencies> = Readonly<
  {
    /** IDs must be unique */
    id: Id
    /** Human-readable description */
    description: string

    /**
     * The seeding operation. Plants the seed!
     * @see SeedRunner
     */
    plant: SeedRunner<Result, Dependencies>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } & (Dependencies extends Record<string, any>
    ? {
        /**
         * Named dependencies, results of which will be available in the `plant` function.
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dependsOn: {[Id in keyof Dependencies]: SeedDef<Dependencies[Id], any>}
      }
    : Record<string, unknown>)
>

/**
 * The seeding function.
 * @param dependencies Results of named dependencies
 */
export type SeedRunner<Result, Dependencies> = (
  dependencies: ReadonlyDeep<Dependencies>,
) => Promise<Result>

/**
 * Seeds ready for planting.
 */
export interface SeedPlanter {
  /**
   * Plant the seeds, concurrently, in dependency order.
   */
  run(opts?: {concurrency: number}): Promise<RunResult | RunError>
}

export interface RunResult {
  readonly results: Record<Id, unknown>
}

export const assertNever = (_x: never): never => {
  throw new Error("Should never be reached")
}
