type Seed<R, D extends AllSeedIds> = (i: Results<D>) => R
type SeedDef<R, D extends AllSeedIds> = Readonly<{
  dependsOn?: ReadonlyArray<D>
  plant: Seed<R, D>
}>

const a: SeedDef<string, never> = {
  plant: () => "thing",
}

const bDeps = ["id1"] as const
const b: SeedDef<number, typeof bDeps[number]> = {
  dependsOn: bDeps,
  plant: ({id1}) => id1.length,
}

const ALL_SEEDS = {
  id1: a,
  id2: b,
}

type AllSeeds = typeof ALL_SEEDS
type AllSeedIds = keyof AllSeeds

type Results<Deps extends AllSeedIds> = {
  [K in Deps]: ReturnType<AllSeeds[K]["plant"]>
}
