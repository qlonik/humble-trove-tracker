import { Tagged } from "@effect-ts/core/Case";
import * as A from "@effect-ts/core/Collections/Immutable/Array";
import * as Tp from "@effect-ts/core/Collections/Immutable/Tuple";
import * as T from "@effect-ts/core/Effect";
import * as E from "@effect-ts/core/Either";
import * as O from "@effect-ts/core/Option";
import * as Ord from "@effect-ts/core/Ord";
import { flow, identity, pipe } from "@effect-ts/system/Function";
import isEqual from "lodash.isequal";
import prettier from "prettier";

import { chainRec } from "./bindings/chain-rec.js";
import { fetch, responseToJson } from "./bindings/fetch.js";
import * as fs from "./bindings/fs.js";
import * as Json from "./bindings/json.js";
import { unifyOption } from "./unify-option.js";

const TROVE_PAGE_URL = (chunk_index: number) =>
  `https://www.humblebundle.com/client/catalog?index=${chunk_index}`;

class DataIsNotAnArrayError extends Tagged("data-is-not-an-array-error")<{
  readonly result: unknown;
}> {}

const downloadData = chainRec(
  ({ tuple: [idx, data] }: Tp.Tuple<[number, A.Array<Json.JsonData>]>) =>
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

const loadSnapshot = flow(
  fs.readFile,
  T.mapError(O.fromPredicate((err) => err.code !== "ENOENT")),
  T.chain(flow(Json.parse, T.asSomeError)),
  T.mapError(unifyOption),
  T.optional
);

function sortSnapshot(snapshot: A.Array<Json.JsonData>): typeof snapshot {
  function formatJsonObject(object: Json.JsonData): Json.JsonData {
    return Array.isArray(object)
      ? A.map_(object, formatJsonObject)
      : object === null ||
        typeof object === "string" ||
        typeof object === "number" ||
        typeof object === "boolean"
      ? object
      : pipe(
          Object.entries(object) as A.Array<[string, Json.JsonData]>,
          A.map(([k, v]) => [k, formatJsonObject(v)] as const),
          A.sort(Ord.contramap_(Ord.string, (x) => x[0])),
          (x) => Object.fromEntries(x) as Json.JsonRecord
        );
  }

  return pipe(
    snapshot as A.Array<{ machine_name: string } & Json.JsonRecord>,
    A.sort(Ord.contramap_(Ord.string, (x) => x.machine_name)),
    A.map(formatJsonObject)
  );
}

pipe(
  T.do,
  T.let("filepath", () => "./data/snapshot.json"),
  T.bindAllPar(({ filepath }) => ({
    data: T.map_(downloadData, sortSnapshot),
    previous: loadSnapshot(filepath),
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
