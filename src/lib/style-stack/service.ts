import {
  type ApplyStyleToFramesInput,
  ApplyStyleToFramesSchema,
  type CreateStyleAdaptationInput,
  CreateStyleAdaptationSchema,
  type CreateStyleInput,
  CreateStyleSchema,
  type DuplicateStyleInput,
  DuplicateStyleSchema,
  type ExportStyleInput,
  ExportStyleSchema,
  type GetStyleByIdInput,
  GetStyleByIdSchema,
  type GetTeamStylesInput,
  GetTeamStylesSchema,
  type ImportStyleInput,
  ImportStyleSchema,
  type StyleStackConfig,
  type UpdateStyleInput,
  UpdateStyleSchema,
} from '@/lib/schemas/style-stack';
import { db } from '@/lib/db/client';
import {
  styles,
  styleAdaptations,
  teamMembers,
  frames,
  sequences,
  type Style,
  type NewStyle,
  type StyleAdaptation,
  type NewStyleAdaptation,
} from '@/lib/db/schema';
import { eq, and, desc, sql, or, ilike } from 'drizzle-orm';

export interface StyleWithAdaptations extends Style {
  adaptations?: StyleAdaptation[];
}

export interface PaginatedStyles {
  data: Style[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export class StyleStackService {
  /**
   * Create a new style for a team
   */
  async createStyle(input: CreateStyleInput, userId: string): Promise<Style> {
    const validatedInput = CreateStyleSchema.parse(input);

    if (!userId) {
      throw new Error('User ID is required to create a style');
    }

    // Get user's default team (for now, using first team they're a member of)
    const [teamMember] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1);

    if (!teamMember) {
      throw new Error('No team found for user');
    }

    const teamId = teamMember.teamId;

    const styleData: NewStyle = {
      teamId: teamId,
      name: validatedInput.name,
      description: validatedInput.description || null,
      config: validatedInput.config,
      category: validatedInput.category || null,
      tags: validatedInput.tags,
      isPublic: validatedInput.is_public,
      isTemplate: false, // Only admins can create templates
      previewUrl: validatedInput.preview_url || null,
      createdBy: userId,
    };

    const [data] = await db.insert(styles).values(styleData).returning();

    if (!data) {
      throw new Error('Failed to create style: No data returned');
    }

    return data;
  }

  /**
   * Get styles for a team with filtering and pagination
   */
  async getTeamStyles(input: GetTeamStylesInput): Promise<PaginatedStyles> {
    const validatedInput = GetTeamStylesSchema.parse(input);

    // Build where conditions
    const conditions = [eq(styles.teamId, validatedInput.team_id)];

    // Apply filters
    if (validatedInput.category) {
      conditions.push(eq(styles.category, validatedInput.category));
    }

    if (validatedInput.tags && validatedInput.tags.length > 0) {
      // Check if all specified tags are present in the tags array
      for (const tag of validatedInput.tags) {
        conditions.push(sql`${styles.tags} @> ARRAY[${tag}]::text[]`);
      }
    }

    if (validatedInput.is_public !== undefined) {
      conditions.push(eq(styles.isPublic, validatedInput.is_public));
    }

    if (validatedInput.is_template !== undefined) {
      conditions.push(eq(styles.isTemplate, validatedInput.is_template));
    }

    // Search condition
    const whereClause = validatedInput.search
      ? and(
          ...conditions,
          or(
            ilike(styles.name, `%${validatedInput.search}%`),
            ilike(styles.description, `%${validatedInput.search}%`)
          )
        )
      : and(...conditions);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(styles)
      .where(whereClause);

    const total = countResult?.count || 0;

    // Get paginated data
    const data = await db
      .select()
      .from(styles)
      .where(whereClause)
      .orderBy(desc(styles.usageCount), desc(styles.createdAt))
      .limit(validatedInput.limit)
      .offset(validatedInput.offset);

    const page = Math.floor(validatedInput.offset / validatedInput.limit) + 1;
    const hasMore = validatedInput.offset + validatedInput.limit < total;

    return {
      data,
      total,
      page,
      limit: validatedInput.limit,
      hasMore,
    };
  }

  /**
   * Get a style by ID with optional adaptations
   */
  async getStyleById(
    input: GetStyleByIdInput
  ): Promise<StyleWithAdaptations | null> {
    const validatedInput = GetStyleByIdSchema.parse(input);

    const [style] = await db
      .select()
      .from(styles)
      .where(eq(styles.id, validatedInput.id));

    if (!style) {
      return null;
    }

    // Get adaptations if requested
    let adaptationsList: StyleAdaptation[] | undefined;
    if (validatedInput.include_adaptations) {
      adaptationsList = await db
        .select()
        .from(styleAdaptations)
        .where(eq(styleAdaptations.styleId, validatedInput.id));
    }

    return {
      ...style,
      ...(adaptationsList && { adaptations: adaptationsList }),
    };
  }

  /**
   * Update an existing style
   */
  async updateStyle(input: UpdateStyleInput, userId: string): Promise<Style> {
    const validatedInput = UpdateStyleSchema.parse(input);

    // Verify user has permission to update this style
    const existingStyle = await this.getStyleById({
      id: validatedInput.id,
      include_adaptations: false,
    });
    if (!existingStyle) {
      throw new Error('Style not found');
    }

    // Check if user is member of the team that owns this style
    const [teamMember] = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, existingStyle.teamId),
          eq(teamMembers.userId, userId)
        )
      );

    if (!teamMember) {
      throw new Error('Unauthorized: Not a member of the owning team');
    }

    const updateData: Partial<NewStyle> = {
      updatedAt: new Date(),
    };

    if (validatedInput.name !== undefined)
      updateData.name = validatedInput.name;
    if (validatedInput.description !== undefined)
      updateData.description = validatedInput.description;
    if (validatedInput.config !== undefined)
      updateData.config = validatedInput.config;
    if (validatedInput.category !== undefined)
      updateData.category = validatedInput.category;
    if (validatedInput.tags !== undefined)
      updateData.tags = validatedInput.tags;
    if (validatedInput.is_public !== undefined)
      updateData.isPublic = validatedInput.is_public;
    if (validatedInput.preview_url !== undefined)
      updateData.previewUrl = validatedInput.preview_url;

    const [data] = await db
      .update(styles)
      .set(updateData)
      .where(eq(styles.id, validatedInput.id))
      .returning();

    if (!data) {
      throw new Error('Failed to update style: No data returned');
    }

    return data;
  }

  /**
   * Delete a style
   */
  async deleteStyle(styleId: string, userId: string): Promise<void> {
    // Verify user has permission to delete this style
    const existingStyle = await this.getStyleById({
      id: styleId,
      include_adaptations: false,
    });
    if (!existingStyle) {
      throw new Error('Style not found');
    }

    // Check if user is member of the team that owns this style
    const [teamMember] = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, existingStyle.teamId),
          eq(teamMembers.userId, userId)
        )
      );

    if (!teamMember) {
      throw new Error('Unauthorized: Not a member of the owning team');
    }

    // Don't allow deletion of templates
    if (existingStyle.isTemplate) {
      throw new Error('Cannot delete template styles');
    }

    await db.delete(styles).where(eq(styles.id, styleId));
  }

  /**
   * Duplicate an existing style
   */
  async duplicateStyle(
    input: DuplicateStyleInput,
    userId: string
  ): Promise<Style> {
    const validatedInput = DuplicateStyleSchema.parse(input);

    // Get the original style
    const originalStyle = await this.getStyleById({
      id: validatedInput.id,
      include_adaptations: true,
    });

    if (!originalStyle) {
      throw new Error('Original style not found');
    }

    // Check if style is public or user has access
    let canDuplicate = originalStyle.isPublic;

    if (!canDuplicate) {
      const [teamMember] = await db
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, originalStyle.teamId),
            eq(teamMembers.userId, userId)
          )
        );

      canDuplicate = !!teamMember;
    }

    if (!canDuplicate) {
      throw new Error('Unauthorized: Cannot duplicate private style');
    }

    // Get user's team
    const [userTeamMember] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1);

    if (!userTeamMember) {
      throw new Error('No team found for user');
    }

    // Create duplicate
    const duplicateData: NewStyle = {
      teamId: userTeamMember.teamId,
      name: validatedInput.name,
      description: validatedInput.description || originalStyle.description,
      config: originalStyle.config,
      category: originalStyle.category,
      tags: originalStyle.tags || [],
      isPublic: false, // Duplicates are private by default
      isTemplate: false,
      parentId: originalStyle.id,
      previewUrl: originalStyle.previewUrl,
      createdBy: userId,
    };

    const [data] = await db.insert(styles).values(duplicateData).returning();

    if (!data) {
      throw new Error('Failed to duplicate style: No data returned');
    }

    // Copy adaptations if they exist
    if (originalStyle.adaptations && originalStyle.adaptations.length > 0) {
      const adaptations: NewStyleAdaptation[] = originalStyle.adaptations.map(
        (adaptation) => ({
          styleId: data.id,
          modelProvider: adaptation.modelProvider,
          modelName: adaptation.modelName,
          adaptedConfig: adaptation.adaptedConfig,
        })
      );

      try {
        await db.insert(styleAdaptations).values(adaptations);
      } catch (error) {
        console.warn(
          `Failed to copy adaptations: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return data;
  }

  /**
   * Create a style adaptation for a specific model
   */
  async createStyleAdaptation(
    input: CreateStyleAdaptationInput
  ): Promise<void> {
    const validatedInput = CreateStyleAdaptationSchema.parse(input);

    // Verify style exists
    const style = await this.getStyleById({
      id: validatedInput.style_id,
      include_adaptations: false,
    });
    if (!style) {
      throw new Error('Style not found');
    }

    const adaptationData: NewStyleAdaptation = {
      styleId: validatedInput.style_id,
      modelProvider: validatedInput.model_provider,
      modelName: validatedInput.model_name,
      adaptedConfig: validatedInput.adapted_config,
    };

    await db.insert(styleAdaptations).values(adaptationData);
  }

  /**
   * Apply style to frames
   */
  async applyStyleToFrames(
    input: ApplyStyleToFramesInput,
    userId: string
  ): Promise<void> {
    const validatedInput = ApplyStyleToFramesSchema.parse(input);

    // Verify style exists and user has access
    const style = await this.getStyleById({
      id: validatedInput.style_id,
      include_adaptations: true,
    });

    if (!style) {
      throw new Error('Style not found');
    }

    // Check if style is public or user has access
    let hasAccess = style.isPublic;

    if (!hasAccess) {
      const [teamMember] = await db
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, style.teamId),
            eq(teamMembers.userId, userId)
          )
        );

      hasAccess = !!teamMember;
    }

    if (!hasAccess) {
      throw new Error('Unauthorized: Cannot apply private style');
    }

    // Verify user has access to all frames
    const framesList = await db
      .select({
        id: frames.id,
        sequenceId: frames.sequenceId,
      })
      .from(frames)
      .where(sql`${frames.id} = ANY(${validatedInput.frame_ids}::uuid[])`);

    if (framesList.length !== validatedInput.frame_ids.length) {
      throw new Error('Some frames not found');
    }

    // Check user has access to all sequences containing these frames
    const sequenceIds = [...new Set(framesList.map((f) => f.sequenceId))];
    for (const sequenceId of sequenceIds) {
      const [sequence] = await db
        .select({ teamId: sequences.teamId })
        .from(sequences)
        .where(eq(sequences.id, sequenceId));

      if (!sequence) {
        throw new Error('Sequence not found');
      }

      const [teamMember] = await db
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, sequence.teamId),
            eq(teamMembers.userId, userId)
          )
        );

      if (!teamMember) {
        throw new Error('Unauthorized: No access to sequence');
      }
    }

    // Update each frame
    for (const frameId of validatedInput.frame_ids) {
      const [currentFrame] = await db
        .select({ metadata: frames.metadata })
        .from(frames)
        .where(eq(frames.id, frameId));

      if (!currentFrame) {
        throw new Error(`Failed to get frame ${frameId}`);
      }

      // Note: frame.metadata is now strictly typed as Scene from script analysis
      // Style application metadata should be tracked separately if needed
      // For now, we skip metadata updates to maintain type safety
      // TODO: Consider adding a separate style_application_metadata column if needed

      // Just update the frame's updated timestamp to indicate processing
      await db
        .update(frames)
        .set({ updatedAt: new Date() })
        .where(eq(frames.id, frameId));
    }
  }

  /**
   * Get default style templates
   */
  async getDefaultTemplates(): Promise<Style[]> {
    return await db
      .select()
      .from(styles)
      .where(and(eq(styles.isTemplate, true), eq(styles.isPublic, true)))
      .orderBy(desc(styles.usageCount), styles.name);
  }

  /**
   * Import a style from external data
   */
  async importStyle(input: ImportStyleInput, userId: string): Promise<Style> {
    const validatedInput = ImportStyleSchema.parse(input);

    // Get user's team
    const [userTeamMember] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1);

    if (!userTeamMember) {
      throw new Error('No team found for user');
    }

    // Create the imported style
    const styleData: NewStyle = {
      teamId: userTeamMember.teamId,
      name: validatedInput.name || validatedInput.style_data.name,
      description: `Imported style: ${validatedInput.style_data.name}`,
      config: validatedInput.style_data,
      category: validatedInput.category || null,
      tags: validatedInput.tags,
      isPublic: false, // Imported styles are private by default
      isTemplate: false,
      createdBy: userId,
    };

    const [data] = await db.insert(styles).values(styleData).returning();

    if (!data) {
      throw new Error('Failed to import style: No data returned');
    }

    return data;
  }

  /**
   * Export a style to external format
   */
  async exportStyle(
    input: ExportStyleInput,
    userId: string
  ): Promise<{
    style: StyleStackConfig;
    metadata: {
      exported_at: string;
      exported_by: string;
      original_id: string;
      version: string;
    };
    adaptations?: Record<string, Record<string, unknown>>;
  }> {
    const validatedInput = ExportStyleSchema.parse(input);

    // Get style with optional adaptations
    const style = await this.getStyleById({
      id: validatedInput.id,
      include_adaptations: validatedInput.include_adaptations,
    });

    if (!style) {
      throw new Error('Style not found');
    }

    // Check access permissions
    let hasAccess = style.isPublic;

    if (!hasAccess) {
      const [teamMember] = await db
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, style.teamId),
            eq(teamMembers.userId, userId)
          )
        );

      hasAccess = !!teamMember;
    }

    if (!hasAccess) {
      throw new Error('Unauthorized: Cannot export private style');
    }

    const exportData: {
      style: StyleStackConfig;
      metadata: {
        exported_at: string;
        exported_by: string;
        original_id: string;
        version: string;
      };
      adaptations?: Record<string, Record<string, unknown>>;
    } = {
      style: style.config as StyleStackConfig,
      metadata: {
        exported_at: new Date().toISOString(),
        exported_by: userId,
        original_id: style.id,
        version: style.version?.toString() || '1',
      },
    };

    // Include adaptations if requested and available
    if (validatedInput.include_adaptations && style.adaptations) {
      exportData.adaptations = {};
      for (const adaptation of style.adaptations) {
        const key = `${adaptation.modelProvider}:${adaptation.modelName}`;
        exportData.adaptations[key] = adaptation.adaptedConfig as Record<
          string,
          unknown
        >;
      }
    }

    return exportData;
  }
}
