import {ReadonlyDeep} from "type-fest"
import {RegistrationError, RunError} from "./errors"

export type Id = string

export interface BalambType {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(seeds: Array<SeedDef<any, any>>): SeededGarden | RegistrationError
}

export type SeedDef<Result, Dependencies> = Readonly<
  {
    id: Id
    description: string
    tags?: ReadonlyArray<string>
    idempotent?: boolean

    plant: SeedRunner<Result, Dependencies>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } & (Dependencies extends Record<string, any>
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {dependsOn: {[Id in keyof Dependencies]: SeedDef<Dependencies[Id], any>}}
    : Record<string, unknown>)
>

export type SeedRunner<Result, Dependencies> = (
  i: ReadonlyDeep<Dependencies>,
) => Promise<Result>

export interface SeededGarden {
  /**
   * Plant seeds
   */
  run: Run
}

export interface Run {
  (opts?: {concurrency: number}): Promise<RunResult | RunError>
}

export interface RunResult {
  available: number
  planted: number
}

export const assertNever = (_x: never): never => {
  throw new Error("Should never be reached")
}
