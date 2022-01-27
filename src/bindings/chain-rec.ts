import * as T from "@effect-ts/core/Effect";
import * as E from "@effect-ts/core/Either";
import * as P from "@effect-ts/core/Prelude";

export const { chainRec } = P.instance<P.ChainRec<[P.URI<T.EffectURI>]>>({
  chainRec: <R, E1, A, B>(f: (a: A) => T.Effect<R, E1, E.Either<A, B>>) =>
    function loop(a: A): T.Effect<R, E1, B> {
      return T.suspend(() => T.chain_(f(a), E.fold(loop, T.succeed)));
    },
});
