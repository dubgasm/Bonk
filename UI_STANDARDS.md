# UI/UX Standards for Bonk!

**All agents must follow these standards when implementing or modifying UI components.**

## Golden Reference: Import Folder / Library Screen

The Import Folder (main library) screen represents the gold standard for UI/UX in Bonk. All other screens should match this quality level.

## Layout Standards

### Three-Column Grid Pattern
Use a clean 3-column CSS Grid layout:
```css
grid-template-columns: [sidebar-width] minmax(0, 1fr) [detail-width];
```

**Example:**
- Left: 220px (folder tree)
- Center: flexible (track table)
- Right: 280px (details/tagging)

**Key principles:**
- Use `minmax(0, 1fr)` for center to prevent overflow
- Fixed pixel widths for sidebars
- 12px gap between columns
- All columns same height with individual scroll

### Collapsible Sidebars

**Both left and right sidebars MUST be collapsible:**

```typescript
const [leftSidebarVisible, setLeftSidebarVisible] = useState(true);
const [rightSidebarVisible, setRightSidebarVisible] = useState(true);
```

**Grid adjusts dynamically:**
```typescript
const gridColumns = `${leftSidebarVisible ? '220px' : '0px'} minmax(0, 1fr) ${rightSidebarVisible ? '280px' : '0px'}`;
```

**Keyboard shortcuts (REQUIRED):**
- `Cmd/Ctrl + [` - Toggle left sidebar
- `Cmd/Ctrl + ]` - Toggle right sidebar
- `Cmd/Ctrl + \` - Toggle both sidebars

**Visual indicators:**
- Show toggle button when sidebar hidden
- Smooth 0.3s ease transitions
- Collapse icon (◀/▶) on edge when hidden

## Track Table Standards

### Column Layout

**Minimum required columns:**
1. Artwork (32-36px square)
2. Title (flexible, min 140px)
3. Artist (flexible, min 120px)
4. Album (flexible, min 120px)
5. Genre (min 80px)
6. Rating (fixed 100px for 5 stars)
7. Key (min 50px)

**CSS Grid example:**
```css
grid-template-columns: 36px minmax(140px, 2fr) minmax(120px, 1.5fr) minmax(120px, 1.5fr) minmax(80px, 1fr) 100px minmax(50px, 0.6fr);
column-gap: 12px;
```

### Row Styling

**Dimensions:**
- Row height: auto (6px padding top/bottom)
- Row padding: `6px 12px`
- Border radius: `6px`

**States:**
- Default: transparent background
- Hover: `rgba(255, 255, 255, 0.04)`
- Active/Selected: `rgba(0, 200, 255, 0.12)` (blue tint)
- Transition: `all 0.15s ease`

**Typography:**
- Title: 13px, font-weight 500
- Artist/Album: 12px, secondary color
- Genre: 11px, muted color
- Key: 11px, font-weight 600, badge style

### Artwork Thumbnails

```css
.artwork {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
  object-fit: cover;
}
```

**Loading strategy:**
- Lazy load with intersection observer
- LRU cache (100 entries max)
- Show music icon (♪) as placeholder
- Fade-in animation when loaded

### Scrolling Performance

**Virtual scrolling for lists > 100 items:**
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: tracks.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48, // row height
  overscan: 5,
});
```

**CSS optimizations:**
```css
overflow-y: auto;
-webkit-overflow-scrolling: touch;
will-change: transform;
contain: layout style paint;
```

**Scrollbar styling:**
```css
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
```

## Animation Standards

### Entrance Animations

**Sidebar panel:**
```css
animation: fadeIn 0.3s ease-out;

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateX(10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

**Staggered content:**
```css
.section-1 { animation-delay: 0.05s; }
.section-2 { animation-delay: 0.1s; }
.section-3 { animation-delay: 0.15s; }
```

### Interaction Animations

**Buttons and pills:**
```css
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
will-change: transform, background-color, border-color;
```

**Hover states:**
```css
:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
```

**Active states:**
```css
:active {
  transform: scale(0.98);
}
```

### Expand/Collapse Animations

```css
@keyframes expandIn {
  from {
    opacity: 0;
    max-height: 0;
    transform: scaleY(0.9);
  }
  to {
    opacity: 1;
    max-height: 500px;
    transform: scaleY(1);
  }
}
```

## Component Standards

### Headers

**Table headers:**
```css
font-size: 11px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.3px;
color: var(--text-secondary);
padding: 6px 12px;
border-bottom: 1px solid rgba(255, 255, 255, 0.08);
```

### Section Headers

```css
font-size: 10px;
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.8px;
color: #888;
margin-bottom: 10px;
```

### Input Fields

**Text inputs:**
```css
padding: 10px 12px;
border-radius: 6px;
border: 1px solid rgba(255, 255, 255, 0.1);
background: rgba(255, 255, 255, 0.04);
font-size: 12px;
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

