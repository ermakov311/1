'use client'

import React from 'react';
import { Position, Wire as WireType } from '@/components/scheme/types/schema';

interface WireProps {
  wire: WireType & { points: Position[] };
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const Wire: React.FC<WireProps> = ({ wire, isSelected, onClick, onContextMenu }) => {
  if (!wire.points || wire.points.length < 2) return null;

  return (
    <line
      x1={wire.points[0].x}
      y1={wire.points[0].y}
      x2={wire.points[1].x}
      y2={wire.points[1].y}
      stroke="var(--text-color)"
      strokeWidth={isSelected ? 3 : wire.width || 2}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{ cursor: 'pointer', pointerEvents: 'all' }}
    />
  );
};