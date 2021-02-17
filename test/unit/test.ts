import {expect} from "chai"
import "mocha"
import {nextTick} from "process"
import Balamb, {
  BalambError,
  CircularDependency,
  DanglingDependency,
  NonUniqueIds,
  BalambResult,
  SeedDef,
  SeedFailures,
} from "../../src"
import {
  CreateAnObjFromString,
  CreateAString,
  createBlank,
  Fail,
} from "../fixtures/simple-app/seeds"

describe("A successful result", () => {
  it("should return the results of the seeds which were run", async () => {
    const result = (await Balamb.run([CreateAString])) as BalambResult

    expect(result.results, "results").to.eql({[CreateAString.id]: "a string"})
  })
})

describe("Duplicate IDs", () => {
  it("should be detected and result in an error", async () => {
    const result = (await Balamb.run([
      CreateAString,
      CreateAString,
    ])) as BalambError

    expect(result).to.be.instanceOf(BalambError)
    expect(result.info.errorCode).to.equal("NON_UNIQUE_IDS")
    const info = result.info as NonUniqueIds
    expect(info.duplicates).to.eql([CreateAString.id])
  })
})

describe("Dependencies", () => {
  it("should be planted first", async () => {
    const plantOrder: Array<string> = []

    const A: SeedDef<void, void> = {
      id: "a",
      description: "a",

      plant: async () => {
        plantOrder.push("a")
      },
    }
    const B: SeedDef<void, {a: void}> = {
      id: "b",
      description: "b",
      dependsOn: {a: A},

      plant: async () => {
        plantOrder.push("b")
      },
    }

    await Balamb.run([A, B])

    expect(plantOrder, "Order of planting").to.eql(["a", "b"])
  })

  it("should be available as arguments", async () => {
    let result: string | undefined

    const A: SeedDef<string, void> = {
      id: "a",
      description: "a",

      plant: async () => "a",
    }
    const B: SeedDef<string, {a: string}> = {
      id: "b",
      description: "b",
      dependsOn: {a: A},

      plant: async ({a}) => a + "b",
    }
    const C: SeedDef<void, {b: string}> = {
      id: "c",
      description: "c",
      dependsOn: {b: B},

      plant: async ({b}) => {
        result = b + "c"
      },
    }

    await Balamb.run([A, B, C])

    expect(result, "running order").to.eql("abc")
  })

  context("Circular dependencies", () => {
    it("should be detected and result in an error", async () => {
      const Btemp: SeedDef<void, void> = {
        id: "b",
        description: "b",

        plant: async () => {
          //
        },
      }
      const A: SeedDef<void, {b: void}> = {
        id: "a",
        description: "a",
        dependsOn: {b: Btemp},

        plant: async () => {
          //
        },
      }
      const B: SeedDef<void, {a: void}> = {
        ...Btemp,
        dependsOn: {a: A},
      }

      const result = (await Balamb.run([A, B])) as BalambError

      expect(result).to.be.instanceOf(BalambError)
      expect(result.info.errorCode).to.equal("CIRCULAR_DEPENDENCY")
      const info = result.info as CircularDependency
      expect(info.cycle).to.eql(["a", "b", "a"])
    })
  })

  context("Missing dependencies", () => {
    it("should be rejected", async () => {
      const result = (await Balamb.run([CreateAnObjFromString])) as BalambError

      expect(result).to.be.instanceOf(BalambError)
      expect(result.info.errorCode).to.equal("DANGLING_DEPENDENCY")
      const info = result.info as DanglingDependency
      expect(info.danglingDependencies).to.eql([
        [CreateAnObjFromString.id, CreateAString.id],
      ])
    })
  })
})

describe("Seeds", () => {
  it("should get planted", async () => {
    let plant = false
    const SetPlantToTrue: SeedDef<void, void> = {
      id: "set_plant_true",
      description: "Just sets plant to true",

      plant: async () => {
        plant = true
      },
    }

    await Balamb.run([SetPlantToTrue])

    expect(plant, "Seed was planted").to.be.true
  })

  context("Multiple, independent DAGs", () => {
    it("should work fine", async () => {
      const plantOrder: Array<string> = []

      const A: SeedDef<void, void> = {
        id: "a",
        description: "a",

        plant: async () => {
          plantOrder.push("a")
        },
      }
      const B: SeedDef<void, {a: void}> = {
        id: "b",
        description: "b",
        dependsOn: {a: A},

        plant: async () => {
          plantOrder.push("b")
        },
      }

      const C: SeedDef<void, void> = {
        id: "c",
        description: "c",

        plant: async () => {
          plantOrder.push("c")
        },
      }

      await Balamb.run([A, B, C])

      expect(
        plantOrder.indexOf("a"),
        "a should happen before b",
      ).to.be.lessThan(plantOrder.indexOf("b"))

      expect(plantOrder.indexOf("c"), "c should happen").to.be.greaterThan(-1)
    })
  })
})

