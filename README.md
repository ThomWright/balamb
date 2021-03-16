# Balamb 🌱

Concurrently run a set of dependent, asynchronous tasks with type-safe dependencies.

This library was initially intended for data seeding, hence the name, which comes from Final Fantasy VIII. Balamb Garden is a school where cadets, known as SeeDs, are trained.

## To do list

- [x] Concurrency
- [x] Error handling
- [x] Better error messaging
- [x] CI (GitHub Actions)
- [ ] Tags (run only selected tags)
- [x] Save/load previously run IDs (can configure to only run new seeds)
- [ ] Document pre-seeding
- [ ] Idempotency declaration (can be rerun every time, if configured)
- [ ] More docs explaining these features
- [ ] Maybe a CLI?

## Example

```typescript
import Balamb, {BalambError, SeedDef} from "balamb"

// A `SeedDef` is a definition of a task (or `Seed`) to run.
// The `Seed` returns a `string`.
const CreateAString: SeedDef<string, void> = {
  // It has a unique ID
  id: "a_string",

  // A human-readable description
  description: "Just returns a string",

  // And a function to run. This is the task, or `Seed`. We `plant` the `Seed`.
  plant: async () => "thing",
}

type ObjResult = {n: number}

// In this case, the `Seed` returns `ObjResult`, and the dependencies
// passed to `plant` are: `{s: string}`.
const CreateAnObj: SeedDef<ObjResult, {s: string}> = {
  id: "an_object",
  description: "Just returns an object, based on its dependency",

  // It can also define other tasks as dependencies, which will be run first.
  // It has a single dependency which we've named `s`.
  // The types need to match the generic parameter defined above.
  dependsOn: {s: CreateAString},

  // In this case, we get passed the result of the task we depend on, which we've named `s`.
  plant: async ({s}) => ({
    n: s.length,
  }),
}

// Run the seeds!
const results = await Balamb.run([CreateAString, CreateAnObj])

// Check if it succeeded
if (results instanceof BalambError) {
  throw new Error("oh no")
}
```

## Caveats

### Results need to be JSON-serialisable

Status: _pending_

Results are required to be serialisable. This is so we can store the them, and use them later to re-hydrate a run. This will allow us to re-run a set of Seeds, ignoring old seeds and only run the _new_ seeds.

To this end, all result types must extend `JsonValue | void`. `JsonValue` is defined in [type-fest](https://github.com/sindresorhus/type-fest).

Looking at the previous example:

```ts
interface ObjResult {
  n: number
} // Won't work
interface ObjResult extends JsonValue {
  n: number
} // Works!
type ObjResult = {n: number} // Works!
const CreateAnObj: SeedDef<ObjResult, {s: string}>
```

Here, `ObjResult` is accepted if it is defined as a `type`, or if it extends `JsonValue`.

## Why is this useful?

To be overly concise (and maybe too abstract):

- manually ordering complex workflows efficiently is hard and gets messy
- wiring together dependencies is boring and time-consuming
- the above distracts from the 'business logic' - the tasks themselves

Let's look at some examples.

```typescript
// Running two tasks sequentially:
const result1 = await task1()
await task2(result1)

// Running two tasks concurrently:
await Promise.all([task1, task2])
```

Those were pretty simple. Now let's think about an example of seeding some data for a social network.

- Steve makes a post
- Alan comments on Steve's post
- Steve replies to Alan's comment

The dependencies look like this:

![Social data seeding example](./docs/social-data-seeding-example.png)

We might write that like so:

```typescript
const steve = await createSteve()
const stevesPost = await createPostBy(steve)

const alan = await createAlan()
const alansComment = await createComment(alan, stevesPost)

const reply = await createReply(steve, alansComment)
```

That works, but it's not efficient: it runs everything sequentially.

Instead, we might write this:

```typescript
const [{steve, stevesPost}, alan] = await Promise.all([
  createSteve().then((steve) => ({
    steve,
    stevesPost: await createPostBy(steve),
  })),
  createAlan(),
])

const alansComment = await createComment(alan, stevesPost)

const reply = await createReply(steve, alansComment)
```

I had to spend some time thinking about that! I'm not particularly happy with it either.

Hopefully this illustrates the beginnings of what this might end up looking like with even bigger examples, and what this library aims to help avoid.

Instead, we can write it like this, assuming the task definitions (seeds) and their dependencies have been written elsewhere:

```typescript
await Balamb.run([
  Steve,
  StevesPost,
  Alan,
  AlansCommentToSteve,
  StevesReplyToAlan,
])
```

Done! This will run in a generally efficient way with no manual wiring.

## Similar libraries

- [promise-dag](https://github.com/vvvvalvalval/promise-dag)
- [dagmise](https://github.com/SidBala/dagmise)
- [Viae.ts](https://github.com/alephnan/viae.ts)
