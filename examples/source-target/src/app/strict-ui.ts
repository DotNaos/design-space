import type { ReactElement } from "react";

export type ComponentSlot<Accepted> = ReactElement & { readonly __acceptedComponent?: Accepted };
export type ComponentSlotList<Accepted, Minimum extends number = 0, Maximum extends number = number> =
  readonly ComponentSlot<Accepted>[] & { readonly __cardinality?: readonly [Minimum, Maximum] };
