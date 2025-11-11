'use client'

import React from 'react';
import { usePathname } from 'next/navigation';
import Group from '../Group/Group';
import style from './Main.module.scss';
import { CodeEditorWidget, SchemeEditorWidget } from '@widgets/editor';

const Main = () => {
  const pathname = usePathname();

  const renderContent = () => {
    if (pathname.startsWith('/group')) {
      return <Group />;
    }
    if (pathname.startsWith('/editor/code/')) {
      return <CodeEditorWidget />;
    }
    if (pathname === '/editor/scheme') {
      return <SchemeEditorWidget />;
    }
    return null;
  };

  return (
    <div className={style.main}>
      {renderContent()}
    </div>
  );
};

export default Main;
