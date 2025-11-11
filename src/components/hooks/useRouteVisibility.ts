'use client'

import { usePathname } from 'next/navigation';

export const useRouteVisibility = (hidePages: string[]) => {
  const pathname = usePathname();
  return !hidePages.some(page => pathname.startsWith(page));
};