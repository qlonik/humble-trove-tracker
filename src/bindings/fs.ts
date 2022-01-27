import * as A from "@effect-ts/core/Collections/Immutable/Array";
import * as T from "@effect-ts/core/Effect";
import * as fs from "node:fs";

export function readFile(path: string) {
  return T.effectAsyncInterrupt<unknown, NodeJS.ErrnoException, string>(
    (cb) => {
      const { signal, abort } = new AbortController();
      fs.readFile(path, { encoding: "utf-8", signal }, (err, data) =>
        cb(err ? T.fail(err) : T.succeed(data))
      );
      return T.succeedWith(() => abort());
    }
  );
}

export function writeFile(
  filepath: fs.PathOrFileDescriptor,
  content: string | NodeJS.ArrayBufferView,
  options?:
    | (fs.ObjectEncodingOptions & {
        mode?: fs.Mode | undefined;
        flag?: string | undefined;
      })
    | BufferEncoding
    | null
    | undefined
) {
  return T.effectAsyncInterrupt((cb) => {
    const { signal, abort } = new AbortController();
    fs.writeFile(
      filepath,
      content,
      typeof options === "object"
        ? { ...options, signal }
        : { encoding: options, signal },
      (err) => (err ? cb(T.fail(err)) : cb(T.unit))
    );
    return T.succeedWith(() => abort());
  });
}

export function readdir(
  path: fs.PathLike,
  options: { encoding: "buffer"; withFileTypes?: false | undefined } | "buffer"
): T.IO<NodeJS.ErrnoException, A.Array<Buffer>>;
export function readdir(
  path: fs.PathLike,
  options:
    | { encoding: BufferEncoding | null; withFileTypes?: false | undefined }
    | BufferEncoding
    | undefined
    | null
): T.IO<NodeJS.ErrnoException, A.Array<string>>;
export function readdir(
  path: fs.PathLike,
  options:
    | (fs.ObjectEncodingOptions & { withFileTypes?: false | undefined })
    | BufferEncoding
    | undefined
    | null
): T.IO<NodeJS.ErrnoException, A.Array<string> | A.Array<Buffer>>;
export function readdir(
  path: fs.PathLike
): T.IO<NodeJS.ErrnoException, A.Array<string>>;
export function readdir(
  path: fs.PathLike,
  options: fs.ObjectEncodingOptions & { withFileTypes: true }
): T.IO<NodeJS.ErrnoException, A.Array<fs.Dirent>>;
export function readdir(
  path: fs.PathLike,
  options?:
    | BufferEncoding
    | "buffer"
    | {
        encoding?: BufferEncoding | "buffer" | null | undefined;
        withFileTypes?: boolean | undefined;
      }
    | null
    | undefined
): T.IO<
  NodeJS.ErrnoException,
  A.Array<string> | A.Array<Buffer> | A.Array<fs.Dirent>
> {
  return T.effectAsync<
    unknown,
    NodeJS.ErrnoException,
    A.Array<string> | A.Array<Buffer> | A.Array<fs.Dirent>
  >((cb) => {
    fs.readdir(path, options as never, (err, files) =>
      err ? cb(T.fail(err)) : cb(T.succeed(files))
    );
  });
}

export function mkdir(
  path: fs.PathLike,
  options:
    | fs.Mode
    | (fs.MakeDirectoryOptions & { recursive?: false | undefined })
    | null
    | undefined
): T.IO<NodeJS.ErrnoException, void>;
export function mkdir(
  path: fs.PathLike,
  options: fs.Mode | fs.MakeDirectoryOptions | null | undefined
): T.IO<NodeJS.ErrnoException, string | undefined>;
export function mkdir(path: fs.PathLike): T.IO<NodeJS.ErrnoException, void>;
export function mkdir(
  path: fs.PathLike,
  options?: fs.Mode | fs.MakeDirectoryOptions | null | undefined
) {
  return T.effectAsync<unknown, NodeJS.ErrnoException, void>((cb) =>
    fs.mkdir(path, options, (err) => (err ? cb(T.fail(err)) : cb(T.unit)))
  );
}
