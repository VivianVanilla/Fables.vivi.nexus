// Types for userInfo schema from Supabase
export namespace userInfo {
  export interface Objects {
    id: string; // uuid
    name: string;
    slug: string;
    parent_folder: string | null; // uuid
    user_id: string; // uuid
  }

  export interface ObjectsInsert
    extends Omit<Objects, "id" | "created_at" | "updated_at"> {}

  export interface ObjectsUpdate
    extends Partial<Omit<Objects, "id" | "created_at" | "updated_at">> {}
}

// Type alias for convenience
export type UserInfoObjects = userInfo.Objects;
export type UserInfoObjectsInsert = userInfo.ObjectsInsert;
export type UserInfoObjectsUpdate = userInfo.ObjectsUpdate;
