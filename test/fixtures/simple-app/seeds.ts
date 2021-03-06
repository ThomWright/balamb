import {nextTick} from "process"
import {SeedDef} from "../../../src"

export const CreateAString: SeedDef<string, void> = {
  id: "a_string",
  description: "Just returns a string",

  plant: async () => "a string",
}

type AnObj = {
  s: string
}
export const CreateAnObjFromString: SeedDef<AnObj, {s: string}> = {
  id: "an_object",
  description: "Just returns an object, based on its dependency",

  dependsOn: {s: CreateAString},

  plant: async ({s}) => ({
    s,
  }),
}

export const MultipleDeps: SeedDef<
  number,
  {
    aString: string
    someObject: AnObj
  }
> = {
  id: "multiple_deps",
  description: "Has multiple deps, one of which has its own deps",

  dependsOn: {
    aString: CreateAString,
    someObject: CreateAnObjFromString,
  },

  plant: async ({aString, someObject}) => {
    return aString.length + someObject.s.length
  },
}

export const Fail: SeedDef<number, void> = {
  id: "fail",
  description: "Throws an error",

  plant: async () => {
    await new Promise<void>((resolve, reject) => {
      nextTick(() => reject("Oh no"))
    })
    return 5
  },
}

export const createBlank = (id: string): SeedDef<void, void> => {
  return {
    id,
    description: id,

    plant: async () => {
      await new Promise<void>((resolve) => {
        nextTick(() => resolve())
      })
    },
  }
}
