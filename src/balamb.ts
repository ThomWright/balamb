import {
  BalambError,
  BalambType,
  RunResult,
  SeedDef,
  SeededGarden,
} from "./types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySeedDef = SeedDef<unknown, any>

export const Balamb: BalambType = {
  register(seeds: Array<AnySeedDef>): SeededGarden | BalambError {
    if (containsDuplicates(seeds.map((seed) => seed.id))) {
      return new BalambError("NON_UNIQUE_IDS")
    }

    /*
     * Kahn's algorithm for topological sort
     */

    // Working area for nodes which have all dependencies already in queue
    // Initialise with nodes with no dependencies
    const temp: Array<string> = []

    // If we have any edges left over then we have a circular dependency
    let numEdges = 0

    // We will plant seeds in this order
    const queue: Array<string> = []

    /*
     * Initialise
     */

    // Map of node ID to the nodes which depend on it
    // E.g. {"A": ["B", "C"]} - B and C depend on A
    const incomingEdges = new Map<string, Set<string>>()

    const indexedSeeds = new Map<string, AnySeedDef>()

    seeds.forEach((seed) => {
      indexedSeeds.set(seed.id, seed)

      if (
        "dependsOn" in seed &&
        typeof seed.dependsOn === "object" &&
        seed.dependsOn != null
      ) {
        const depDefs = Object.values(seed.dependsOn) as Array<
          SeedDef<unknown, unknown>
        >

        depDefs.forEach((d) => {
          const edgeSet = incomingEdges.get(d.id)
          if (edgeSet != null) {
            edgeSet.add(seed.id)
          } else {
            incomingEdges.set(d.id, new Set([seed.id]))
          }
          numEdges++
        })

        // Node has no dependencies, add to temp queue
        if (depDefs.length === 0) {
          temp.push(seed.id)
        }
      } else {
        temp.push(seed.id)
      }
    })

    /*
     * Do topological sort
     */

    // while temp is not empty do
    // remove a node n from temp
    // add n to queue
    // for each node m with an edge e from n to m do
    //     remove edge e from the graph
    //     if m has no other incoming edges then
    //         insert m into temp
    while (temp.length > 0) {
      const nId = temp.pop() as string
      queue.push(nId)
      const depSet = incomingEdges.get(nId)
      if (depSet) {
        // Apparently it is safe to remove elements from a Set while iterating
        depSet.forEach((mId) => {
          depSet.delete(mId)
          numEdges--
          const mIncEdges = incomingEdges.get(mId)
          if (mIncEdges == null || mIncEdges.size === 0) {
            queue.push(mId)
          }
        })
      }
    }

    if (numEdges !== 0) {
      return new BalambError("CIRCULAR_DEPENDENCY")
    }

    return {
      run: async (): Promise<RunResult> => {
        const resultsCache: Record<string, unknown> = {}

        let planted = 0

        for (const id of queue) {
          const seed = indexedSeeds.get(id) as AnySeedDef
          resultsCache[seed.id] = await seed.plant(resultsCache)
          planted++
        }

        return {
          available: seeds.length,
          planted,
        }
      },
    }
  },
}

function containsDuplicates<T>(array: Array<T>): boolean {
  return new Set(array).size !== array.length
}
