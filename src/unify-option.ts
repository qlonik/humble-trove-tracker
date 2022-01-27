import * as O from "@effect-ts/core/Option"
import { unsafeCoerce } from "@effect-ts/core/Function"

type UnifyOption<A> = [A] extends [O.Option<infer R>] ? O.Option<R> : A
export const unifyOption: <T extends O.Option<any>>(x: T) => UnifyOption<T> =
  unsafeCoerce
