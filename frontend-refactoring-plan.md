# Frontend Refactoring Plan: Eliminate Inline Styles

## Executive Summary

After analyzing the entire frontend codebase, I've identified significant violations of the "Avoid adding styles on top of components" principle. The codebase has extensive inline Tailwind classes in views, direct SVG usage in JSX, and missing component abstractions.

## Priority Rankings

### Critical Priority (Most Inline Styling)
1. **app/sequences/page.tsx** - 15+ inline style instances, including raw SVG
2. **app/page.tsx** - 12+ inline style instances  
3. **components/sequence/storyboard-frame/storyboard-frame.tsx** - 10+ inline styles with template literals

### High Priority (Significant Styling Issues)
4. **components/sequence/style-selector/style-selector.tsx** - 8+ inline styles, raw SVG, style prop usage
5. **components/sequence/generation-section/generation-section.tsx** - 7+ inline styles, inline spinner animation
6. **app/sequences/new/page.tsx** - 6+ inline styles

### Medium Priority (Moderate Issues)
7. **components/sequence/progress-section/progress-section.tsx** - 5+ inline styles, style prop for width
8. **components/sequence/script-section/script-section.tsx** - 4+ inline styles
9. **components/sequence/style-section/style-section.tsx** - 4+ inline styles
10. **components/sequence/script-editor/script-editor.tsx** - 3+ inline styles

### Low Priority (Minor Issues)
11. **app/layout.tsx** - 2 inline styles

## Common Patterns Identified

### 1. Container Patterns
- `container mx-auto px-4 py-8` - Used in 3+ views
- `max-w-[size] mx-auto` - Used in 4+ views
- `space-y-[size]` - Used in nearly every component

### 2. Typography Patterns
- `text-3xl font-bold tracking-tight` - Heading style
- `text-muted-foreground` - Secondary text
- `text-sm text-destructive` - Error messages

### 3. Layout Patterns
- `flex items-center justify-between` - Header layouts
- `grid grid-cols-[n] gap-[size]` - Grid layouts
- `flex flex-col gap-[size]` - Vertical stacks

### 4. Interactive Patterns
- Hover states with inline classes
- Focus states with ring utilities
- Disabled states with opacity

### 5. SVG Icons
- Video icon in sequences/page.tsx
- Image icon in style-selector.tsx
- Loading spinner in generation-section.tsx

## New Components to Create

### Layout Components
1. **PageContainer** - Standardized page wrapper
   - Variants: `default`, `narrow`, `wide`
   - Props: `children`, `variant`

2. **PageHeader** - Page title and description
   - Props: `title`, `description`, `action?`

3. **SectionContainer** - Section wrapper with spacing
   - Variants: `default`, `compact`, `spacious`

4. **ContentStack** - Vertical content stack
   - Variants: `small`, `medium`, `large` (gap sizes)

### Typography Components
5. **Heading** - Consistent headings
   - Variants: `h1`, `h2`, `h3`
   - Props: `children`, `variant`

6. **Text** - Body text component
   - Variants: `default`, `muted`, `error`
   - Props: `children`, `variant`

### Feedback Components
7. **ErrorMessage** - Error display component
   - Props: `message`, `show?`

8. **EmptyState** - Empty state pattern
   - Props: `icon`, `title`, `description`, `action?`

9. **LoadingSpinner** - Reusable spinner
   - Variants: `small`, `medium`, `large`

### Icon Components
10. **VideoIcon** - Video/camera icon
11. **ImageIcon** - Image/photo icon
12. **PlusIcon** - Plus/add icon

### Specialized Components
13. **ProgressBar** - Progress indicator
    - Props: `value`, `max`, `label?`

14. **ColorSwatch** - Color palette display
    - Props: `colors`, `maxDisplay?`

15. **FrameCard** - Storyboard frame wrapper
    - Props: `selected`, `dragging`, `disabled`

## Existing Components Needing Variants

### Button Component
- Add size variants if not present: `small`, `medium`, `large`
- Ensure consistent usage across views

### Card Component
- Add interactive variant for clickable cards
- Add selected state variant

## Specific Refactoring Tasks

