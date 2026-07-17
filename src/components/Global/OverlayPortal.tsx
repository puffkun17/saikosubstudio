'use client';

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** Renders children on document.body so overlays escape local stacking contexts. */
export const OverlayPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
  if (!mounted) return null;
  return createPortal(children, document.body);
};
