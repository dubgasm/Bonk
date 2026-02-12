import React from 'react';
import { useColumnStore } from '../store/useColumnStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowUp, ArrowDown } from 'lucide-react';

interface HeaderCellProps {
  id: string;
  label: string;
  width: string;
  resizable: boolean;
  minWidth?: number;
  maxWidth?: number;
  onResize: (id: string, newWidth: string) => void;
  onSort: (id: string) => void;
  sortDirection: 'asc' | 'desc' | null;
}

function SortableHeaderCell({ id, label, width, resizable, minWidth, maxWidth, onResize, onSort, sortDirection }: HeaderCellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: width, // This might need to be applied to the parent grid or handled differently if using CSS grid
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    height: '100%',
    backgroundColor: isDragging ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
    cursor: 'default',
    overflow: 'hidden',
    userSelect: 'none',
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startWidth = (e.target as HTMLElement).parentElement?.offsetWidth || 0;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newWidthPx = startWidth + deltaX;
      
      if (minWidth) newWidthPx = Math.max(minWidth, newWidthPx);
      if (maxWidth) newWidthPx = Math.min(maxWidth, newWidthPx);
      
      onResize(id, `${newWidthPx}px`);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  return (
    <div ref={setNodeRef} style={style} className="header-cell">
      <div 
        {...attributes} 
        {...listeners} 
        className="drag-handle"
        style={{ cursor: 'grab', marginRight: '4px', opacity: 0.3 }}
      >
        <GripVertical size={12} />
      </div>
      
      <div 
        className="header-content" 
        onClick={() => onSort(id)}
        style={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden', cursor: 'pointer' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {sortDirection && (
          <span style={{ marginLeft: '4px', display: 'flex', alignItems: 'center' }}>
            {sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          </span>
        )}
      </div>

      {resizable && (
        <div
          className="resize-handle"
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '4px',
            cursor: 'col-resize',
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
}

export default function TrackTableHeader() {
  const { columns, columnOrder, setColumnOrder, setColumnWidth, fontSize } = useColumnStore();
  const { sortState, setSort } = useLibraryStore();
  
  // Filter visible columns based on order
  const visibleColumns = columnOrder
    .map(id => columns.find(c => c.id === id))
    .filter((c): c is typeof columns[0] => !!c && c.visible);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      const oldIndex = columnOrder.indexOf(active.id as string);
      const newIndex = columnOrder.indexOf(over?.id as string);
      
      setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
    }
  };

  const handleSort = (id: string) => {
    if (id === 'checkbox' || id === 'art' || id === 'waveform') return; // Disable sorting for non-data columns
    
    let direction: 'asc' | 'desc' = 'asc';
    if (sortState?.column === id && sortState.direction === 'asc') {
      direction = 'desc';
    }
    setSort(id, direction);
  };

  const gridTemplate = visibleColumns.map(c => c.width).join(' ');

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter} 
      onDragEnd={handleDragEnd}
    >
      <div
        className="track-table-header"
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          alignItems: 'center',
          padding: '0 8px', // Match row padding
          boxSizing: 'border-box',
          borderBottom: '1px solid var(--border)',
          fontWeight: 600,
          fontSize: fontSize === 'small' ? '11px' : '12px',
          background: 'var(--bg-secondary)', // Distinct header background
          height: '32px', // Fixed header height
          userSelect: 'none'
        }}
      >
        <SortableContext 
          items={visibleColumns.map(c => c.id)} 
          strategy={horizontalListSortingStrategy}
        >
          {visibleColumns.map((col) => (
            <SortableHeaderCell
              key={col.id}
              id={col.id}
              label={col.label}
              width={col.width}
              resizable={col.resizable}
              minWidth={col.minWidth}
              maxWidth={col.maxWidth}
              onResize={setColumnWidth}
              onSort={handleSort}
              sortDirection={sortState?.column === col.id ? sortState.direction : null}
            />
          ))}
        </SortableContext>
      </div>
    </DndContext>
  );
}
