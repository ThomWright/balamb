/* eslint-disable no-console */
import Balamb, {BalambError} from "../../../src"
import {CreateAnObjFromString, CreateAString, MultipleDeps} from "./seeds"

async function testApp() {
  const seeds = Balamb.register([
    CreateAString,
    CreateAnObjFromString,
    MultipleDeps,
  ])

  if (seeds instanceof BalambError) {
    throw new Error("oh no")
  }

  const result = await seeds.run()

  console.log(result)
}

testApp().catch((e) => {
  console.error(e)
})
