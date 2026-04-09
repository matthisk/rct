/**
 * Path surface types.
 *
 * A path is an independent overlay on top of a terrain tile.  Paths are
 * stored separately from TileType so a grass tile can simultaneously hold
 * a tree sprite AND a path surface in the future, or be completely bare.
 *
 * Adding a new path type:
 *   1. Add a member here (value must not be 0, which is reserved for None).
 *   2. Add a colour entry to PATH_COLORS in IsoRenderer.ts.
 *   3. Wire up a build tool in Game.ts.
 */
export const enum PathType {
  None     = 0,
  Concrete = 1,
}
