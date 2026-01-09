/**
 * Frame Locations Schema
 * Junction table linking frames to sequence locations (which location is in each frame)
 */

import {
  type InferInsertModel,
  type InferSelectModel,
  relations,
} from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';
import { frames } from './frames';
import { locationSheets } from './location-sheets';
import { sequenceLocations } from './sequence-locations';

/**
 * Frame Locations junction table
 * Tracks which location appears in which frames, and optionally
 * which specific location sheet (variation) was used
 */
export const frameLocations = sqliteTable(
  'frame_locations',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    frameId: text('frame_id')
      .notNull()
      .references(() => frames.id, { onDelete: 'cascade' }),
    locationId: text('location_id')
      .notNull()
      .references(() => sequenceLocations.id, { onDelete: 'cascade' }),
    // Optional: specific variation used for this frame
    locationSheetId: text('location_sheet_id').references(
      () => locationSheets.id,
      { onDelete: 'set null' }
    ),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_frame_locations_frame_id').on(table.frameId),
    index('idx_frame_locations_location_id').on(table.locationId),
    // Each location can only appear once per frame (typically frames have one location anyway)
    uniqueIndex('frame_locations_frame_location_key').on(
      table.frameId,
      table.locationId
    ),
  ]
);

// Relations
export const frameLocationsRelations = relations(frameLocations, ({ one }) => ({
  frame: one(frames, {
    fields: [frameLocations.frameId],
    references: [frames.id],
  }),
  location: one(sequenceLocations, {
    fields: [frameLocations.locationId],
    references: [sequenceLocations.id],
  }),
  locationSheet: one(locationSheets, {
    fields: [frameLocations.locationSheetId],
    references: [locationSheets.id],
  }),
}));

// Type exports
export type FrameLocation = InferSelectModel<typeof frameLocations>;
export type NewFrameLocation = InferInsertModel<typeof frameLocations>;

// Composite types for API responses
export type FrameLocationWithDetails = FrameLocation & {
  location: {
    id: string;
    name: string;
    locationId: string;
    referenceImageUrl: string | null;
  };
  locationSheet: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
};
