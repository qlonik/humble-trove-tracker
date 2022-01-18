import * as T from "@effect-ts/core/Effect";
import * as A from "@effect-ts/core/Collections/Immutable/Array";
import * as O from "@effect-ts/core/Option";
import * as Ord from "@effect-ts/core/Ord";
import { flow, pipe } from "@effect-ts/system/Function";
import { Dirent, mkdir, readdir, readFile, writeFile } from "fs";
import { HasClock } from "@effect-ts/system/Clock";
import fetch_, { RequestInfo, RequestInit, Response } from "node-fetch";
import { basename, join } from "path";
import ErrnoException = NodeJS.ErrnoException;
import isEqual from "lodash.isequal";
import prettier from "prettier";

const TROVE_PAGE_URL = (chunk_index: number) =>
  `https://www.humblebundle.com/api/v1/trove/chunk?property=popularity&direction=desc&index=${chunk_index}`;

const fetch = (url: RequestInfo, opts?: Omit<RequestInit, "signal">) =>
  T.effectAsyncInterrupt<unknown, unknown, Response>((cb) => {
    const { signal, abort } = new AbortController();

    fetch_(url, { ...opts, signal }).then(
      (response) => cb(T.succeed(response)),
      (error) => cb(T.fail(error))
    );

    return T.succeedWith(() => {
      abort();
    });
  });

const jsonFromReq = (req: Response): T.IO<unknown, unknown> =>
  T.tryPromise(() => req.json());

function collectData() {
  function go(
    idx: number,
    data: unknown[]
  ): T.Effect<HasClock, Error, unknown[]> {
    return pipe(
      fetch(TROVE_PAGE_URL(idx)),
      T.mapError((x) => new Error("can not query: " + x)),
      T.chain((req) =>
        T.mapError_(
          jsonFromReq(req),
          (x) => new Error("can not parse json: " + x)
        )
      ),

      T.chain((result) =>
        Array.isArray(result)
          ? result.length === 0
            ? T.succeed(data)
            : T.delay_(go(idx + 1, [...data, ...result]), 1000)
          : T.fail(new Error("did not receive array: " + result))
      )
    );
  }

  return go(0, []);
}

function loadLatestFrom(path: string) {
  return pipe(
    T.effectAsync<unknown, ErrnoException, Dirent[]>((cb) => {
      readdir(path, { encoding: "utf-8", withFileTypes: true }, (err, files) =>
        err ? cb(T.fail(err)) : cb(T.succeed(files))
      );
    }),
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
    T.mapError(O.some),
    T.chain(T.fromOption),
    T.map((id) => join(path, `${id}.json`)),
    T.chain((path) =>
      T.effectAsyncInterrupt<unknown, O.Option<ErrnoException>, string>(
        (cb) => {
          const { signal, abort } = new AbortController();
          readFile(path, { encoding: "utf-8", signal }, (err, data) =>
            err ? cb(T.fail(O.some(err))) : cb(T.succeed(data))
          );
          return T.succeedWith(() => abort());
        }
      )
    ),
    T.chain((content) =>
      pipe(
        T.tryCatch(
          () => JSON.parse(content) as unknown,
          () => new Error("cannot parse")
        ),
        T.mapError(O.some)
      )
    ),
    T.optional
  );
}

pipe(
  T.do,
  T.let("dir", () => "./data/snapshots"),
  T.bind("year", () => T.succeedWith(() => new Date().getUTCFullYear())),
  T.bindAllPar(({ dir, year }) => ({
    data: collectData(),
    previous: loadLatestFrom(join(dir, year.toString())),
  })),

  T.tap(({ dir, year }) =>
    T.effectAsync((cb) =>
      mkdir(join(dir, year.toString()), { recursive: true }, (err) =>
        err ? cb(T.fail(err)) : cb(T.unit)
      )
    )
  ),

  T.chain(({ dir, year, data, previous }) => {
    if (O.isSome(previous) && isEqual(data, previous.value)) {
      return T.unit;
    }

    return pipe(
      T.do,

      T.bind("milliseconds", () => T.succeedWith(() => Date.now())),
      T.let("filepath", ({ milliseconds }) =>
        join(dir, year.toString(), `${milliseconds}.json`)
      ),
      T.bind("content", () => T.try(() => JSON.stringify(data))),
      T.let("formatted", ({ filepath, content }) =>
        prettier.format(content, { filepath })
      ),

      T.chain(({ filepath, formatted }) =>
        T.effectAsync((cb) =>
          writeFile(filepath, formatted, "utf-8", (err) =>
            err ? cb(T.fail(err)) : cb(T.unit)
          )
        )
      )
    );
  }),

  T.runPromise
);