describe("Concurrency", () => {
  context("default", () => {
    it("should run concurrently", async () => {
      // This will deadlock if run sequentially

      let aStarted: () => void
      const promiseA = new Promise<void>((resolve) => {
        aStarted = resolve
      })

      let bStarted: () => void
      const promiseB = new Promise<void>((resolve) => {
        bStarted = resolve
      })

      const A: SeedDef<void, void> = {
        id: "a",
        description: "a",

        plant: async () => {
          aStarted()
          await promiseB
        },
      }
      const B: SeedDef<void, void> = {
        id: "b",
        description: "b",

        plant: async () => {
          bStarted()
          await promiseA
        },
      }

      await Balamb.run([A, B])
    })
  })

  context("concurrency = 1, 3 seeds", () => {
    it("should run sequentially", async () => {
      const events: Array<string> = []

      const seedDefs = ["a", "b", "c"].map(
        (id): SeedDef<void, void> => {
          return {
            id,
            description: id,

            plant: async () => {
              events.push("(")
              await new Promise<void>((resolve) => {
                nextTick(() => (events.push(")"), resolve()))
              })
            },
          }
        },
      )

      await Balamb.run(seedDefs, {concurrency: 1})

      expect(events, "events").to.have.length(seedDefs.length * 2)

      checkConcurrency(events, {maxConcurrency: 1})
    })
  })

  context("concurrency = 2, 7 seeds", () => {
    it("should not exceed stated limit", async () => {
      const events: Array<string> = []

      const seedDefs = ["a", "b", "c", "d", "e", "f", "g"].map(
        (id): SeedDef<void, void> => {
          return {
            id,
            description: id,

            plant: async () => {
              events.push("(")
              await new Promise<void>((resolve) => {
                nextTick(() => (events.push(")"), resolve()))
              })
            },
          }
        },
      )

      await Balamb.run(seedDefs, {concurrency: 2})

      expect(events, "events").to.have.length(seedDefs.length * 2)

      const max = checkConcurrency(events, {maxConcurrency: 2})

      // We should reach the maximum allowed concurrency
      expect(max, "maximum witnessed concurrency").to.equal(2)
    })
  })
})

/**
 * Check that the maximum concurrency wasn't exceeded.
 *
 * @returns the maximum concurrency seen.
 */
function checkConcurrency(
  events: Array<string>,
  {maxConcurrency}: {maxConcurrency: number},
): number {
  let max = 0
  const numUnclosed = events.reduce((totalUnclosed, parens) => {
    expect(parens).to.be.oneOf(["(", ")"])
    if (parens === "(") {
      totalUnclosed++
    } else if (parens === ")") {
      totalUnclosed--
    }
    max = Math.max(max, totalUnclosed)
    expect(totalUnclosed, "number of concurrently running tasks").to.be.at.most(
      maxConcurrency,
    )
    return totalUnclosed
  }, 0)

  expect(numUnclosed, "number of unfinished tasks").to.equal(0)

  return max
}

describe("Error handling", () => {
  context("Failing seeds", () => {
    it("should be reported", async () => {
      const result = (await Balamb.run([
        createBlank("a"),
        Fail,
        createBlank("b"),
      ])) as BalambError

      expect(result).to.be.instanceOf(BalambError)
      expect(result.info.errorCode).to.equal("SEED_FAILURES")
      const info = result.info as SeedFailures
      expect(info.failures.map((f) => f.id)).to.eql([Fail.id])
    })

    it("should stop subsequent seeds running", async () => {
      let didRun = false

      await Balamb.run([
        Fail,
        {
          id: "depends-on-fail",
          description: "Should never run",

          dependsOn: {
            f: Fail,
          },

          plant: async () => {
            didRun = true
          },
        },
      ])

      expect(didRun, "dependency did run").to.be.false
    })

    it("should let currently running seeds finish", async () => {
      let didFinish = false

      await Balamb.run([
        Fail,
        {
          id: "not-fail",
          description: "Should finish",

          plant: async () => {
            await new Promise<void>((resolve) => {
              setTimeout(() => {
                didFinish = true
                resolve()
              }, 10)
            })
          },
        },
      ])

      expect(didFinish, "other seed did finish").to.be.true
    })
  })
})
