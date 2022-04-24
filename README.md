# Balamb 🌱

Concurrently run a set of dependent, asynchronous tasks with type-safe dependencies.

This library was initially intended for data seeding, hence the name, which comes from Final Fantasy VIII. Balamb Garden is a school where cadets, known as SeeDs, are trained.

## Example

```typescript
import Balamb, {BalambError, SeedDef} from "balamb"

// A `SeedDef` is a definition of a task (or `Seed`) to run.
// This `Seed` returns a `string`, and has no dependencies.
const CreateAString: SeedDef<string, void> = {
  // It has a unique ID
  id: "a_string",

  // A human-readable description
  description: "Just returns a string",

  // And a function to run. This is the task, or `Seed`. We `plant` the `Seed`.
  plant: async () => "thing",
}

type ObjResult = {n: number}

// This `Seed` returns `ObjResult`, and has a single dependency named `s`
// which returns a string: `{s: string}`.
const CreateAnObj: SeedDef<ObjResult, {s: string}> = {
  id: "an_object",
  description: "Just returns an object, based on its dependency",

  // It can also define other tasks as dependencies, which will be run first.
  // It has a single dependency which we've named `s`.
  // The types need to match the generic parameter defined above.
  dependsOn: {s: CreateAString},

  // We get passed the result of the task we depend on, which we've named `s`.
  // As before, the types must match.
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

## Rules

### Duplicates

- Seeds will be de-duplicated using identity equality (think `===` and `Set`s)
  - this means a unique seed will only be run once, even if provided several times
- Different seeds with the same ID will be rejected and an error returned

### Tagging

Tags can be used to run a subset of seeds.

If no tags are supplied to `Balamb.run` then all seeds are run. If tags are supplied then only seeds with matching tags (and their dependencies) are run.

In the following example, only `matching` and `dependency` will be run.

```typescript
const NonTaggedDependency: SeedDef<boolean, void> = {
  id: "dependency",
  description: "Dependency of a seed with a matching tag",

  plant: async () => {
    return true
  },
}

const Matching: SeedDef<boolean, {D: boolean}> = {
  id: "matching",
  description: "Matches tag",

  dependsOn: {D: NonTaggedDependency}

  tags: ["tag"],

  plant: async () => {
    return true
  },
}

const NotMatching: SeedDef<boolean, void> = {
  id: "not-matching",
  description: "Does not match tag",

  tags: ["not-tag"],

  plant: async () => {
    return true
  },
}

await Balamb.run([Matching, NotMatching, NonTaggedDependency], {
  tags: ["tag"],
})
```

### <a name="preseed"><a/>Pre-seeding

It is possible to 'pre-seed' Balamb with results, indexed by ID. Seeds with results supplied in this way will not be run. Any seeds which depend on these will receive the pre-seeded results.

It is important to note that this circumvents the type checking. Beware!

One use-case for this is to cache previous results. This way, you can do the following:

1. Run all seeds, save results
1. Add a new seeding task
1. Load previous results, re-run Balamb with previous results pre-seeded

And only the new seed will be run.

There are some caveats though. For example, as noted, the types are not checked. If result types change (e.g. by adding a new property to an object) and previous results become invalid... _oh no_.

Implementing persistent storage of previous runs is left to the client, if required.

#### Results must be JSON-serialisable

For this to work, results are required to be serialisable. This is so we can store them, and use them later to re-hydrate a run. This allows us to re-run a set of Seeds, ignoring any old seeds and only run the _new_ seeds. See [Pre-seeding](#preseed) above.

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

Note that `void` is an exception: `plant` functions are allow to return `void` (`undefined` at run time) which is not JSON-serialisable.

If I'm honest, I'm not sure about this design decision and am tempted to revert this requirement!

### Error handling

Balamb will return errors in some cases, e.g. invalid input or if seeds fail to run.

These general rules apply. Errors should:

- be `instanceof Error`
- be `instanceof BalambError`
- include an `info` property with a unique `errorCode` and other useful information
- have an informative error message

In the case where a seed fails to run (its returned Promise rejects) an error will be returned. All possible seeds will be run before returning the error. Any seeds which depend on failed seeds will be skipped.

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
