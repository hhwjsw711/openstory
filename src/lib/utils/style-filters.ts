import type { Style } from '@/types/database';

export type FilterOptions = {
  category: string;
  searchQuery: string;
};

/**
 * Filters a list of styles based on category and search query.
 * Pure function with no side effects - can be used in any context.
 *
 * @param styles - Array of Style objects to filter
 * @param category - Category ID to filter by ('all' for no category filter, 'new' for recent styles)
 * @param searchQuery - Search string to match against name, description, category, and tags
 * @returns Filtered array of styles
 */
export function filterStyles(
  styles: Style[],
  category: string,
  searchQuery: string
): Style[] {
  let filtered = styles;

  // Filter by category
  if (category !== 'all') {
    filtered = filtered.filter((style) => {
      if (category === 'new') {
        // Show styles created within the last 7 days
        const daysSinceCreation =
          (Date.now() - new Date(style.createdAt).getTime()) /
          (1000 * 60 * 60 * 24);
        return daysSinceCreation <= 7;
      }
      return style.category === category;
    });
  }

  // Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter((style) => {
      const nameMatch = style.name.toLowerCase().includes(query);
      const descMatch = style.description?.toLowerCase().includes(query);
      const categoryMatch = style.category?.toLowerCase().includes(query);
      const tagsMatch = style.tags?.some((tag: string) =>
        tag.toLowerCase().includes(query)
      );

      return nameMatch || descMatch || categoryMatch || tagsMatch;
    });
  }

  return filtered;
}
