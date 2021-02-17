/* eslint-disable no-console */
import Balamb, {BalambError} from "../../../src"
import {CreateAnObjFromString, CreateAString, MultipleDeps} from "./seeds"

async function testApp() {
  const results = Balamb.run([
    CreateAString,
    CreateAnObjFromString,
    MultipleDeps,
  ])

  if (results instanceof BalambError) {
    throw new Error("oh no")
  }

  console.log(results)
}

testApp().catch((e) => {
  console.error(e)
})
