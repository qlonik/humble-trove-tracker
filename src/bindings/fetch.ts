import fetch_, { RequestInfo, RequestInit, Response } from "node-fetch";
import * as T from "@effect-ts/core/Effect";
import { Tagged } from "@effect-ts/core/Case";

import { JsonData } from "./json.js";

export class FetchError extends Tagged("fetch-error")<{
  readonly error: unknown;
}> {}

export const fetch = (url: RequestInfo, opts?: Omit<RequestInit, "signal">) =>
  T.effectAsyncInterrupt<unknown, FetchError, Response>((cb) => {
    const { signal, abort } = new AbortController();

    fetch_(url, { ...opts, signal }).then(
      (response) => cb(T.succeed(response)),
      (error) => cb(T.fail(FetchError.make({ error })))
    );

    return T.succeedWith(() => {
      abort();
    });
  });

export class TransformationToJsonError extends Tagged(
  "transformation-to-json-error"
)<{ readonly error: unknown }> {}

export const responseToJson = (req: Response) =>
  T.tryCatchPromise(
    () => req.json() as Promise<JsonData>,
    (error) => TransformationToJsonError.make({ error })
  );
