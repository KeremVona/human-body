/** Metadata recorded for a single Blender object during inventory. */
export type InventoryObject = {
  name: string;
  type: string;
  collections: string[];
  vertices: number;
  hasUV: boolean;
};

/** Output written by `inventory.py` describing the source `.blend` contents. */
export type Inventory = {
  blenderVersion: string;
  sourceFile: string;
  objects: InventoryObject[];
};
