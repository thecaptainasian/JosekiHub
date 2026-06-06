import type { Player } from "../lib/go";

export interface NextJosekiMove {
  id: string;
  col: number | null;
  moveKey: string;
  moveNumber: number;
  moveType: "play" | "pass";
  player: Player;
  row: number | null;
}
