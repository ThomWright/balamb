import {expect} from "chai"
import Balamb, {BalambError, SeededGarden} from "../../src"
import "mocha"
import {CreateAString} from "../fixtures/simple-app/seeds"

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
