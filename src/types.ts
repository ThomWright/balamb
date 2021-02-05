import {ReadonlyDeep} from "type-fest"

export type SeedDef<Result, Dependencies> = Readonly<{
  id: string
  description: string
  tags?: ReadonlyArray<string>
  idempotent?: boolean

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dependsOn?: Dependencies extends Record<string, any>
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {[Id in keyof Dependencies]: SeedDef<Dependencies[Id], any>}
    : never

  plant: SeedRunner<Result, Dependencies>
}>

export type SeedRunner<Result, Dependencies> = (
  i: ReadonlyDeep<Dependencies>,
) => Promise<Result>
