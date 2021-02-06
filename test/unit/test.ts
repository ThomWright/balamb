import {expect} from "chai"
import Balamb, {BalambError, SeedDef, SeededGarden} from "../../src"
import "mocha"

export const CreateAString: SeedDef<string, void> = {
  id: "a_string",
  description: "Just returns a string",

  plant: async () => "thing",
}

describe("Basics", () => {
  it("should return the number of seeds available", async () => {
    const seeds = Balamb.register([CreateAString]) as SeededGarden

    const result = await seeds.run()

    expect(result.available, "available").to.equal(1)
  })

  it("should return the number of seeds run", async () => {
    const seeds = Balamb.register([CreateAString]) as SeededGarden

    const result = await seeds.run()

    expect(result.run, "run").to.equal(1)
  })

  context("Unique IDs", () => {
    it("should not accept duplicate IDs", () => {
      const regResult = Balamb.register([CreateAString, CreateAString])

      expect(regResult).to.be.instanceOf(BalambError)
    })
  })
})
