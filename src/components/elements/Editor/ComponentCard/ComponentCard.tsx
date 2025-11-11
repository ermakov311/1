'use client'

import React from 'react';
import { useDrag } from 'react-dnd';
import style from './ComponentCard.module.scss';
import { ComponentType } from '@/components/scheme/types/schema';
import { ComponentFactory } from '@/components/scheme/models/ComponentFactory';

interface ComponentCardProps {
  type: ComponentType;
  name: string;
}

interface DragItem {
  type: ComponentType;
}

export const ComponentCard = ({type, name} : ComponentCardProps) => {
  const [{ isDragging }, drag] = useDrag<
    DragItem,
    void,
    { isDragging: boolean }
  >(() => ({
    type: 'component',
    item: { type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    options: {
      dropEffect: 'copy',
    },
  }));

  const component = ComponentFactory.createComponent(type);
  const svgString = component.getSVGPreviewString();

  const setDragRef = (element: HTMLDivElement | null) => {
    if (element) {
      drag(element);
    }
  };

  return (
    <div
      ref={setDragRef}
      className={`${style.componentCard} ${isDragging ? style.dragging : ''}`}
      style={{ opacity: isDragging ? 0.6 : 1 }}
    >
      <div
        className={style.componentPreview}
        dangerouslySetInnerHTML={{ __html: svgString }}
      />
      <div className={style.componentName}>{name}</div>
    </div>
  );
};
