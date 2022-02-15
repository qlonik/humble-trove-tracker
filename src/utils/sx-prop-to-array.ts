import type { SxProps } from "@mui/material";

export function sxPropToArray<Theme extends object>(x: SxProps<Theme>) {
  return Array.isArray(x) ? x : [x];
}
