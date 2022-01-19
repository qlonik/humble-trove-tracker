import * as A from "@effect-ts/core/Collections/Immutable/Array";
import * as T from "@effect-ts/core/Effect";
import glob_ from "glob";

export function glob(pattern: string, options: glob_.IOptions = {}) {
  return T.effectAsync<unknown, Error, A.Array<string>>((cb) => {
    const globInst = glob_(pattern, options, (error, matches) =>
      cb(error ? T.fail(error) : T.succeed(matches))
    );

    return T.succeedWith(() => globInst.abort());
  });
}
