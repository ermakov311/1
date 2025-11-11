import React, { useMemo } from 'react';
import { Position, Wire } from '@/components/scheme/types/schema';

type Props = {
  wire: Wire;
  isSelected?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent<SVGElement, MouseEvent>) => void;
};

export const CircuitWire: React.FC<Props> = ({
  wire,
  isSelected = false,
  onClick,
  onContextMenu,
}) => {
  const pointsAttr =
    (wire.points || [])
      .map((p: Position) => `${p.x},${p.y}`)
      .join(' ') || '';

  const themeStroke = useMemo(() => {
    try {
      const theme = document.documentElement.getAttribute('data-theme');
      if (theme === 'dark') return '#ffffff';
      const c = getComputedStyle(document.documentElement).color || '#222222';
      return c;
    } catch {
      return '#222222';
    }
  }, []);

  const color = isSelected ? '#2196f3' : wire.color || themeStroke;
  const width = Math.max(1, wire.width || 2);

  return (
    <g
      data-wire-id={wire.id}
      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <polyline
        points={pointsAttr}
        fill="none"
        stroke="transparent"
        strokeWidth={width + 8}
        style={{ pointerEvents: 'stroke' }}
      />
      <polyline
        points={pointsAttr}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={1}
      />
    </g>
  );
};





