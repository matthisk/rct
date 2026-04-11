export const enum AttractionType {
  Carousel = 0,
}

export interface PlacedAttraction {
  type: AttractionType;
  /** Center column of the attraction footprint. */
  col: number;
  /** Center row of the attraction footprint. */
  row: number;
}

export interface AttractionDef {
  name: string;
  /** Side length of the square footprint (e.g. 3 for a 3×3 grid). */
  size: number;
}

export const ATTRACTION_DEFS: Record<AttractionType, AttractionDef> = {
  [AttractionType.Carousel]: { name: 'Carousel', size: 3 },
};
