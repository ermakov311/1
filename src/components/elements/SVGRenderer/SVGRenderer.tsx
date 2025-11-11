'use client'

import React from 'react';

interface SVGRendererProps {
  svgString: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const SVGRenderer: React.FC<SVGRendererProps> = ({
  svgString,
  className,
  style,
  onClick
}) => {
  return (
    <div
      className={className}
      style={style}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
};