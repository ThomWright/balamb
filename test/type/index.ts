import {expectType, TypeEqual, TypeOf} from "ts-expect"
import {PromiseValue, ReadonlyDeep} from "type-fest"
import {SeedDef, SeedRunner} from "../../src"
import {
  CreateAnObjFromString,
  CreateAString,
} from "../fixtures/simple-app/seeds"

/*
 * General
 */

// dependsOn
expectType<TypeEqual<unknown, SeedDef<unknown, void>["dependsOn"]>>(true)
expectType<
  TypeOf<SeedDef<unknown, {x: string}>["dependsOn"], {x: SeedDef<string, void>}>
>(true)
expectType<
  TypeOf<SeedDef<unknown, {x: string}>["dependsOn"], {x: SeedDef<number, void>}>
>(false)

expectType<TypeEqual<unknown, SeedDef<unknown, void>["dependsOn"]>>(true)

expectType<TypeEqual<unknown, SeedDef<unknown, void>["dependsOn"]>>(true)
expectType<
  TypeOf<
    SeedDef<unknown, {x: string}>["dependsOn"],
    {x: SeedDef<string, {y: string}>}
  >
>(true)

// plant
expectType<
  TypeEqual<
    Parameters<SeedDef<unknown, {x: string}>["plant"]>,
    [ReadonlyDeep<{x: string}>]
  >
>(true)
expectType<
  TypeEqual<ReturnType<SeedDef<string, {x: string}>["plant"]>, Promise<string>>
>(true)

/*
 * Examples
 */
expectType<TypeEqual<unknown, typeof CreateAString.id>>(false)
expectType<TypeEqual<unknown, typeof CreateAString.dependsOn>>(true)
expectType<SeedRunner<string, void>>(CreateAString.plant)
expectType<TypeEqual<[unknown], Parameters<typeof CreateAString.plant>>>(true)

expectType<{s: typeof CreateAString}>(CreateAnObjFromString.dependsOn)
expectType<
  TypeOf<
    Parameters<typeof CreateAnObjFromString.plant>,
    [{s: PromiseValue<ReturnType<typeof CreateAString.plant>>}]
  >
>(true)
