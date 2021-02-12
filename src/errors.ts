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
  code: "NON_UNIQUE_IDS"
  duplicates: Array<Id>
}
export interface CircularDependency {
  code: "CIRCULAR_DEPENDENCY"
  cycle: Array<Id>
}
export interface SeedFailures {
  code: "SEED_FAILURES"
  failures: Array<SeedFailure>
}
export interface SeedFailure {
  id: Id
  error: unknown
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
