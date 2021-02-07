import {ReadonlyDeep} from "type-fest"

export interface BalambType {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(seeds: Array<SeedDef<any, any>>): SeededGarden | BalambError
}

export type SeedDef<Result, Dependencies> = Readonly<
  {
    id: string
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
  run: Run
}

export interface Run {
  (): Promise<RunResult>
}

export interface RunResult {
  available: number
  run: number
}

export const ERROR_CODES = ["NON_UNIQUE_IDS"] as const
export type ErrorCode = typeof ERROR_CODES[number]

const ErrorMessages: Record<ErrorCode, string> = {
  NON_UNIQUE_IDS: "Non-unique seed IDs found",
}

export class BalambError extends Error {
  constructor(public code: ErrorCode) {
    super(ErrorMessages[code])
  }
}
