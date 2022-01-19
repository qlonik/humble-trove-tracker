import { Tagged } from "@effect-ts/core/Case";
import * as A from "@effect-ts/core/Collections/Immutable/Array";
import * as NEA from "@effect-ts/core/Collections/Immutable/NonEmptyArray";
import * as Chk from "@effect-ts/core/Collections/Immutable/Chunk";
import * as RBT from "@effect-ts/core/Collections/Immutable/RedBlackTree";
import * as T from "@effect-ts/core/Effect";
import { absurd, flow, pipe, unsafeCoerce } from "@effect-ts/core/Function";
import * as O from "@effect-ts/core/Option";
import * as Ord from "@effect-ts/core/Ord";
import { _A, _E, _R } from "@effect-ts/core/Utils";
import { createRequire } from "node:module";
import { basename, join } from "node:path";

import { readFile } from "./bindings/fs";
import { glob } from "./bindings/glob";
import * as Json from "./bindings/json";
import * as GameAvailability from "./game-availability";

/**
 * @see https://github.com/microsoft/TypeScript/issues/40694
 * @see https://github.com/nodejs/node/issues/33741#issuecomment-639463213
 * @see https://github.com/TypeStrong/ts-node/issues/1007#issuecomment-953464137
 * FIXME
 */
const historicalExisting: typeof import("../data/historical/existing-on-2021.06.json") =
  createRequire(import.meta.url)("../data/historical/existing-on-2021.06.json");
const historicalRemoved: typeof import("../data/historical/removed-on-2021.06.json") =
  createRequire(import.meta.url)("../data/historical/removed-on-2021.06.json");

interface HistoricalData {
  readonly name: string;
  readonly added: string;
  readonly removed?: string;
  readonly urls: {
    readonly homepage?: string;
    readonly steam?: string;
  };
  readonly note?: string;
}

const HISTORICAL_EXISTING: ReadonlyArray<HistoricalData> = historicalExisting;
const HISTORICAL_REMOVED: ReadonlyArray<HistoricalData> = historicalRemoved;
// This date is the second friday of June 2021, which is when Trove is updated
// according to Humble Bundle website.
const HISTORICAL_TIMESTAMP = new Date(2021, 6, 11);
const HISTORICAL_REGEX = /(\d{4})\.(\d{2})/;

const SNAPSHOTS_LOCATION = "./data/snapshots";
const COMBINED_FILEPATH = "./data/combined.json";

interface GameDescription {
  readonly "human-name": string;
  // unix timestamp
  readonly "date-added"?: number | null | undefined;
  // unix timestamp
  readonly "date-ended"?: number | null | undefined;
}

const loadedSnapshotOrd = <A extends { timestamp: Date }>() =>
  Ord.contramap_(Ord.date, (x: A) => x.timestamp);

const getAllSnapshotPaths = glob("*/*.json", { cwd: SNAPSHOTS_LOCATION });

class SnapshotParseError extends Tagged("snapshot-parse-error")<{
  readonly id: string;
  readonly error: unknown;
}> {}
class SnapshotIdIsNotANumberError extends Tagged(
  "snapshot-id-is-not-a-number"
)<{ readonly id: string }> {}

const readSnapshotContent = flow(
  (id: string) => T.succeed({ id }),
  T.bind("content", ({ id }) =>
    pipe(
      join(SNAPSHOTS_LOCATION, id),
      readFile,
      T.chain((content) =>
        T.mapError_(Json.parse(content), ({ error }) =>
          SnapshotParseError.make({ id, error })
        )
      )
    )
  ),
  T.bind("timestamp", ({ id }) =>
    pipe(
      basename(id, ".json"),
      parseInt,
      T.fromPredicate(
        (x) => !Number.isNaN(x),
        () => SnapshotIdIsNotANumberError.make({ id })
      ),
      T.map((x) => new Date(x))
    )
  )
);

