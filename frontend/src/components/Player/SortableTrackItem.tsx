import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableTrackItemProps {
  id: string;
  index: number;
  isDragEnabled: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const SortableTrackItem: React.FC<SortableTrackItemProps> = ({ id, isDragEnabled, children, style }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isDragEnabled });

  const combinedStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform) ? `${style?.transform || ''} ${CSS.Transform.toString(transform)}` : style?.transform,
    transition: transition || style?.transition,
    zIndex: isDragging ? 50 : style?.zIndex,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={combinedStyle} className="relative group">
      {isDragEnabled && (
        <div
          {...attributes}
          {...listeners}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-500 cursor-grab active:cursor-grabbing z-10 touch-none"
        >
          <GripVertical size={20} />
        </div>
      )}
      {children}
    </div>
  );
};
