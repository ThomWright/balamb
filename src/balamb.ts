import {
  BalambError,
  CircularDependency,
  DanglingDependency,
  SeedFailure,
} from "./errors"
import {BalambType, Id, BalambResult, SeedDef} from "./types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySeedDef = SeedDef<unknown, any>

export const Balamb: BalambType = {
  async run(seeds, opts) {
    const planter = prepare(seeds)

    if (planter instanceof BalambError) {
      return planter
    }

    return planter.run(opts)
  },
}

/**
 * Seeds ready for planting.
 */
interface SeedPlanter {
  run(opts?: {concurrency: number}): Promise<BalambResult | BalambError>
}
function prepare(seeds: Array<AnySeedDef>): SeedPlanter | BalambError {
  const duplicates = findDuplicates(seeds.map((seed) => seed.id))
  if (duplicates.length > 0) {
    return new BalambError({
      errorCode: "NON_UNIQUE_IDS",
      duplicates,
    })
  }

  const graph = createDAG(seeds)
  if ("errorCode" in graph) {
    return new BalambError(graph)
  }

  const result = sort(seeds, graph)

  if ("errorCode" in result) {
    return new BalambError(result)
  }

  const queue = result

  const {outgoingEdges} = graph

  return {
    run: async (opts?: {
      concurrency: number
    }): Promise<BalambResult | BalambError> => {
      const {concurrency = 10} = opts ?? {}
      const concurrencyLimit =
        isFinite(concurrency) && concurrency >= 1
          ? Math.min(concurrency, queue.length)
          : queue.length

      const failures: Array<SeedFailure> = []

      const results = await processQueue(
        queue,
        outgoingEdges,
        {concurrencyLimit},
        (failure) => failures.push(failure),
      )

      if (failures.length > 0) {
        return new BalambError({
          errorCode: "SEED_FAILURES",
          failures,
          partialResults: results,
        })
      }

      return {
        results,
      }
    },
  }
}

async function processQueue(
  queue: Array<AnySeedDef>,
  outgoingEdges: Map<Id, Set<Id>>,
  {concurrencyLimit}: {concurrencyLimit: number},
  onError: (error: SeedFailure) => void,
): Promise<Record<Id, unknown>> {
  const resultsCache: Record<Id, unknown> = {}

  await new Promise<void>((finishedProcessing) => {
    // Kinda superfluous, but nicer to use
    const resolved = new Set<Id>()

    let nextItemIndex = 0
    let inFlight = 0
    let errored = false

    /**
     * Try processing the next item in the queue
     * @returns Whether the next item began processing
     */
    function tryProcessingNextItem(): boolean {
      // Pick next seed off the queue
      const seed = queue[nextItemIndex]

      // Determine if we can process it yet
      const depIds = outgoingEdges.get(seed.id)
      if (
        depIds != null &&
        ![...depIds].every((depId) => resolved.has(depId))
      ) {
        // This seed's dependencies aren't ready yet
        return false
      }

      // Yep, we're gonna process it
      nextItemIndex++
      inFlight++

      // Map named dependency declarations to the results of those dependencies
      const dependencies =
        "dependsOn" in seed &&
        typeof seed.dependsOn === "object" &&
        seed.dependsOn != null
          ? mapObjIndexed(
              (depSeed) => resultsCache[(depSeed as AnySeedDef).id],
              seed.dependsOn,
            )
          : undefined

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      seed
        .plant(dependencies)
        .then((result) => {
          inFlight--

          resultsCache[seed.id] = result
          resolved.add(seed.id)

          if (errored && inFlight === 0) {
            finishedProcessing()
          } else {
            if (inFlight < concurrencyLimit && nextItemIndex < queue.length) {
              tryProcessingNextItem()
            } else if (resolved.size === queue.length) {
              finishedProcessing()
            }
          }
        })
        .catch((error: unknown) => {
          inFlight--
          errored = true
          onError({id: seed.id, error})
          if (inFlight === 0) {
            finishedProcessing()
          }
        })

      return true
    }

    while (nextItemIndex < concurrencyLimit) {
      const canContinue = tryProcessingNextItem()
      if (!canContinue) {
        break
      }
    }
  })
  return resultsCache
}

/**
 * Kahn's algorithm for topological sort
 */