const parseHistoricalDate = (val: string): O.Option<number> =>
  pipe(
    HISTORICAL_REGEX.exec(val),
    O.fromNullable,
    O.map(([, year, month]) => [parseInt(year), parseInt(month)] as const),
    O.chain(
      O.fromPredicate(
        ([year, month]) => Number.isInteger(year) && Number.isInteger(month)
      )
    ),
    O.map(([year, month]) => new Date(year, month).getTime())
  );

interface GameTreeSummary {
  readonly name: string;
  readonly lastKnownAvailability: Date;
  readonly existence: GameAvailability.GameAvailability;
}

export interface GameSummary {
  readonly name: string;
  readonly existence: {
    previous: A.Array<readonly [number, number]>;
    current: readonly [number, number | null];
  };
}

const insertGameTreeSummary = (
  tree: RBT.RedBlackTree<string, GameTreeSummary>,
  { name, lastKnownAvailability, existence }: GameTreeSummary
) =>
  O.fold_(
    RBT.findFirst_(tree, name),
    () => RBT.insert_(tree, name, { name, lastKnownAvailability, existence }),
    (gameInTree) =>
      pipe(
        tree,
        RBT.removeFirst(name),
        RBT.insert(name, {
          name,
          lastKnownAvailability,
          existence: GameAvailability.concat(gameInTree.existence, existence),
        })
      )
  );

const emptySummaryTree = RBT.make<GameTreeSummary["name"], GameTreeSummary>(
  Ord.string
);

class GameInvalidHistoricalDateError extends Tagged(
  "invalid-game-historical-date"
)<{
  readonly name: string;
  readonly type: "added" | "removed";
  readonly date: string;
}> {}

const initSummary = T.reduce_(
  A.concat_(HISTORICAL_EXISTING, HISTORICAL_REMOVED),
  emptySummaryTree,
  (tree, { name, added, removed }) =>
    pipe(
      parseHistoricalDate(added),
      T.fromOption,
      T.flattenErrorOption(() =>
        GameInvalidHistoricalDateError.make({
          name,
          type: "added",
          date: added,
        })
      ),
      T.zip(
        O.fold_(
          O.fromNullable(removed),
          () => T.succeed(O.none),
          (removed) =>
            pipe(
              parseHistoricalDate(removed),
              T.fromOption,
              T.map(O.some),
              T.flattenErrorOption(() =>
                GameInvalidHistoricalDateError.make({
                  name,
                  type: "removed",
                  date: removed,
                })
              )
            )
        )
      ),
      T.map(({ tuple: [since, removed] }) =>
        O.fold_(
          removed,
          () => GameAvailability.SinceDate.make({ since }),
          (until) => GameAvailability.ForRange.make({ since, until })
        )
      ),
      T.map((existence) =>
        insertGameTreeSummary(tree, {
          name,
          lastKnownAvailability: HISTORICAL_TIMESTAMP,
          existence,
        })
      )
    )
);

class GameMissingAddedDateError extends Tagged("game-missing-date")<{
  readonly snapshotId: string;
  readonly name: string;
}> {}

const makeGameAvailabilityFromSnapshotTime = (
  since: number | null | undefined,
  until: number | null | undefined
) =>
  O.map_(O.fromNullable(since), (since) =>
    O.fold_(
      O.fromNullable(until),
      () =>
        GameAvailability.SinceDate.make({
          since: since * 1000,
        }),
      (until) =>
        GameAvailability.ForRange.make({
          since: since * 1000,
          until: until * 1000,
        })
    )
  );

