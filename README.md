# Balamb 🌱

Run a set of dependent, async tasks with type-safe dependencies.

Initially intended for data seeding, hence the name.

## Example

```typescript
import Balamb, {BalambError, SeedDef} from "balamb"

const CreateAString: SeedDef<string, void> = {
  id: "a_string",
  description: "Just returns a string",

  plant: async () => "thing",
}

const CreateAnObj: SeedDef<{n: number}, {s: string}> = {
  id: "an_object",
  description: "Just returns an object, based on its dependency",

  dependsOn: {s: CreateAString},

  plant: async ({s}) => ({
    n: s.length,
  }),
}

const seeds = Balamb.register([CreateAString, CreateAnObj])

if (seeds instanceof BalambError) {
  throw new Error("oh no")
}

await seeds.run()
```

## Similar libraries

- [promise-dag](https://github.com/vvvvalvalval/promise-dag)
- [dagmise](https://github.com/SidBala/dagmise)
- [Viae.ts](https://github.com/alephnan/viae.ts)
