import { identity } from "@effect-ts/core/Function";

import summaryData from "@/data/summary.json";

type GameExceptions =
  | {
      name: "Oh, Deer!";
      availability: [number, number];
      game_url: string;
      thumbnail_url: string;
      srcset: string[];
      srcsetsizes: string[];
      thumbnail_img_tag: string;
    }
  | {
      name: "The Incredible Machine Mega Pack";
      availability: [number, number];
      thumbnail_url: string;
      wikipedia_url: string;
      archive_url: string;
      gog_url: string;
    };

type CommonFields = { name: string; availability: [number, number] };
type DifferentGameInfoTypes =
  | { ref_type: "humble"; description: string; image_url: string }
  | { ref_type: "steam"; steam_type: "app" | "sub"; steam_id: string }
  | { ref_type: "developer"; game_url: string; thumbnail_url: string };

export type GameSummary =
  | GameExceptions
  | (CommonFields & DifferentGameInfoTypes);

export const GameSummaryData =
  summaryData as unknown as ReadonlyArray<GameSummary>;

const exceptionNames = Object.keys(
  identity<Record<GameExceptions["name"], null>>({
    "Oh, Deer!": null,
    "The Incredible Machine Mega Pack": null,
  })
);
export const isGameException = (v: GameSummary): v is GameExceptions =>
  exceptionNames.includes(v.name);
