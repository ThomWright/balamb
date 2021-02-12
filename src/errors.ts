import {expectType, TypeOf} from "ts-expect"
import {assertNever, Id} from "./types"

export const ERROR_CODES = [
  "NON_UNIQUE_IDS",
  "CIRCULAR_DEPENDENCY",
  "SEED_FAILURES",
] as const
export type ErrorCode = typeof ERROR_CODES[number]

function ErrorMessage(error: BalambErrorInfo): string {
  switch (error.code) {
    case "NON_UNIQUE_IDS":
      return "Non-unique seed IDs found: " + error.duplicates.join(", ")

    case "CIRCULAR_DEPENDENCY":
      return "Circular dependency found: " + error.cycle.join("->")

    case "SEED_FAILURES":
      // TODO: report the actual errors too
      return (
        "One or more seeds failed to run: " +
        error.failures.map((f) => f.id).join(", ")
      )

    default:
      return assertNever(error)
  }
}

export interface NonUniqueIds {
  readonly code: "NON_UNIQUE_IDS"
  readonly duplicates: Array<Id>
}
export interface CircularDependency {
  readonly code: "CIRCULAR_DEPENDENCY"
  readonly cycle: Array<Id>
}
export interface SeedFailures {
  readonly code: "SEED_FAILURES"
  readonly failures: Array<SeedFailure>
}
export interface SeedFailure {
  readonly id: Id
  readonly error: unknown
}

export type BalambErrorInfo = NonUniqueIds | CircularDependency | SeedFailures
expectType<TypeOf<ErrorCode, BalambErrorInfo["code"]>>(true)

export class BalambError extends Error {
  constructor(public readonly info: BalambErrorInfo) {
    super(ErrorMessage(info))
  }
}

export type RegistrationErrorInfo = NonUniqueIds | CircularDependency
expectType<TypeOf<ErrorCode, RegistrationErrorInfo["code"]>>(true)
expectType<TypeOf<BalambErrorInfo, RegistrationErrorInfo>>(true)

export class RegistrationError extends BalambError {
  constructor(public readonly info: RegistrationErrorInfo) {
    super(info)
  }
}

export type RunErrorInfo = SeedFailures
expectType<TypeOf<ErrorCode, RunErrorInfo["code"]>>(true)
expectType<TypeOf<BalambErrorInfo, RunErrorInfo>>(true)

export class RunError extends BalambError {
  constructor(public readonly info: RunErrorInfo) {
    super(info)
  }
}
