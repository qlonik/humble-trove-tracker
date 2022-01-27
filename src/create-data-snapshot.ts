import { Tagged } from "@effect-ts/core/Case";
import * as A from "@effect-ts/core/Collections/Immutable/Array";
import * as Tp from "@effect-ts/core/Collections/Immutable/Tuple";
import * as T from "@effect-ts/core/Effect";
import * as E from "@effect-ts/core/Either";
import * as O from "@effect-ts/core/Option";
import * as Ord from "@effect-ts/core/Ord";
import { flow, identity, pipe } from "@effect-ts/system/Function";
import { basename, join } from "path";
import isEqual from "lodash.isequal";
import prettier from "prettier";

import { chainRec } from "@/src/bindings/chain-rec";
import { fetch, responseToJson } from "@/src/bindings/fetch";
import * as fs from "@/src/bindings/fs";
import * as Json from "@/src/bindings/json";
import { unifyOption } from "@/src/unify-option";

const TROVE_PAGE_URL = (chunk_index: number) =>
  `https://www.humblebundle.com/api/v1/trove/chunk?property=popularity&direction=desc&index=${chunk_index}`;

class DataIsNotAnArrayError extends Tagged("data-is-not-an-array-error")<{
  readonly result: unknown;
}> {}

const downloadData = chainRec(
  ({ tuple: [idx, data] }: Tp.Tuple<[number, A.Array<unknown>]>) =>
    pipe(
      fetch(TROVE_PAGE_URL(idx)),
      T.chain(responseToJson),
      idx === 0 ? identity : T.delay(1000),
      T.chain((result) =>
        !Array.isArray(result)
          ? T.fail(DataIsNotAnArrayError.make({ result }))
          : T.succeed(
              A.isNonEmpty(result)
                ? E.left(Tp.tuple(idx + 1, A.concat_(data, result)))
                : E.right(data)
            )
      )
    )
)(Tp.tuple(0, []));

function loadLatestSnapshotFrom(path: string) {
  return pipe(
    fs.readdir(path, { withFileTypes: true }),
    T.map(
      flow(
        A.collect((file) =>
          file.isFile() && file.name.endsWith(".json")
            ? O.some(basename(file.name, ".json"))
            : O.none
        ),
        A.sort(
          Ord.contramap_(
            Ord.number,
            flow(parseInt, (parsed) => (Number.isInteger(parsed) ? parsed : -1))
          )
        ),
        A.last
      )
    ),
    T.catchAll((err) =>
      err.code === "ENOENT" ? T.succeed(O.none) : T.fail(err)
    ),
    T.asSomeError,
    T.chain(T.fromOption),
    T.map((id) => join(path, `${id}.json`)),
    T.chain(flow(fs.readFile, T.asSomeError)),
    T.chain(flow(Json.parse, T.asSomeError)),
    T.mapError(unifyOption),
    T.optional
  );
}

pipe(
  T.do,
  T.let("dir", () => "./data/snapshots"),
  T.bind("milliseconds", () => T.succeedWith(() => Date.now())),
  T.bind("year", ({ milliseconds }) =>
    T.succeedWith(() => new Date(milliseconds).getUTCFullYear().toString())
  ),
  T.let("filepath", ({ dir, milliseconds, year }) =>
    join(dir, year.toString(), `${milliseconds}.json`)
  ),
  T.bindAllPar(({ dir, year }) => ({
    data: downloadData,
    previous: loadLatestSnapshotFrom(join(dir, year)),
    _: fs.mkdir(join(dir, year), { recursive: true }),
  })),

  T.chain(({ filepath, data, previous }) => {
    if (O.isSome(previous) && isEqual(data, previous.value)) {
      return T.unit;
    }

    return pipe(
      data,
      Json.stringify,
      T.map((content) => prettier.format(content, { filepath })),
      T.chain((formatted) => fs.writeFile(filepath, formatted, "utf-8"))
    );
  }),

  T.runPromise
);
