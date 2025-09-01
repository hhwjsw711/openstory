import type {
  Database,
  Enums,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/lib/supabase/gen.types";

// Re-export the Database type
export type { Database };

// Table row types (what you get from SELECT)
export type User = Tables<"users">;
export type Team = Tables<"teams">;
export type TeamMember = Tables<"team_members">;
export type Sequence = Tables<"sequences">;
export type Frame = Tables<"frames">;
export type Style = Tables<"styles">;
export type Character = Tables<"characters">;
export type Audio = Tables<"audio">;
export type VFX = Tables<"vfx">;
export type Job = Tables<"jobs">;
export type Credit = Tables<"credits">;
export type Transaction = Tables<"transactions">;

// Insert types (for creating new records)
export type UserInsert = TablesInsert<"users">;
export type TeamInsert = TablesInsert<"teams">;
export type TeamMemberInsert = TablesInsert<"team_members">;
export type SequenceInsert = TablesInsert<"sequences">;
export type FrameInsert = TablesInsert<"frames">;
export type StyleInsert = TablesInsert<"styles">;
export type CharacterInsert = TablesInsert<"characters">;
export type AudioInsert = TablesInsert<"audio">;
export type VFXInsert = TablesInsert<"vfx">;
export type JobInsert = TablesInsert<"jobs">;
export type CreditInsert = TablesInsert<"credits">;
export type TransactionInsert = TablesInsert<"transactions">;

// Update types (for updating existing records)
export type UserUpdate = TablesUpdate<"users">;
export type TeamUpdate = TablesUpdate<"teams">;
export type TeamMemberUpdate = TablesUpdate<"team_members">;
export type SequenceUpdate = TablesUpdate<"sequences">;
export type FrameUpdate = TablesUpdate<"frames">;
export type StyleUpdate = TablesUpdate<"styles">;
export type CharacterUpdate = TablesUpdate<"characters">;
export type AudioUpdate = TablesUpdate<"audio">;
export type VFXUpdate = TablesUpdate<"vfx">;
export type JobUpdate = TablesUpdate<"jobs">;
export type CreditUpdate = TablesUpdate<"credits">;
export type TransactionUpdate = TablesUpdate<"transactions">;

// Enum types
export type SequenceStatus = Enums<"sequence_status">;
export type TeamMemberRole = Enums<"team_member_role">;
export type TransactionType = Enums<"transaction_type">;
