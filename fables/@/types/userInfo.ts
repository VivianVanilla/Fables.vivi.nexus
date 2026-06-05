// Types for userInfo schema from Supabase
export namespace userInfo {
  export interface Objects {
    id: string; // uuid
    name: string;
    data: JSON;
    created_at: string; // timestamp
    type: string;
    parent_id: string | null; // uuid
    owner_id: string; // uuid
    position: number;
  }

  export interface ObjectsInsert
    extends Omit<Objects, "id" | "created_at" > {}

  export interface ObjectsUpdate
    extends Partial<Omit<Objects, "id" | "created_at">> {}
}

// Type alias for convenience
export type UserInfoObjects = userInfo.Objects;
export type UserInfoObjectsInsert = userInfo.ObjectsInsert;
export type UserInfoObjectsUpdate = userInfo.ObjectsUpdate;
