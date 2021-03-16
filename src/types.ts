import {JsonValue, ReadonlyDeep} from "type-fest"
import {BalambError} from "./errors"

export type Id = string

export type BaseResultType = JsonValue | void

export interface Options {
  /** Maximum number of tasks to run concurrently */
  concurrency?: number
  /** Pre-seed with results of e.g. a previous run */
  preSeed?: Record<Id, BaseResultType>
}

export interface BalambType {
  /**
   * Plant the seeds, concurrently, in dependency order.
   *
   * Must not contain duplicate IDs, or define circular dependencies.
   */
  run(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seeds: Array<SeedDef<any, any>>,
    opts?: Options,
  ): Promise<BalambResult | BalambError>
}

/**
 * Defines a `Seed` (a task to be run), along with some metadata.
 */
export type SeedDef<Result extends BaseResultType, Dependencies> = Readonly<
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
 *
 * @returns a Promise for a serialisable JSON value
 */
export type SeedRunner<Result extends BaseResultType, Dependencies> = (
  dependencies: ReadonlyDeep<Dependencies>,
) => Promise<Result>

export interface BalambResult {
  readonly results: Record<Id, BaseResultType>
}

export const assertNever = (_x: never): never => {
  throw new Error("Should never be reached")
}
