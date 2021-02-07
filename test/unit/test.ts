import {expect} from "chai"
import Balamb, {BalambError, SeedDef, SeededGarden} from "../../src"
import "mocha"
import {CreateAString} from "../fixtures/simple-app/seeds"

describe("Successful result", () => {
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

describe("IDs", () => {
  it("should not accept duplicate IDs", () => {
    const regResult = Balamb.register([
      CreateAString,
      CreateAString,
    ]) as BalambError

    expect(regResult).to.be.instanceOf(BalambError)
    expect(regResult.code).to.equal("NON_UNIQUE_IDS")
  })
})

describe("Planting seeds", () => {
  it("should plant a seed", async () => {
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

  it("should plant a dependency first", async () => {
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

  it("should detect circular dependencies", async () => {
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

// TODO: test multiple, independent DAGs
// TODO: test concurrency
