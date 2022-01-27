import { Tagged } from "@effect-ts/core/Case";
import * as T from "@effect-ts/core/Effect";

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
    () => JSON.parse(content) as unknown,
    (error) => JsonParseError.make({ content, error })
  );

export const stringify = (...args: Parameters<typeof JSON.stringify>) =>
  T.tryCatch(
    () => JSON.stringify(...args),
    (error) => JsonStringifyError.make({ args, error })
  );