function sort(
  seeds: Array<AnySeedDef>,
  {incomingEdges, outgoingEdges, indexedSeeds, numEdges}: DAG,
): Array<AnySeedDef> | CircularDependency {
  /*
   * Initialise
   */
  /** Working area for nodes which have no unprocessed dependencies */
  const processingQueue: Array<AnySeedDef> = []

  /** If we end up with any edges left over then we have a circular dependency */
  let unprocessedEdges = numEdges

  /** Sorted queue - we will plant seeds in this order */
  const queue: Array<AnySeedDef> = []

  // Add seeds with no dependencies to processing queue
  seeds.forEach((seed) => {
    const es = outgoingEdges.get(seed.id)
    if (es == null || es.size === 0) {
      processingQueue.push(seed)
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

  const remainingOutgoingEdges = new Map<Id, Set<Id>>()
  outgoingEdges.forEach((v, k) => {
    remainingOutgoingEdges.set(k, new Set(v))
  })
  while (processingQueue.length > 0) {
    const n = processingQueue.pop() as AnySeedDef
    queue.push(n)
    const nIncoming = incomingEdges.get(n.id)
    if (nIncoming) {
      nIncoming.forEach((mId) => {
        const mOutgoing = remainingOutgoingEdges.get(mId)
        if (mOutgoing != null) {
          mOutgoing.delete(n.id)
          if (mOutgoing.size === 0) {
            // Clear up empty sets to make debugging easier
            remainingOutgoingEdges.delete(mId)
          }
          unprocessedEdges--
        }
        if (mOutgoing == null || mOutgoing.size === 0) {
          processingQueue.push(indexedSeeds.get(mId) as AnySeedDef)
        }
      })
    }
  }

  // Check for circular dependencies
  if (unprocessedEdges !== 0) {
    // Only report a single cycle for now
    const cycle: Array<Id> = []

    const seen: Set<Id> = new Set()
    let id = remainingOutgoingEdges.keys().next().value as Id
    while (!seen.has(id)) {
      cycle.push(id)
      seen.add(id)
      const edges = remainingOutgoingEdges.get(id) as Set<Id>
      id = edges.keys().next().value as Id
    }
    cycle.push(id)

    return {errorCode: "CIRCULAR_DEPENDENCY", cycle}
  }

  return queue
}

interface DAG {
  readonly incomingEdges: Map<Id, Set<Id>>
  readonly outgoingEdges: Map<Id, Set<Id>>
  readonly numEdges: number

  readonly indexedSeeds: Map<Id, AnySeedDef>
}

/**
 * @returns A Directed Acyclic Graph of seeds
 */
function createDAG(seeds: Array<AnySeedDef>): DAG | DanglingDependency {
  const incomingEdges = new Map<Id, Set<Id>>()
  const outgoingEdges = new Map<Id, Set<Id>>()

  const indexedSeeds = new Map<Id, AnySeedDef>()

  let numEdges = 0

  const danglingDependencies: Array<[Id, Id]> = []

  seeds.forEach((seed) => {
    indexedSeeds.set(seed.id, seed)
  })

  seeds.forEach((seed) => {
    if (
      "dependsOn" in seed &&
      typeof seed.dependsOn === "object" &&
      seed.dependsOn != null
    ) {
      const depDefs = Object.values(seed.dependsOn) as Array<
        SeedDef<unknown, unknown>
      >

      depDefs.forEach((d) => {
        if (!indexedSeeds.has(d.id)) {
          danglingDependencies.push([seed.id, d.id])
          return
        }
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
    }
  })

  if (danglingDependencies.length > 0) {
    return {errorCode: "DANGLING_DEPENDENCY", danglingDependencies}
  }

  return {
    incomingEdges,
    outgoingEdges,
    numEdges,

    indexedSeeds,
  }
}

function findDuplicates(array: Array<Id>): Array<Id> {
  const sorted = array.slice().sort()
  const results = []
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1] === sorted[i]) {
      results.push(sorted[i])
    }
  }
  return results
}

function mapObjIndexed<T, TResult, TKey extends string>(
  fn: (value: T, key: TKey, obj?: Record<TKey, T>) => TResult,
  obj: Record<TKey, T>,
): Record<TKey, TResult> {
  return Object.keys(obj).reduce<Record<TKey, TResult>>(function (acc, key) {
    acc[key as TKey] = fn(obj[key as TKey], key as TKey, obj)
    return acc
  }, {} as Record<TKey, TResult>)
}
