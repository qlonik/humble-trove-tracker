import { Tagged } from "@effect-ts/core/Case";
import * as T from "@effect-ts/core/Effect";
import * as A from "@effect-ts/core/Collections/Immutable/Array";

export interface JsonArray extends A.Array<JsonData> {}
export interface JsonRecord {
  readonly [x: string]: JsonData;
}
export type JsonData =
  | null
  | string
  | number
  | boolean
  | JsonArray
  | JsonRecord;

export class JsonParseError extends Tagged("json-parse-error")<{
  readonly content: string;
  readonly error: unknown;
}> {}

export class JsonStringifyError extends Tagged("json-stringify-error")<{
  readonly args: unknown;
  readonly error: unknown;
}> {}

export const parse = (content: string) =>
  T.tryCatch(
    () => JSON.parse(content) as JsonData,
    (error) => JsonParseError.make({ content, error })
  );

export const stringify = (...args: Parameters<typeof JSON.stringify>) =>
  T.tryCatch(
    () => JSON.stringify(...args),
    (error) => JsonStringifyError.make({ args, error })
  );
