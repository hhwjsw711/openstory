/**
 * Style Server Functions
 * End-to-end type-safe functions for style library operations
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { authMiddleware, authWithTeamMiddleware } from './middleware';
import {
  createStyleSchema,
  updateStyleSchema,
} from '@/lib/schemas/style.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { getStyleById, getPublicStyles } from '@/lib/db/helpers/queries';
import { deleteStyle } from '@/lib/db/helpers/styles';
import { requireTeamManagement } from '@/lib/db/helpers/team-permissions';

// ============================================================================
// List Styles
// ============================================================================

/**
 * Get all styles accessible to the user (team + public)
 * @returns Array of styles
 */
export const getStylesFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .handler(async ({ context }) => {
    return context.scopedDb.styles.list();
  });

/**
 * Get public styles only (for unauthenticated users or fallback)
 * @returns Array of public styles
 */
export const getPublicStylesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    return getPublicStyles();
  });

// ============================================================================
// Get Single Style
// ============================================================================

const getStyleInputSchema = z.object({
  styleId: ulidSchema,
});

/**
 * Get a single style by ID
 * @returns The style
 */
export const getStyleFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(getStyleInputSchema))
  .handler(async ({ data }) => {
    const style = await getStyleById(data.styleId);

    if (!style) {
      throw new Error('Style not found');
    }

    return style;
  });

// ============================================================================
// Create Style
// ============================================================================

/**
 * Create a new style
 * @returns The created style
 */
export const createStyleFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(createStyleSchema))
  .handler(async ({ data, context }) => {
    return context.scopedDb.styles.create({
      name: data.name,
      description: data.description,
      config: data.config,
      category: data.category,
      tags: data.tags,
      isPublic: data.isPublic,
      previewUrl: data.previewUrl,
      createdBy: context.user.id,
    });
  });

// ============================================================================
// Update Style
// ============================================================================

const updateStyleInputSchema = updateStyleSchema.extend({
  styleId: ulidSchema,
});

/**
 * Update a style
 * @returns The updated style
 */
export const updateStyleFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(updateStyleInputSchema))
  .handler(async ({ data, context }) => {
    const { styleId, ...updateData } = data;

    const style = await context.scopedDb.styles.update(styleId, updateData);

    if (!style) {
      throw new Error(
        'Style not found or you do not have permission to update it'
      );
    }

    return style;
  });

// ============================================================================
// Delete Style
// ============================================================================

const deleteStyleInputSchema = z.object({
  styleId: ulidSchema,
});

/**
 * Delete a style (requires admin/owner role)
 */
export const deleteStyleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(deleteStyleInputSchema))
  .handler(async ({ data, context }) => {
    const style = await getStyleById(data.styleId);

    if (!style) {
      throw new Error('Style not found');
    }

    await requireTeamManagement(context.user.id, style.teamId);
    await deleteStyle(data.styleId, style.teamId);

    return { success: true };
  });
