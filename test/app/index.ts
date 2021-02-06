import Balamb, {BalambError} from "../../src"
import {CreateAnObj, CreateAString, MultipleDeps} from "./seeds"

async function testApp() {
  const seeds = Balamb.register([CreateAString, CreateAnObj, MultipleDeps])

  if (seeds instanceof BalambError) {
    throw new Error("oh no")
  }

  const result = await seeds.run()

  console.log(result)
}

testApp().catch((e) => {
  console.error(e)
})
