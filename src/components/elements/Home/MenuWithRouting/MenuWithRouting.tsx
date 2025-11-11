'use client'

import { useRouteVisibility } from '@/components/hooks/useRouteVisibility';
import Menu from '../Menu/Menu';
import MenuEditor from '../../Editor/MenuEditor/MenuEditor';

const MenuWithRouting = () => {
  // show normal Menu on non-editor routes
  const isNonEditor = useRouteVisibility(['/editor']);
  return isNonEditor ? (
    <Menu />
  ) : (
    <MenuEditor />
  );
};

export default MenuWithRouting;
