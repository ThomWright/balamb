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

    const incomingEdges = new Map<string, Set<string>>()
    const outgoingEdges = new Map<string, Set<string>>()

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
          {
            const edgeSet = incomingEdges.get(d.id)
            if (edgeSet != null) {
              edgeSet.add(seed.id)
            } else {
              incomingEdges.set(d.id, new Set([seed.id]))
            }
          }
          {
            const edgeSet = outgoingEdges.get(seed.id)
            if (edgeSet != null) {
              edgeSet.add(d.id)
            } else {
              outgoingEdges.set(seed.id, new Set([d.id]))
            }
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
    // for each node m with an edge e from m to n do
    //     remove edge e from the graph
    //     if m has no other outgoing edges then
    //         insert m into temp

    const remainingOutgoingEdges = new Map<string, Set<string>>()
    outgoingEdges.forEach((v, k) => {
      remainingOutgoingEdges.set(k, new Set(v))
    })
    while (temp.length > 0) {
      const nId = temp.pop() as string
      queue.push(nId)
      const nIncoming = incomingEdges.get(nId)
      if (nIncoming) {
        nIncoming.forEach((mId) => {
          const mOutgoing = remainingOutgoingEdges.get(mId)
          if (mOutgoing != null) {
            mOutgoing.delete(nId)
            numEdges--
          }
          if (mOutgoing == null || mOutgoing.size === 0) {
            temp.push(mId)
          }
        })
      }
    }

    if (numEdges !== 0) {
      return new BalambError("CIRCULAR_DEPENDENCY")
    }

    return {
      run: async (opts?: {concurrency: number}): Promise<RunResult> => {
        const {concurrency = 10} = opts ?? {}
        const limit =
          isFinite(concurrency) && concurrency >= 1
            ? Math.min(concurrency, queue.length)
            : queue.length

        let planted = 0
        const resolved = new Set<string>()

        await new Promise<void>((resolve) => {
          const resultsCache: Record<string, unknown> = {}

          let index = 0
          let inFlight = 0

          /** Retuns whether progress can be made */
          function drainQueue(): boolean {
            const id = queue[index]
            const seed = indexedSeeds.get(id) as AnySeedDef

            const depIds = outgoingEdges.get(seed.id)
            if (
              depIds != null &&
              ![...depIds].every((depId) => resolved.has(depId))
            ) {
              // This seed's dependencies aren't ready yet
              return false
            }

            index++
            inFlight++

            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            seed.plant(resultsCache).then((result) => {
              resultsCache[seed.id] = result

              planted++
              inFlight--
              resolved.add(seed.id)

              if (inFlight < limit && index < queue.length) {
                drainQueue()
              } else if (planted === queue.length) {
                resolve()
              }
            })
            return true
          }

          while (index < limit) {
            const canContinue = drainQueue()
            if (!canContinue) {
              break
            }
          }
        })

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
