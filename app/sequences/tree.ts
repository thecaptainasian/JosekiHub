import { BOARD_SIZE, type MoveRecord, type Player } from "../lib/go";
import type { NextJosekiMove } from "./types";

type SupabaseClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

export interface SaveSequenceResult {
  createdNodeCount: number;
  nextMoves: NextJosekiMove[];
  terminalNodeId: string;
}

interface JosekiNodeRow {
  id: string;
  col: number | null;
  move_key: string;
  move_number: number;
  move_type: "root" | "play" | "pass";
  player: Player | null;
  row: number | null;
}

interface FindOrCreateResult {
  created: boolean;
  nodeId: string;
}

export async function getRootNodeId(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("joseki_nodes")
    .select("id")
    .eq("board_size", BOARD_SIZE)
    .eq("move_type", "root")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("The joseki tree root node has not been created yet.");
  }

  return data.id as string;
}

export async function getNextSavedMoves(
  supabase: SupabaseClient,
  currentNodeId: string | null,
): Promise<NextJosekiMove[]> {
  if (!currentNodeId) {
    return [];
  }

  const { data, error } = await supabase
    .from("joseki_nodes")
    .select("id, col, move_key, move_number, move_type, player, row")
    .eq("parent_id", currentNodeId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as JosekiNodeRow[])
    .filter((node) => node.move_type !== "root" && node.player)
    .map((node) => ({
      id: node.id,
      col: node.col,
      moveKey: node.move_key,
      moveNumber: node.move_number,
      moveType: node.move_type as "play" | "pass",
      player: node.player as Player,
      row: node.row,
    }));
}

export const getNextMoves = getNextSavedMoves;

export async function getNodePathFromMoves(
  supabase: SupabaseClient,
  moves: MoveRecord[],
) {
  let currentNodeId = await getRootNodeId(supabase);

  for (const move of moves) {
    const moveKey = createMoveKey(move);
    const { data, error } = await supabase
      .from("joseki_nodes")
      .select("id")
      .eq("parent_id", currentNodeId)
      .eq("move_key", moveKey)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.id) {
      return null;
    }

    currentNodeId = data.id as string;
  }

  return currentNodeId;
}

export async function saveSequence(
  supabase: SupabaseClient,
  moves: MoveRecord[],
  userId: string,
): Promise<SaveSequenceResult> {
  let createdNodeCount = 0;
  let currentNodeId = await getRootNodeId(supabase);

  for (const move of moves) {
    const result = await findOrCreateMove(supabase, currentNodeId, move, userId);
    currentNodeId = result.nodeId;

    if (result.created) {
      createdNodeCount += 1;
    }
  }

  const { error: savedLineError } = await supabase
    .from("saved_joseki_lines")
    .upsert(
      {
        terminal_node_id: currentNodeId,
        user_id: userId,
        visibility: "public",
      },
      {
        ignoreDuplicates: true,
        onConflict: "user_id,terminal_node_id",
      },
    );

  if (savedLineError) {
    throw new Error(savedLineError.message);
  }

  const nextMoves = await getNextSavedMoves(supabase, currentNodeId);

  return {
    createdNodeCount,
    nextMoves,
    terminalNodeId: currentNodeId,
  };
}

export async function findOrCreateMove(
  supabase: SupabaseClient,
  parentId: string,
  move: MoveRecord,
  userId: string,
): Promise<FindOrCreateResult> {
  const moveKey = createMoveKey(move);
  const existingNodeId = await findChildNodeId(supabase, parentId, moveKey);

  if (existingNodeId) {
    return {
      created: false,
      nodeId: existingNodeId,
    };
  }

  const point = move.point;
  const { data, error } = await supabase
    .from("joseki_nodes")
    .insert({
      board_size: BOARD_SIZE,
      col: point?.col ?? null,
      created_by: userId,
      depth: move.moveNumber,
      move_key: moveKey,
      move_number: move.moveNumber,
      move_type: move.type,
      parent_id: parentId,
      player: move.player,
      row: point?.row ?? null,
    })
    .select("id")
    .single();

  if (!error && data?.id) {
    return {
      created: true,
      nodeId: data.id as string,
    };
  }

  if (error?.code !== "23505") {
    throw new Error(error?.message ?? "Unable to save joseki move.");
  }

  const duplicateNodeId = await findChildNodeId(supabase, parentId, moveKey);

  if (!duplicateNodeId) {
    throw new Error("A joseki branch already exists but could not be loaded.");
  }

  return {
    created: false,
    nodeId: duplicateNodeId,
  };
}

async function findChildNodeId(
  supabase: SupabaseClient,
  parentId: string,
  moveKey: string,
) {
  const { data, error } = await supabase
    .from("joseki_nodes")
    .select("id")
    .eq("parent_id", parentId)
    .eq("move_key", moveKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ? (data.id as string) : null;
}

function createMoveKey(move: MoveRecord) {
  if (move.type === "pass") {
    return `${move.player}:pass`;
  }

  if (!move.point) {
    throw new Error("A played move must include a board point.");
  }

  return `${move.player}:${move.point.row},${move.point.col}`;
}
