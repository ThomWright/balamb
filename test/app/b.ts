import {SeedDef} from "../../src/types"
import {a_string, an_object, AnObj} from "./a"

export const multiple_deps: SeedDef<
  number,
  {
    some_string: string
    an_obj: AnObj
  }
> = {
  id: "multiple_deps",
  description: "Has multiple deps, one of which has its own deps",

  dependsOn: {
    some_string: a_string,
    an_obj: an_object,
  },

  plant: async ({some_string, an_obj}) => {
    return some_string.length + an_obj.n
  },
}