**Focus state:**
```css
:focus {
  outline: none;
  border-color: #e91e63;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 3px rgba(233, 30, 99, 0.2);
  transform: translateY(-1px);
}
```

### Pill Buttons (Mood Tags, etc.)

```css
padding: 7px 16px;
border-radius: 18px;
border: 1px solid rgba(255, 255, 255, 0.15);
background: rgba(255, 255, 255, 0.03);
font-size: 12px;
font-weight: 500;
cursor: pointer;
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
will-change: transform, background-color, border-color;
```

**Active state (pink OneTagger style):**
```css
.active {
  background: linear-gradient(135deg, #e91e63 0%, #d81b60 100%);
  border-color: #e91e63;
  color: white;
  font-weight: 600;
  box-shadow: 0 3px 12px rgba(233, 30, 99, 0.4);
}
```

## Performance Requirements

### Frame Rate
- UI interactions MUST maintain 60fps
- Use `will-change` sparingly for animated properties
- Prefer `transform` and `opacity` for animations
- Use `contain: layout style paint` for isolated components

### Memory Management
- Virtual scrolling for lists > 100 items
- Image lazy loading with intersection observer
- LRU cache for thumbnails (max 100 entries)
- Cleanup listeners and observers on unmount

### Rendering Optimization
```typescript
// Memoize expensive computations
const filteredTracks = useMemo(() => {
  return tracks.filter(matchesFilter);
}, [tracks, filterCriteria]);

// Memoize row components
const TrackRow = memo(({ track }) => {
  return <div>...</div>;
});

// Use stable callbacks
const handleClick = useCallback((id) => {
  // handler logic
}, [dependencies]);
```

## Responsive Behavior

### Minimum Widths
- Left sidebar: 180px minimum, 220px default
- Right sidebar: 260px minimum, 280px default
- Center panel: 400px minimum

### Sidebar Collapse Priorities
1. Below 1400px width: Hide right sidebar by default
2. Below 1000px width: Hide left sidebar by default
3. Below 800px width: Stack vertically (mobile layout)

## Accessibility

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Tab order follows visual flow
- Focus visible with clear outline
- Escape closes modals/dropdowns

### ARIA Labels
```tsx
<button aria-label="Toggle left sidebar" aria-pressed={visible}>
  {visible ? '◀' : '▶'}
</button>
```

### Color Contrast
- Text on background: minimum 4.5:1 ratio
- Interactive elements: minimum 3:1 ratio
- Use semantic colors for states (blue=active, red=error, green=success)

## State Persistence

### Save User Preferences
```typescript
// Save to localStorage
localStorage.setItem('quicktag-sidebar-left', JSON.stringify(leftVisible));
localStorage.setItem('quicktag-sidebar-right', JSON.stringify(rightVisible));

// Restore on mount
useEffect(() => {
  const saved = localStorage.getItem('quicktag-sidebar-left');
  if (saved) setLeftVisible(JSON.parse(saved));
}, []);
```

## Testing Checklist

Before considering any UI complete, verify:
- [ ] All columns visible without horizontal scroll
- [ ] Smooth 60fps scrolling with 1000+ items
- [ ] Sidebars collapse/expand smoothly
- [ ] Keyboard shortcuts work
- [ ] Animations don't stutter
- [ ] Focus states visible
- [ ] Works on 1080p and 4K displays
- [ ] No layout shift on data load
- [ ] Responsive to window resize
- [ ] Settings persist across sessions

## Don'ts

**Never:**
- ❌ Use `position: fixed` for sidebars (breaks layout flow)
- ❌ Animate `width` or `height` directly (use `transform: scaleX/Y`)
- ❌ Render all list items when > 100 (use virtual scrolling)
- ❌ Inline styles in JSX (use CSS classes)
- ❌ Block the main thread for > 16ms
- ❌ Create new objects in render loops
- ❌ Forget to cleanup event listeners
- ❌ Use `setTimeout` for animations (use CSS transitions/keyframes)

## Summary

**The Import Folder screen is the gold standard.** When implementing any new UI:
1. Study how Import Folder does it
2. Copy the layout patterns
3. Match the animation timing
4. Use the same spacing/typography
5. Implement collapsible sidebars with shortcuts
6. Ensure smooth scrolling performance

**Consistency is key.** Users should feel the same level of polish across all screens.
