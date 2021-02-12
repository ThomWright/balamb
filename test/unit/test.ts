import {expect} from "chai"
import "mocha"
import {nextTick} from "process"
import Balamb, {BalambError, SeedDef, SeededGarden} from "../../src"
import {CreateAString} from "../fixtures/simple-app/seeds"

describe("A successful result", () => {
  it("should return the number of seeds available", async () => {
    const seeds = Balamb.register([CreateAString]) as SeededGarden

    const result = await seeds.run()

    expect(result.available, "available").to.equal(1)
  })

  it("should return the number of seeds run", async () => {
    const seeds = Balamb.register([CreateAString]) as SeededGarden

    const result = await seeds.run()

    expect(result.planted, "planted").to.equal(1)
  })
})

describe("Duplicate IDs", () => {
  it("should be detected and result in an error", () => {
    const regResult = Balamb.register([
      CreateAString,
      CreateAString,
    ]) as BalambError

    expect(regResult).to.be.instanceOf(BalambError)
    expect(regResult.code).to.equal("NON_UNIQUE_IDS")
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

    const seeds = Balamb.register([A, B]) as SeededGarden

    await seeds.run()

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

    const seeds = Balamb.register([A, B, C]) as SeededGarden

    await seeds.run()

    expect(result).to.eql("abc")
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

      const regResult = Balamb.register([A, B]) as BalambError

      expect(regResult).to.be.instanceOf(BalambError)
      expect(regResult.code).to.equal("CIRCULAR_DEPENDENCY")
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
    const seeds = Balamb.register([SetPlantToTrue]) as SeededGarden

    await seeds.run()

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

      const seeds = Balamb.register([A, B, C]) as SeededGarden

      await seeds.run()

      expect(
        plantOrder.indexOf("a"),
        "a should happen before b",
      ).to.be.lessThan(plantOrder.indexOf("b"))

      expect(plantOrder.indexOf("c")).to.be.greaterThan(-1)
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

      const seeds = Balamb.register([A, B]) as SeededGarden

      await seeds.run()
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

      const seeds = Balamb.register(seedDefs) as SeededGarden

      await seeds.run({concurrency: 1})

      expect(events).to.have.length(seedDefs.length * 2)

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

      const seeds = Balamb.register(seedDefs) as SeededGarden

      await seeds.run({concurrency: 2})

      expect(events).to.have.length(seedDefs.length * 2)

      checkConcurrency(events, {maxConcurrency: 2})
    })
  })
})

function checkConcurrency(
  events: Array<string>,
  {maxConcurrency}: {maxConcurrency: number},
) {
  const numUnclosed = events.reduce((totalUnclosed, parens) => {
    expect(parens).to.be.oneOf(["(", ")"])
    if (parens === "(") {
      totalUnclosed++
    } else if (parens === ")") {
      totalUnclosed--
    }
    expect(totalUnclosed).to.be.at.most(maxConcurrency)
    return totalUnclosed
  }, 0)

  expect(numUnclosed).to.equal(0)
}

// TODO: test failures
