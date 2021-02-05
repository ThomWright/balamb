import {SeedDef} from "../../src/types"

export const a_string: SeedDef<string, void> = {
  id: "a_string",
  description: "Just returns a string",

  plant: async () => "thing",
}

export interface AnObj {
  n: number
}
export const an_object: SeedDef<AnObj, {s: string}> = {
  id: "an_object",
  description: "Just returns an object, based on its dependency",

  dependsOn: {s: a_string},

  plant: async ({s}) => ({
    n: s.length,
  }),
}
