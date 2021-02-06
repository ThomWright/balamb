import {
  BalambError,
  BalambType,
  RunResult,
  SeedDef,
  SeededGarden,
} from "./types"

export const Balamb: BalambType = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(seeds: Array<SeedDef<any, any>>): SeededGarden | BalambError {
    if (containsDuplicates(seeds.map((seed) => seed.id))) {
      return new BalambError("NON_UNIQUE_IDS")
    }

    return {
      run: async (): Promise<RunResult> => {
        return {
          available: seeds.length,
          run: seeds.length,
        }
      },
    }
  },
}

function containsDuplicates<T>(array: Array<T>): boolean {
  return new Set(array).size !== array.length
}
