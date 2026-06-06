"use server";

import { BOARD_SIZE, type MoveRecord, type Player } from "../lib/go";
import { getNextSavedMoves, saveSequence } from "./tree";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

type SaveSequenceInput = {
  boardHash: unknown;
  moves: unknown;
};

export async function saveSequenceAction(input: SaveSequenceInput) {
  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      message: "Supabase is not configured yet.",
    };
  }

  const boardHash =
    typeof input.boardHash === "string" ? input.boardHash.trim() : "";
  const moves = sanitizeMoves(input.moves);

  if (!boardHash) {
    return {
      ok: false,
      message: "The current board pattern is missing.",
    };
  }

  if (!moves) {
    return {
      ok: false,
      message: "Play at least one valid move before saving a sequence.",
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId =
    typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!userId) {
    return {
      ok: false,
      message: "Sign in before saving a sequence.",
    };
  }

  try {
    const result = await saveSequence(supabase, moves, userId);
    const branchMessage =
      result.createdNodeCount === 0
        ? "Reused the existing joseki branch."
        : `Added ${result.createdNodeCount} new branch node${result.createdNodeCount === 1 ? "" : "s"}.`;

    return {
      ok: true,
      message: `Saved ${moves.length}-move sequence. ${branchMessage}`,
      nextMoves: result.nextMoves,
      terminalNodeId: result.terminalNodeId,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to save sequence.",
    };
  }
}

export async function getNextSavedMovesAction(currentNodeId: unknown) {
  if (!hasSupabaseEnv()) {
    return {
      moves: [],
      ok: false,
      message: "Supabase is not configured yet.",
    };
  }

  if (currentNodeId !== null && typeof currentNodeId !== "string") {
    return {
      moves: [],
      ok: false,
      message: "The current joseki node is invalid.",
    };
  }

  try {
    const supabase = await createClient();
    const moves = await getNextSavedMoves(supabase, currentNodeId);

    return {
      moves,
      ok: true,
      message: null,
    };
  } catch (error) {
    return {
      moves: [],
      ok: false,
      message:
        error instanceof Error ? error.message : "Unable to load next moves.",
    };
  }
}

function sanitizeMoves(value: unknown): MoveRecord[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) {
    return null;
  }

  const moves: MoveRecord[] = [];

  for (const [index, move] of value.entries()) {
    if (!move || typeof move !== "object") {
      return null;
    }

    const candidate = move as Record<string, unknown>;
    const player = sanitizePlayer(candidate.player);
    const type = candidate.type === "play" || candidate.type === "pass"
      ? candidate.type
      : null;
    const moveNumber = sanitizeInteger(candidate.moveNumber);
    const captured = sanitizeInteger(candidate.captured);

    if (!player || !type || moveNumber !== index + 1 || captured === null) {
      return null;
    }

    if (type === "pass") {
      moves.push({
        captured,
        moveNumber,
        player,
        point: null,
        type,
      });
      continue;
    }

    const point = sanitizePoint(candidate.point);

    if (!point) {
      return null;
    }

    moves.push({
      captured,
      moveNumber,
      player,
      point,
      type,
    });
  }

  return moves;
}

function sanitizePlayer(value: unknown): Player | null {
  return value === "black" || value === "white" ? value : null;
}

function sanitizePoint(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const point = value as Record<string, unknown>;
  const row = sanitizeInteger(point.row);
  const col = sanitizeInteger(point.col);

  if (
    row === null ||
    col === null ||
    row < 0 ||
    col < 0 ||
    row >= BOARD_SIZE ||
    col >= BOARD_SIZE
  ) {
    return null;
  }

  return {
    row,
    col,
  };
}

function sanitizeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}
