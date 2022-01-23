import { Tagged } from "@effect-ts/core/Case";
import * as A from "@effect-ts/core/Collections/Immutable/Array";
import * as NEA from "@effect-ts/core/Collections/Immutable/NonEmptyArray";
import { absurd, identity, pipe } from "@effect-ts/core/Function";
import * as Ord from "@effect-ts/core/Ord";

export class SinceDate extends Tagged("since-date")<{
  readonly since: number;
}> {}
export class ForRange extends Tagged("for-range")<{
  readonly since: number;
  // TODO: until could either be exact date or unknown interval
  readonly until: number;
}> {
  constructor(data: { readonly since: number; readonly until: number }) {
    super(data);

    if (data.since >= data.until) {
      throw new RangeError('"since" has to be smaller than "until"');
    }
  }
}
export class ChunksSinceDate extends Tagged("chunks-since-date")<{
  readonly previous: NEA.NonEmptyArray<ForRange>;
  readonly current: SinceDate;
}> {}
export class ChunksForRange extends Tagged("chunks-for-range")<{
  readonly previous: NEA.NonEmptyArray<ForRange>;
  readonly current: ForRange;
}> {}

export type GameAvailability =
  | SinceDate
  | ForRange
  | ChunksSinceDate
  | ChunksForRange;

function mergeSince(a: SinceDate, b: SinceDate): SinceDate {
  return a.since <= b.since ? a : b;
}
function mergeSinceAndRange(
  a: SinceDate,
  b: ForRange
): SinceDate | ChunksSinceDate {
  return pipe(Ord.number.compare(b.until, a.since), (comp) =>
    comp === -1
      ? ChunksSinceDate.make({ previous: [b], current: a })
      : comp === 0
      ? SinceDate.make({ since: b.since })
      : comp === 1
      ? mergeSince(a, SinceDate.make({ since: b.since }))
      : absurd(comp)
  );
}

function rangesOverlap(a: ForRange, b: ForRange) {
  return (
    Ord.leq(Ord.number)(a.since, b.until) &&
    Ord.leq(Ord.number)(b.since, a.until)
  );
}
function mergeForRange(a: ForRange, b: ForRange): ForRange | ChunksForRange {
  if (!rangesOverlap(a, b)) {
    return a.since < b.since
      ? ChunksForRange.make({ previous: [a], current: b })
      : ChunksForRange.make({ previous: [b], current: a });
  }

  return ForRange.make({
    since: NEA.head(NEA.sort(Ord.number)([a.since, b.since])),
    until: NEA.last(NEA.sort(Ord.number)([a.until, b.until])),
  });
}

function mergeSinceWithRange(
  a: SinceDate | ForRange,
  b: SinceDate | ForRange
): GameAvailability {
  return a._tag === "since-date"
    ? b._tag === "since-date"
      ? mergeSince(a, b)
      : b._tag === "for-range"
      ? mergeSinceAndRange(a, b)
      : absurd(b)
    : a._tag === "for-range"
    ? b._tag === "since-date"
      ? mergeSinceAndRange(b, a)
      : b._tag === "for-range"
      ? mergeForRange(a, b)
      : absurd(b)
    : absurd(a);
}

function mergeWithChunks(
  a: SinceDate | ForRange,
  b: ChunksSinceDate | ChunksForRange
): GameAvailability {
  return pipe(
    A.append_(b.previous, b.current),
    A.reduce(
      { previous: A.empty<ForRange>(), current: a },
      ({ previous, current }, range) => {
        const merged = mergeSinceWithRange(current, range);
        return merged._tag === "since-date" || merged._tag === "for-range"
          ? { previous, current: merged }
          : merged._tag === "chunks-since-date" ||
            merged._tag === "chunks-for-range"
          ? {
              previous: A.concat_(previous, merged.previous),
              current: merged.current,
            }
          : absurd(merged);
      }
    ),
    ({ previous, current }) =>
      A.isNonEmpty(previous)
        ? current._tag === "since-date"
          ? ChunksSinceDate.make({ previous, current })
          : current._tag === "for-range"
          ? ChunksForRange.make({ previous, current })
          : absurd(current)
        : current
  );
}

function mergeChunks(
  a: ChunksSinceDate | ChunksForRange,
  b: ChunksSinceDate | ChunksForRange
): GameAvailability {
  return A.reduce_(
    A.append_(a.previous, a.current),
    identity<GameAvailability>(b),
    (merged, data) =>
      merged._tag === "since-date" || merged._tag === "for-range"
        ? mergeSinceWithRange(data, merged)
        : merged._tag === "chunks-since-date" ||
          merged._tag === "chunks-for-range"
        ? mergeWithChunks(data, merged)
        : absurd(merged)
  );
}

export function concat(a: SinceDate, b: SinceDate): SinceDate;
export function concat(a: SinceDate, b: ForRange): SinceDate | ChunksSinceDate;
export function concat(a: ForRange, b: SinceDate): SinceDate | ChunksSinceDate;
export function concat(a: ForRange, b: ForRange): ForRange | ChunksForRange;
export function concat(
  a: GameAvailability,
  b: GameAvailability
): GameAvailability;
export function concat(
  a: GameAvailability,
  b: GameAvailability
): GameAvailability {
  return a._tag === "since-date" || a._tag === "for-range"
    ? b._tag === "since-date" || b._tag === "for-range"
      ? mergeSinceWithRange(a, b)
      : b._tag === "chunks-since-date" || b._tag === "chunks-for-range"
      ? mergeWithChunks(a, b)
      : absurd(b)
    : a._tag === "chunks-since-date" || a._tag === "chunks-for-range"
    ? b._tag === "since-date" || b._tag === "for-range"
      ? mergeWithChunks(b, a)
      : b._tag === "chunks-since-date" || b._tag === "chunks-for-range"
      ? mergeChunks(a, b)
      : absurd(b)
    : absurd(a);
}

export function setFinished(a: SinceDate, b: number): ForRange;
export function setFinished(a: ChunksSinceDate, b: number): ChunksForRange;
export function setFinished(
  a: SinceDate | ChunksSinceDate,
  b: number
): ForRange | ChunksForRange;
export function setFinished(
  a: SinceDate | ChunksSinceDate,
  b: number
): ForRange | ChunksForRange {
  return a._tag === "since-date"
    ? ForRange.make({ since: a.since, until: b })
    : a._tag === "chunks-since-date"
    ? ChunksForRange.make({
        previous: a.previous,
        current: ForRange.make({
          since: a.current.since,
          until: b,
        }),
      })
    : absurd(a);
}

export function fold<A, B, C, D>(
  onSinceDate: (sinceDate: SinceDate) => A,
  onForRange: (forRange: ForRange) => B,
  onChunksSinceDate: (chunksSinceDate: ChunksSinceDate) => C,
  onChunksForRange: (chunksForRange: ChunksForRange) => D
) {
  return (a: GameAvailability): A | B | C | D =>
    a._tag === "since-date"
      ? onSinceDate(a)
      : a._tag === "for-range"
      ? onForRange(a)
      : a._tag === "chunks-since-date"
      ? onChunksSinceDate(a)
      : a._tag === "chunks-for-range"
      ? onChunksForRange(a)
      : absurd(a);
}