const combineSnapshots = (
  snapshots: Chk.Chunk<{
    readonly id: string;
    readonly timestamp: Date;
    readonly content: ReadonlyArray<GameDescription>;
  }>,
  initSummary: typeof emptySummaryTree
) =>
  T.reduce_(snapshots, initSummary, (currentTree, { id, timestamp, content }) =>
    pipe(
      RBT.values_(currentTree),
      T.reduce(
        { tree: emptySummaryTree, remainingSummaries: content },
        (
          { tree, remainingSummaries },
          { name, lastKnownAvailability, existence }
        ) =>
          O.fold_(
            A.findIndex_(
              remainingSummaries,
              (game) => game["human-name"] === name
            ),
            () =>
              T.succeed({
                tree: insertGameTreeSummary(tree, {
                  name,
                  lastKnownAvailability,
                  existence:
                    existence._tag === "since-date" ||
                    existence._tag === "chunks-since-date"
                      ? GameAvailability.setFinished(
                          existence,
                          lastKnownAvailability.getTime()
                        )
                      : existence,
                }),
                remainingSummaries,
              }),
            (i) =>
              pipe(
                makeGameAvailabilityFromSnapshotTime(
                  remainingSummaries[i]["date-added"],
                  remainingSummaries[i]["date-ended"]
                ),
                T.fromOption,
                T.flattenErrorOption(() =>
                  GameMissingAddedDateError.make({ snapshotId: id, name })
                ),
                T.map((extra) => ({
                  tree: insertGameTreeSummary(tree, {
                    name,
                    lastKnownAvailability: timestamp,
                    existence: GameAvailability.concat(existence, extra),
                  }),
                  remainingSummaries: A.unsafeDeleteAt_(remainingSummaries, i),
                }))
              )
          )
      ),
      T.chain(({ tree, remainingSummaries }) =>
        T.reduce_(remainingSummaries, tree, (tree, snapshot) =>
          pipe(
            makeGameAvailabilityFromSnapshotTime(
              snapshot["date-added"],
              snapshot["date-ended"]
            ),
            T.fromOption,
            T.flattenErrorOption(() =>
              GameMissingAddedDateError.make({
                snapshotId: id,
                name: snapshot["human-name"],
              })
            ),
            T.map((existence) =>
              insertGameTreeSummary(tree, {
                name: snapshot["human-name"],
                lastKnownAvailability: timestamp,
                existence,
              })
            )
          )
        )
      )
    )
  );

function sinceOrRangeToTup(x: GameAvailability.ForRange): [number, number];
function sinceOrRangeToTup(
  x: GameAvailability.SinceDate | GameAvailability.ForRange
): [number, number | null];
function sinceOrRangeToTup(
  x: GameAvailability.SinceDate | GameAvailability.ForRange
): [number, number | null] {
  return x._tag === "since-date"
    ? [Math.trunc(x.since / 1000), null]
    : x._tag === "for-range"
    ? [Math.trunc(x.since / 1000), Math.trunc(x.until / 1000)]
    : absurd(x);
}

export const dataSummary = pipe(
  getAllSnapshotPaths,
  T.chain(T.forEachPar(readSnapshotContent)),
  T.map(Chk.sort(loadedSnapshotOrd())),
  (x) =>
    unsafeCoerce<
      typeof x,
      T.Effect<
        _R<typeof x>,
        _E<typeof x>,
        Chk.Chunk<
          Omit<_A<_A<typeof x>>, "content"> & {
            readonly content: ReadonlyArray<GameDescription>;
          }
        >
      >
    >(x),
  T.zipPar(initSummary),
  T.chain(({ tuple: [snapshots, initSummary] }) =>
    combineSnapshots(snapshots, initSummary)
  ),
  T.map(RBT.values()),
  T.map(A.from),
  T.map(
    A.map(
      ({ name, existence }): GameSummary => ({
        name,
        existence:
          existence._tag === "since-date" || existence._tag === "for-range"
            ? { previous: [], current: sinceOrRangeToTup(existence) }
            : existence._tag === "chunks-since-date" ||
              existence._tag === "chunks-for-range"
            ? {
                previous: A.map_(existence.previous, (x) =>
                  sinceOrRangeToTup(x)
                ),
                current: sinceOrRangeToTup(existence.current),
              }
            : absurd(existence),
      })
    )
  )
);
