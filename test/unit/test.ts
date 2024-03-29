import {expect} from "chai"
import "mocha"
import {nextTick} from "process"
import Balamb, {
  BalambError,
  CircularDependency,
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

describe("Empty", () => {
  it("should succeed", async () => {
    const result = (await Balamb.run([])) as BalambResult

    expect(result.results, "results").to.eql({})
  })
})

describe("Duplicates", () => {
  context("duplicate IDs on different seeds", () => {
    it("should be detected and result in an error", async () => {
      const result = (await Balamb.run([
        CreateAString,
        {
          ...CreateAString,
          id: CreateAString.id,
        },
      ])) as BalambError

      expect(result).to.be.instanceOf(BalambError)
      expect(result.info.errorCode).to.equal("NON_UNIQUE_IDS")
      const info = result.info as NonUniqueIds
      expect(info.duplicates).to.eql([CreateAString.id])
    })
  })

  context("duplicate seeds (same reference)", () => {
    it("should be accepted and de-duplicated", async () => {
      const result = (await Balamb.run([
        CreateAString,
        CreateAString,
      ])) as BalambResult

      expect(result.results, "results").to.eql({[CreateAString.id]: "a string"})
    })
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

    type AResult = {
      a: string
    }
    const A: SeedDef<AResult, void> = {
      id: "a",
      description: "a",

      plant: async () => ({
        a: "a",
      }),
    }
    const B: SeedDef<
      {
        b: string
      },
      {resultOfA: AResult}
    > = {
      id: "b",
      description: "b",
      dependsOn: {resultOfA: A},

      plant: async ({resultOfA: a}) => ({b: a.a + "b"}),
    }
    const C: SeedDef<void, {resultOfB: {b: string}}> = {
      id: "c",
      description: "c",
      dependsOn: {resultOfB: B},

      plant: async ({resultOfB: b}) => {
        result = b.b + "c"
      },
    }

    await Balamb.run([A, B, C])

    expect(result, "running order").to.eql("abc")
  })

  context("Circular dependencies", () => {
    it("should be detected and result in an error", async () => {
      const A = {
        id: "a",
        description: "a",

        plant: async () => {
          //
        },
      }
      const B: SeedDef<void, {a: void}> = {
        id: "b",
        description: "b",

        dependsOn: {a: A},

        plant: async () => {
          //
        },
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
      ;(A as any).dependsOn = {
        b: B,
      }

      const result = (await Balamb.run([A, B])) as BalambError

      expect(result).to.be.instanceOf(BalambError)
      expect(result.info.errorCode).to.equal("CIRCULAR_DEPENDENCY")
      const info = result.info as CircularDependency
      expect(info.cycle).to.eql(["a", "b", "a"])
    })
  })

  context("Missing dependencies", () => {
    it("should be accepted and run", async () => {
      const result = (await Balamb.run([CreateAnObjFromString])) as BalambResult

      expect(result.results, "results").to.eql({
        [CreateAString.id]: "a string",
        [CreateAnObjFromString.id]: {s: "a string"},
      })
    })
  })

  context("Deep nesting", () => {
    it("should work", async () => {
      const A: SeedDef<string, void> = {
        id: "A",
        description: "A",

        plant: async () => {
          return "A"
        },
      }
      const B: SeedDef<string, {a: string}> = {
        id: "B",
        description: "B",
        dependsOn: {a: A},

        plant: async () => {
          return "B"
        },
      }
      const C: SeedDef<string, {b: string}> = {
        id: "C",
        description: "C",
        dependsOn: {b: B},

        plant: async () => {
          return "C"
        },
      }

      const result = (await Balamb.run([C])) as BalambResult

      expect(result, "result").to.eql({
        results: {
          A: "A",
          B: "B",
          C: "C",
        },
      })
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

  context("3 independent A->B graphs", () => {
    it("should run at a concurrency of 3", async () => {
      const events: Array<string> = []

      const seedDefs = ["a", "b", "c"].map(
        (id): SeedDef<void, void> => {
          const dep = {
            id: id + "2",
            description: id + "2",

            plant: async () => {
              events.push("(")
              await new Promise<void>((resolve) => {
                nextTick(resolve)
              })
              events.push(")")
            },
          }
          return {
            id: id + "1",
            description: id + "1",
            dependsOn: {d: dep},

            plant: async () => {
              events.push("(")
              await new Promise<void>((resolve) => {
                nextTick(resolve)
              })
              events.push(")")
            },
          }
        },
      )

      await Balamb.run(seedDefs, {concurrency: 5})

      expect(events, "events").to.have.length(seedDefs.length * 2 * 2)

      const max = checkConcurrency(events, {maxConcurrency: 3})

      // Our concurrency is bounded by the shape of the DAGs here
      expect(max, "maximum witnessed concurrency").to.equal(3)
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

    it("should stop dependent seeds running", async () => {
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

      const NotFail1 = {
        id: "not-fai1",
        description: "Should finish",

        plant: async () => {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 10)
          })
          return 1
        },
      }

      const NotFail2 = {
        id: "not-fail2",
        description: "Should finish too",
        dependsOn: {x: NotFail1},

        plant: async () => {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 10)
          })
          didFinish = true
          return 2
        },
      }

      const result = (await Balamb.run([Fail, NotFail2])) as BalambError

      expect(result, "result").to.be.instanceOf(BalambError)
      expect(didFinish, "other seeds did finish").to.be.true
    })
  })
})

describe("Pre-seeding: re-running with previous results", () => {
  it("should use pre-seed results and not run seeds which have been pre-seeded", async () => {
    let aRun = false
    let bRun = false
    const A: SeedDef<string, void> = {
      id: "a",
      description: "a",

      plant: async () => {
        aRun = true
        return "a"
      },
    }
    const B: SeedDef<string, {a: string}> = {
      id: "b",
      description: "b",
      dependsOn: {a: A},

      plant: async ({a}) => {
        bRun = true
        return a + "b"
      },
    }

    const result = await Balamb.run([A, B], {
      preSeed: {
        a: "nota",
      },
    })

    expect(aRun, "A run").to.be.false
    expect(bRun, "B run").to.be.true
    expect(result, "result").to.eql({
      results: {
        a: "nota",
        b: "notab",
      },
    })
  })

  it("should accept previous values for unknown seed IDs", async () => {
    const A: SeedDef<string, void> = {
      id: "a",
      description: "a",

      plant: async () => {
        return "a"
      },
    }

    const result = await Balamb.run([A], {
      preSeed: {
        c: "c",
      },
    })

    expect(result, "result").to.not.be.instanceOf(BalambError)
    expect(result, "result").to.eql({
      results: {
        a: "a",
        c: "c",
      },
    })
  })

  context("Using tags to run a subset", () => {
    context("Running zero seeds", () => {
      it("should return the pre-seeded results", async () => {
        const A: SeedDef<string, void> = {
          id: "a",
          description: "a",

          plant: async () => {
            return "current"
          },
        }

        const result = await Balamb.run([A], {
          preSeed: {
            a: "previous",
          },
          tags: ["no-match"],
        })

        expect(result, "result").to.not.be.instanceOf(BalambError)
        expect(result, "result").to.eql({
          results: {
            a: "previous",
          },
        })
      })
    })

    context("Running some seeds", () => {
      it("should return the pre-seeded results", async () => {
        const A: SeedDef<string, void> = {
          id: "A",
          description: "A",

          plant: async () => {
            return "current"
          },
        }

        const B: SeedDef<string, void> = {
          id: "B",
          description: "B",
          tags: ["match"],

          plant: async () => {
            return "B"
          },
        }

        const result = await Balamb.run([A, B], {
          preSeed: {
            A: "previous",
          },
          tags: ["match"],
        })

        expect(result, "result").to.not.be.instanceOf(BalambError)
        expect(result, "result").to.eql({
          results: {
            A: "previous",
            B: "B",
          },
        })
      })
    })
  })
})

describe("Tags", () => {
  it("should only run matching tags", async () => {
    const Matching: SeedDef<boolean, void> = {
      id: "matching",
      description: "Matches tag",

      tags: ["tag"],

      plant: async () => {
        return true
      },
    }

    const NotMatching: SeedDef<boolean, void> = {
      id: "not-matching",
      description: "Does not match tag",

      tags: ["not-tag"],

      plant: async () => {
        return true
      },
    }

    const NoTags: SeedDef<boolean, void> = {
      id: "no-tags",
      description: "No tags",

      plant: async () => {
        return true
      },
    }

    const DependedOnByTag: SeedDef<boolean, void> = {
      id: "depended-on-by-tag",
      description: "",

      plant: async () => {
        return true
      },
    }

    const DependencyWithTag: SeedDef<boolean, {D: boolean}> = {
      id: "dep-with-tag",
      description: "",

      dependsOn: {
        D: DependedOnByTag,
      },

      tags: ["tag"],

      plant: async () => {
        return true
      },
    }

    const DependsOnTag: SeedDef<boolean, {D: boolean}> = {
      id: "deps-on-tag",
      description: "",

      dependsOn: {D: DependencyWithTag},

      plant: async () => {
        return true
      },
    }

    const EmptyTags: SeedDef<boolean, void> = {
      id: "empty-tags",
      description: "Empty tags",

      tags: [],

      plant: async () => {
        return true
      },
    }

    const result = await Balamb.run(
      [Matching, NotMatching, NoTags, EmptyTags, DependsOnTag],
      {
        tags: ["tag"],
      },
    )

    expect(result, "result").to.eql({
      results: {
        matching: true,
        "dep-with-tag": true,
        "depended-on-by-tag": true,
      },
    })
  })

  context("empty tags list", () => {
    // Not sure about this...
    it("should run no tags", async () => {
      const Tagged: SeedDef<boolean, void> = {
        id: "tag",
        description: "Tag",

        tags: ["tag"],

        plant: async () => {
          return true
        },
      }

      const result = await Balamb.run([Tagged], {
        tags: [],
      })

      expect(result, "result").to.eql({
        results: {},
      })
    })
  })
})
