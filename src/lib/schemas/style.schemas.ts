import { styles } from '@/lib/db/schema';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Shared Zod schemas for style operations
 */

export const createStyleSchema = createInsertSchema(styles);
export const updateStyleSchema = createUpdateSchema(styles);

type CreateStyleInput = z.infer<typeof createStyleSchema>;
type UpdateStyleInput = z.infer<typeof updateStyleSchema>;
