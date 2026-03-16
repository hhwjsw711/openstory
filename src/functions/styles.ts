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
import { createScopedDb } from '@/lib/db/scoped';
import { requireTeamAdminAccess } from '@/lib/auth/action-utils';

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
    // Public styles don't require team context, use a temporary scopedDb
    const scopedDb = createScopedDb('__public__');
    return scopedDb.styles.getPublic();
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
    // Style lookup doesn't require team scoping (styles can be public)
    const scopedDb = createScopedDb('__lookup__');
    const style = await scopedDb.styles.getById(data.styleId);

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
    // Style lookup without team scoping (need to discover the team first)
    const lookupDb = createScopedDb('__lookup__');
    const style = await lookupDb.styles.getById(data.styleId);

    if (!style) {
      throw new Error('Style not found');
    }

    await requireTeamAdminAccess(context.user.id, style.teamId);

    const scopedDb = createScopedDb(style.teamId);
    await scopedDb.styles.delete(data.styleId);

    return { success: true };
  });