### Task 1: Create Core Layout Components
```
Priority: Critical
Components: PageContainer, PageHeader, SectionContainer, ContentStack
Files affected: All views
Estimated effort: 2 hours
```

### Task 2: Refactor app/page.tsx (HomePage)
```
Priority: Critical
Actions:
- Replace container classes with PageContainer
- Use PageHeader component
- Extract feature grid into FeatureGrid component
- Use ContentStack for spacing
- Replace all inline typography with Heading/Text components
Estimated effort: 1 hour
```

### Task 3: Refactor app/sequences/page.tsx
```
Priority: Critical
Actions:
- Extract SVG to VideoIcon component
- Use EmptyState component
- Replace container classes with PageContainer
- Use PageHeader with action slot
- Remove all inline Tailwind classes
Estimated effort: 1.5 hours
```

### Task 4: Refactor storyboard-frame component
```
Priority: Critical
Actions:
- Extract frame wrapper styles to FrameCard component
- Remove template literal classes
- Create OrderBadge component for frame numbering
- Create FrameActions overlay component
- Remove all inline styles
Estimated effort: 2 hours
```

### Task 5: Create Icon Component Library
```
Priority: High
Actions:
- Create VideoIcon component
- Create ImageIcon component
- Create standard icon wrapper with consistent sizing
- Replace all inline SVGs across codebase
Estimated effort: 1 hour
```

### Task 6: Refactor style-selector component
```
Priority: High
Actions:
- Extract EmptyState pattern
- Create ColorSwatch component
- Remove style prop usage for colors
- Extract loading skeleton pattern
- Remove all grid/layout inline classes
Estimated effort: 1.5 hours
```

### Task 7: Refactor generation-section component
```
Priority: High
Actions:
- Extract LoadingSpinner component
- Create ValidationMessage component
- Use ErrorMessage component
- Remove all inline Tailwind classes
Estimated effort: 1 hour
```

### Task 8: Create Typography System
```
Priority: Medium
Actions:
- Create Heading component with h1-h6 variants
- Create Text component with style variants
- Create Label component
- Update all views to use typography components
Estimated effort: 2 hours
```

### Task 9: Refactor progress-section component
```
Priority: Medium
Actions:
- Create ProgressBar component
- Remove style prop for width (use CSS variables)
- Extract progress label pattern
Estimated effort: 0.5 hours
```

### Task 10: Update remaining components
```
Priority: Low
Actions:
- Update script-section to use new components
- Update style-section to use new components
- Update script-editor to use new components
- Update layout.tsx
Estimated effort: 1 hour
```

## Implementation Strategy

### Phase 1: Foundation (Tasks 1, 5, 8)
Create the core reusable components that will be used across all refactoring efforts.

### Phase 2: Critical Views (Tasks 2, 3, 4)
Refactor the views with the most inline styling violations.

### Phase 3: Component Library (Tasks 6, 7, 9)
Refactor existing components to remove inline styles.

### Phase 4: Cleanup (Task 10)
Final cleanup of remaining components.

## Success Metrics

- Zero inline Tailwind classes in views
- All SVGs extracted to dedicated components
- No style props used anywhere
- All styling encapsulated within components
- Component variants instead of size/style props
- Consistent theming throughout

## Notes for Frontend Engineers

1. **Use cn() utility** - For conditional classes within components
2. **Theme tokens only** - Use CSS variables from theme, not hard-coded values
3. **Flexbox everywhere** - Default to flexbox layouts with gap
4. **No margins** - Use gap in flex/grid parents instead
5. **Component first** - Always create a component rather than styling in views
6. **Variants over props** - Create variants (small/medium/large) instead of numeric props

## File Naming Convention

All new component files should use kebab-case:
- `/components/layout/page-container.tsx`
- `/components/typography/heading.tsx`
- `/components/icons/video-icon.tsx`
- `/components/feedback/empty-state.tsx`

## Total Estimated Effort

- Foundation work: 5 hours
- Critical refactoring: 4.5 hours
- Component updates: 4 hours
- Testing and review: 2 hours
- **Total: ~15.5 hours**

## Next Steps

1. Review and approve this plan
2. Create foundation components first
3. Assign specific tasks to frontend-react-engineer agents
4. Implement in phases as outlined
5. Review each phase before proceeding to next