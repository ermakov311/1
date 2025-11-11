'use client'

import React, { useEffect } from "react";
import { createPortal } from "react-dom";

// Track how many Portal instances are currently mounted to avoid
// removing the global 'open' class while others are still active
let portalOpenCount = 0;

interface PortalProps {
  children: React.ReactNode;
}

const Portal: React.FC<PortalProps> = ({ children }) => {
  // Reuse existing root from layout, fallback create once
  const portalRoot = (typeof document !== 'undefined' && (document.getElementById('portal-root') as HTMLDivElement)) || document.createElement('div');
  if (!portalRoot.id) portalRoot.id = 'portal-root';

  useEffect(() => {
    if (!document.getElementById('portal-root')) {
      document.body.appendChild(portalRoot);
    }
    portalOpenCount += 1;
    portalRoot.classList.add('open');
    return () => {
      portalOpenCount = Math.max(0, portalOpenCount - 1);
      if (portalOpenCount === 0) {
      portalRoot.classList.remove('open');
      }
    };
  }, []);

  return createPortal(children, portalRoot);
};

export default Portal;