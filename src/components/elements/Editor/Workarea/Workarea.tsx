'use client'

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDrop } from 'react-dnd';
import styles from './Workarea.module.scss';
import {
  ComponentType,
  Position,
  SerializedComponent,
  WireConnection,
} from '@/components/scheme/types/schema';
import { RootState, store } from '@/store/store';
import { ComponentFactory, CircuitComponent, CircuitWire } from '@entities/circuit';
import {
  addComponent,
  moveComponent,
  selectComponent,
  setViewport,
  rotateComponent,
  connectPins,
  selectWire,
  removeWire,
  removeComponent,
  loadProject,
  resetProject,
} from '@/store/project/projectSlice';
import EditorMenu from '../EditorMenu/EditorMenu';
import { startSimulation, stopSimulation, applyCircuitUpdate, updateComponentProperties, clearLogs } from '@/store/project/projectSlice';
import { SimulatorAPI, getSocket } from '@/lib/ws/client';
import PropertiesModal from '../PropertiesModal/PropertiesModal';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@hooks/useAuth';
import { getNormalizedBaseId, getBaseAssignmentId, getStorageKey } from '@lib';
import { apiGet, apiPost } from '@api';

interface DragItem {
  type: ComponentType;
}

interface DragState {
  isDragging: boolean;
  componentId: string | null;
  offset: Position;
  startMousePosition: Position;
  startComponentPosition: Position;
}

interface PanState {
  isPanning: boolean;
  startMousePosition: Position;
  startViewportOffset: Position;
}

interface ViewportState {
  zoom: number;
  offset: Position;
}

interface ContextMenuState {
  visible: boolean;
  position: Position;
  componentId: string | null;
}

interface TempWireState {
  startComponentId: string;
  startPinName: string;
  startPosition: Position;
}

export const Workarea: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const isStudent = !!user && user.role_id === 3;
  const isSimulationRunning = useSelector((state: RootState) => state.project.isSimulationRunning);
  const circuit = useSelector((state: RootState) => state.project.circuit);
  const workareaRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [wiringMode, setWiringMode] = useState<'click' | 'drag'>('click');
  const [verificationStatus, setVerificationStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const { components, wires, selectedComponentId, selectedWireId, viewport } =
    useSelector((state: RootState) => state.project);

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    componentId: null,
    offset: { x: 0, y: 0 },
    startMousePosition: { x: 0, y: 0 },
    startComponentPosition: { x: 0, y: 0 },
  });

  const [panState, setPanState] = useState<PanState>({
    isPanning: false,
    startMousePosition: { x: 0, y: 0 },
    startViewportOffset: { x: 0, y: 0 },
  });

  const [tempWireState, setTempWireState] = useState<TempWireState | null>(
    null
  );
  const [mousePosition, setMousePosition] = useState<Position>({ x: 0, y: 0 });

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    position: { x: 0, y: 0 },
    componentId: null,
  });

  const [localViewport, setLocalViewport] = useState<ViewportState>({
    zoom: viewport?.zoom || 1,
    offset: viewport?.offset || { x: 0, y: 0 },
  });
  const [pressedButtonId, setPressedButtonId] = useState<string | null>(null);
  const [isZooming, setIsZooming] = useState<boolean>(false);
  const zoomTimerRef = useRef<number | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const assignmentId = searchParams?.get('assignmentId');
  const teacherSessionId = !isStudent && user ? String(user.id) : null;
  const fallbackSessionId = 'global';
  const getSimulationSessionId = () => {
    if (assignmentId && user?.id) {
      return `assignment_${assignmentId}_user_${user.id}`;
    }
    return teacherSessionId || fallbackSessionId;
  };
  
  const sessionId = getSimulationSessionId();
  const resolvedAssignmentId = useMemo(() => {
    if (!assignmentId) return null;
    if (teacherSessionId && assignmentId === teacherSessionId) return null;
    if (assignmentId === fallbackSessionId) return null;
    if (/^\d+$/.test(assignmentId)) return assignmentId;
    if (typeof window !== 'undefined') {
      const mapped = sessionStorage.getItem(`assignmentMapping:${assignmentId}`);
      if (mapped) return mapped;
    }
    return null;
  }, [assignmentId, teacherSessionId]);
  const [normalizedBaseId, setNormalizedBaseId] = useState<string | null>(null);
  const [allowSchema, setAllowSchema] = useState<boolean>(true);
  
  useEffect(() => {
    const normalizeId = async () => {
      if (assignmentId === teacherSessionId || (!assignmentId && teacherSessionId)) {
        setNormalizedBaseId(teacherSessionId);
        return;
      }
      
      if (!assignmentId || assignmentId === fallbackSessionId) {
        setNormalizedBaseId(null);
        return;
      }
      const quickBaseId = getBaseAssignmentId(assignmentId, user);
      if (quickBaseId && quickBaseId === assignmentId) {
        setNormalizedBaseId(quickBaseId);
        return;
      }
      const baseId = await getNormalizedBaseId(assignmentId, user);
      setNormalizedBaseId(baseId);
    };
    normalizeId();
  }, [assignmentId, user, teacherSessionId, fallbackSessionId]);
  const storageKey = getStorageKey(normalizedBaseId, sessionId);

  useEffect(() => {
    if (!isStudent && teacherSessionId && !assignmentId && user) {
      router.replace(`${pathname}?assignmentId=${teacherSessionId}`);
    }
  }, [assignmentId, isStudent, teacherSessionId, user, router, pathname]);

  useEffect(() => {
    const cleanup = () => {
      if (!isStudent && teacherSessionId && storageKey === teacherSessionId) {
        try {
          sessionStorage.removeItem(`scheme:${teacherSessionId}`);
          sessionStorage.removeItem(`editorFiles:${teacherSessionId}`);
          sessionStorage.removeItem(`editorCurrentFile:${teacherSessionId}`);
        } catch {}
      }
    };
    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
    };
  }, [storageKey, teacherSessionId, isStudent]);

  useEffect(() => {
    if (!pathname?.startsWith('/editor/scheme') && !pathname?.startsWith('/editor/code')) {
      try {
        if (storageKey !== teacherSessionId) {
          sessionStorage.removeItem(`scheme:${storageKey}`);
          sessionStorage.removeItem(`editorFiles:${storageKey}`);
          sessionStorage.removeItem(`editorCurrentFile:${storageKey}`);
        }
      } catch {}
    }
  }, [pathname, storageKey, teacherSessionId]);
  const isRunningRef = useRef<boolean>(false);
  const pressedButtonIdRef = useRef<string | null>(null);
  useEffect(() => { isRunningRef.current = !!isSimulationRunning; }, [isSimulationRunning]);
  useEffect(() => { pressedButtonIdRef.current = pressedButtonId; }, [pressedButtonId]);

  // Восстанавливаем компоненты
  const restoredComponents = useMemo(() => {
    return components.map((comp) =>
      ComponentFactory.deserialize(comp as SerializedComponent)
    );
  }, [components]);

  // Синхронизируем локальное состояние с Redux
  useEffect(() => {
    setLocalViewport({
      zoom: viewport?.zoom || 1,
      offset: viewport?.offset || { x: 0, y: 0 },
    });
  }, [viewport]);

  // Load saved scheme using normalized base ID for sync between editors
  useEffect(() => {
    const loadScheme = async () => {
    try {
        const key = `scheme:${storageKey}`;
        const isProjectSchemaLike = (obj: unknown): obj is { components: unknown[]; wires: unknown[]; viewport?: { zoom?: number; offset?: Position } } => {
          if (!obj || typeof obj !== 'object') return false;
          const o = obj as Record<string, unknown>;
          return Array.isArray(o.components) && Array.isArray(o.wires);
        };
        if (assignmentId && assignmentId !== teacherSessionId && assignmentId !== fallbackSessionId && isStudent) {
          try {
            const fetchId = assignmentId;
            if (fetchId) {
              const data = await apiGet<{ assignment?: { show_schema?: boolean } }>(`/api/assignments/${fetchId}`);
              const a = data?.assignment;
              if (a && a.show_schema === false) {
                dispatch(resetProject());
                try {
                  sessionStorage.removeItem(key);
                } catch {}
                return;
              }
            }
          } catch (err) {
            
          }
        }
        const saved = sessionStorage.getItem(key);
      if (saved) {
        const schemaUnknown: unknown = JSON.parse(saved);
        if (isProjectSchemaLike(schemaUnknown) && schemaUnknown.components.length > 0) {
            if (isStudent && assignmentId && assignmentId !== teacherSessionId && assignmentId !== fallbackSessionId) {
              try {
                const fetchId = assignmentId;
                const data = await apiGet<{ assignment?: { show_schema?: boolean } }>(`/api/assignments/${fetchId}`);
                const a = data?.assignment;
                if (a && a.show_schema === false) {
                  dispatch(resetProject());
                  try {
                    sessionStorage.removeItem(key);
                  } catch {}
                  return;
                }
              } catch (err) {
                
              }
            }
          const projectSchema = {
            components: schemaUnknown.components as unknown[],
            wires: schemaUnknown.wires as unknown[],
            viewport:
              schemaUnknown.viewport && typeof schemaUnknown.viewport === 'object'
                ? {
                    zoom: Number((schemaUnknown.viewport as any).zoom) || 1,
                    offset: (schemaUnknown.viewport as any).offset ?? { x: 0, y: 0 },
                  }
                : { zoom: 1, offset: { x: 0, y: 0 } },
            metadata: {
              version: '1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          };
          dispatch(loadProject(projectSchema as any));
            return;
        }
      }
        if (assignmentId && assignmentId !== teacherSessionId && assignmentId !== fallbackSessionId) {
          try {
            const fetchId = assignmentId;
            if (fetchId) {
              const data = await apiGet<{ assignment?: { schema_json?: unknown; show_schema?: boolean } }>(`/api/assignments/${fetchId}`);
              const a = data?.assignment;
              if (a) {
                const shouldShowSchema = !isStudent || a.show_schema !== false;
                if (a.schema_json && shouldShowSchema) {
                  let schemaDataUnknown: unknown = a.schema_json;
                  if (typeof schemaDataUnknown === 'string') {
                    try { schemaDataUnknown = JSON.parse(schemaDataUnknown); } catch { schemaDataUnknown = null; }
                  }
                  if (isProjectSchemaLike(schemaDataUnknown) && schemaDataUnknown.components.length > 0) {
                    const projectSchema = {
                      components: schemaDataUnknown.components as unknown[],
                      wires: schemaDataUnknown.wires as unknown[],
                      viewport:
                        schemaDataUnknown.viewport && typeof schemaDataUnknown.viewport === 'object'
                          ? {
                              zoom: Number((schemaDataUnknown.viewport as any).zoom) || 1,
                              offset: (schemaDataUnknown.viewport as any).offset ?? { x: 0, y: 0 },
                            }
                          : { zoom: 1, offset: { x: 0, y: 0 } },
                      metadata: {
                        version: '1',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      },
                    };
                    dispatch(loadProject(projectSchema as any));
                    try { sessionStorage.setItem(key, JSON.stringify(projectSchema)); } catch {}
                  }
                } else if (isStudent && a.show_schema === false) {
                  dispatch(resetProject());
                  try { sessionStorage.removeItem(key); } catch {}
                }
              }
            }
          } catch (err) {
            
          }
        }
      } catch {}
    };
    loadScheme();
  }, [storageKey, dispatch, assignmentId, teacherSessionId, fallbackSessionId, isStudent]);

  useEffect(() => {
    try {
      const key = `scheme:${storageKey}`;
      const schema = { components, wires, viewport };
      sessionStorage.setItem(key, JSON.stringify(schema));
    } catch {}
  }, [storageKey, components, wires, viewport]);

  useEffect(() => {
    const checkVisibility = async () => {
      try {
        if (!assignmentId) { setAllowSchema(true); return; }
        if (!isStudent) { setAllowSchema(true); return; }
        if (!resolvedAssignmentId) { setAllowSchema(true); return; }
        const data = await apiGet<{ assignment?: { show_schema?: boolean } }>(`/api/assignments/${resolvedAssignmentId}`);
        const a = data?.assignment;
        if (!a) { setAllowSchema(true); return; }
        if (a && a.show_schema === false) { setAllowSchema(false); } else { setAllowSchema(true); }
      } catch { setAllowSchema(true); }
    };
    checkVisibility();
  }, [assignmentId, resolvedAssignmentId, isStudent]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (tempWireState) {
          setTempWireState(null);
        }
        if (selectedWireId) {
          dispatch(selectWire(null));
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWireId) {
        dispatch(removeWire(selectedWireId));
        dispatch(selectWire(null));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tempWireState, selectedWireId, dispatch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setTimeout(() => {
          setContextMenu((prev) => ({ ...prev, visible: false }));
        }, 100);
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu.visible]);

  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>(
    () => ({
      accept: 'component',
      drop: (item: DragItem, monitor) => {
        const offset = monitor.getSourceClientOffset();
        if (!offset || !workareaRef.current) return;

        const rect = workareaRef.current.getBoundingClientRect();
        const position = {
          x:
            (offset.x - rect.left - localViewport.offset.x) /
            localViewport.zoom,
          y:
            (offset.y - rect.top - localViewport.offset.y) / localViewport.zoom,
        };

        if (!ComponentFactory.isValidComponentType(item.type)) return;

        const newComponent = ComponentFactory.createComponent(
          item.type,
          position
        );
        dispatch(addComponent(newComponent.serialize()));
        dispatch(selectComponent(newComponent.id));
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }),
    [dispatch, localViewport]
  );

  const setDropRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (element) {
        workareaRef.current = element;
        drop(element);
      }
    },
    [drop]
  );

  const resolveSvgColors = useCallback((svg: string): string => {
    try {
      const rootStyles = getComputedStyle(document.documentElement);
      const colorFromContext = workareaRef.current
        ? getComputedStyle(workareaRef.current).color
        : rootStyles.color;

      const withResolvedVars = svg.replace(/var\((--[a-zA-Z0-9_-]+)\)/g, (_m, varName) => {
        const v = rootStyles.getPropertyValue(varName).trim();
        return v || 'currentColor';
      });

      const withResolvedCurrent = withResolvedVars.replace(/currentColor/g, colorFromContext || '#000');

      return withResolvedCurrent;
    } catch {
      return svg;
    }
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      if (!workareaRef.current) return;

      const rect = workareaRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(
        0.1,
        Math.min(5, localViewport.zoom * zoomFactor)
      );

      const zoomRatio = newZoom / localViewport.zoom;
      const newOffset = {
        x: mouseX - (mouseX - localViewport.offset.x) * zoomRatio,
        y: mouseY - (mouseY - localViewport.offset.y) * zoomRatio,
      };

      const newViewport = { zoom: newZoom, offset: newOffset };
      setLocalViewport(newViewport);
      dispatch(setViewport(newViewport));
      try {
        setIsZooming(true);
        if (zoomTimerRef.current) {
          window.clearTimeout(zoomTimerRef.current);
        }
        zoomTimerRef.current = window.setTimeout(() => {
          setIsZooming(false);
          zoomTimerRef.current = null;
        }, 150);
      } catch {}
    },
    [localViewport, dispatch]
  );

  // Обработчик нажатия мыши
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // If some button is still considered pressed, force release before handling new actions
      if (isRunningRef.current && pressedButtonIdRef.current) {
        const btnId = pressedButtonIdRef.current;
        const comp = restoredComponents.find(c => c.id === btnId);
        if (comp && String(comp.type || '').toLowerCase().includes('button')) {
          SimulatorAPI.updateComponent(btnId, { pressed: false });
          dispatch(updateComponentProperties({ id: btnId, properties: { pressed: false } }));
        }
        setPressedButtonId(null);
      }
      if (e.button !== 0) return;

      setContextMenu((prev) => ({ ...prev, visible: false }));

      const target = e.target as HTMLElement;
      const isClickOnComponent = target.closest(`.${styles.componentWrapper}`);
      const isClickOnPin = target.classList.contains(styles.pin);

      if (!isClickOnComponent && !isClickOnPin) {
        e.preventDefault();
        e.stopPropagation();

        setPanState({
          isPanning: true,
          startMousePosition: { x: e.clientX, y: e.clientY },
          startViewportOffset: { ...localViewport.offset },
        });

        dispatch(selectComponent(null));
        dispatch(selectWire(null));
      }
    },
    [dispatch, localViewport]
  );

  const handleComponentContextMenu = useCallback(
    (e: React.MouseEvent, component: CircuitComponent) => {
      e.preventDefault();
      e.stopPropagation();

      setContextMenu({
        visible: true,
        position: { x: e.clientX, y: e.clientY },
        componentId: component.id,
      });

      dispatch(selectComponent(component.id));
    },
    [dispatch]
  );
  const handleWorkareaContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (selectedWireId) dispatch(selectWire(null));
      setContextMenu((prev) => ({ ...prev, visible: false }));
    },
    [selectedWireId, dispatch]
  );

  const handleMouseUpAnywhere = useCallback(() => {
    if (!isRunningRef.current) return;
    const currentId = pressedButtonIdRef.current;
    if (!currentId) return;
    const comp = restoredComponents.find(c => c.id === currentId);
    if (comp && String(comp.type || '').toLowerCase().includes('button')) {
      SimulatorAPI.updateComponent(currentId, { pressed: false });
      dispatch(updateComponentProperties({ id: currentId, properties: { pressed: false } }));
    }
    setPressedButtonId(null);
  }, [isSimulationRunning, pressedButtonId, restoredComponents, dispatch]);

  // Robust release: listen on document/window for various end events
  useEffect(() => {
    const onPointerUp = () => handleMouseUpAnywhere();
    const onPointerDown = () => {
      // Release previously pressed button before any new click anywhere
      if (!isRunningRef.current) return;
      const currentId = pressedButtonIdRef.current;
      if (!currentId) return;
      const comp = restoredComponents.find(c => c.id === currentId);
      if (comp && String(comp.type || '').toLowerCase().includes('button')) {
        SimulatorAPI.updateComponent(currentId, { pressed: false });
        dispatch(updateComponentProperties({ id: currentId, properties: { pressed: false } }));
      }
      setPressedButtonId(null);
    };
    const onVisibilityChange = () => { if (document.hidden) handleMouseUpAnywhere(); };
    const onBlur = () => handleMouseUpAnywhere();
    window.addEventListener('mouseup', onPointerUp, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('touchend', onPointerUp, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('mouseup', onPointerUp, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('touchend', onPointerUp, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [handleMouseUpAnywhere]);

  const handleWireContextMenu = useCallback(
    (e: React.MouseEvent, wireId: string) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(removeWire(wireId));
      dispatch(selectWire(null));
    },
    [dispatch]
  );

  const handleWorkareaClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const isClickOnPin = target.classList.contains(styles.pin);
      const isClickOnComponent = target.closest(`.${styles.componentWrapper}`);

      if (!isClickOnPin && !isClickOnComponent && tempWireState) {
        setTempWireState(null);
      }

      dispatch(selectComponent(null));
      dispatch(selectWire(null));
    },
    [tempWireState, dispatch]
  );

  const handleComponentClick = useCallback(
    (e: React.MouseEvent, component: CircuitComponent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      dispatch(selectComponent(component.id));
      dispatch(selectWire(null));
    },
    [dispatch]
  );

  const handleComponentMouseDown = useCallback(
    (e: React.MouseEvent, component: CircuitComponent) => {
      if (e.button !== 0) return;
      e.stopPropagation();

      const isButton = String(component.type || '').toLowerCase().includes('button');
      if (isRunningRef.current && isButton) {
        SimulatorAPI.updateComponent(component.id, { pressed: true });
        dispatch(updateComponentProperties({ id: component.id, properties: { pressed: true } }));
        setPressedButtonId(component.id);
        e.preventDefault();
        return;
      }

      if (isRunningRef.current) {
        e.preventDefault();
        return;
      }

      if (!workareaRef.current) return;

      const rect = workareaRef.current.getBoundingClientRect();
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      const componentScreenX =
        component.position.x * localViewport.zoom + localViewport.offset.x;
      const componentScreenY =
        component.position.y * localViewport.zoom + localViewport.offset.y;

      const offsetX = mouseX - rect.left - componentScreenX;
      const offsetY = mouseY - rect.top - componentScreenY;

      setDragState({
        isDragging: true,
        componentId: component.id,
        offset: { x: offsetX, y: offsetY },
        startMousePosition: { x: mouseX, y: mouseY },
        startComponentPosition: { ...component.position },
      });

      dispatch(selectComponent(component.id));
      dispatch(selectWire(null));
    },
    [dispatch, localViewport]
  );

  const handlePinMouseDown = useCallback(
    (e: React.MouseEvent, componentId: string, pinName: string) => {
      e.stopPropagation();
      if (wiringMode === 'drag') {
        const component = restoredComponents.find((c) => c.id === componentId);
        if (!component) return;

        const pinPosition = component.getAbsolutePinPosition(pinName);

        setTempWireState({
          startComponentId: componentId,
          startPinName: pinName,
          startPosition: pinPosition,
        });

        dispatch(selectComponent(null));
        dispatch(selectWire(null));
      }
    },
    [wiringMode, restoredComponents, dispatch]
  );

  const toggleWiringMode = useCallback(() => {
    setWiringMode((prev) => (prev === 'click' ? 'drag' : 'click'));
  }, []);

  const handlePinClick = useCallback(
    (e: React.MouseEvent, componentId: string, pinName: string) => {
      e.stopPropagation();

      const component = restoredComponents.find((c) => c.id === componentId);
      if (!component) return;

      const pinPosition = component.getAbsolutePinPosition(pinName);

      if (!tempWireState) {
        setTempWireState({
          startComponentId: componentId,
          startPinName: pinName,
          startPosition: pinPosition,
        });
      } else {
        if (tempWireState.startComponentId !== componentId) {
          dispatch(
            connectPins({
              start: {
                componentId: tempWireState.startComponentId,
                pinName: tempWireState.startPinName,
              },
              end: { componentId, pinName },
            })
          );
        }
        setTempWireState(null);
      }
    },
    [tempWireState, restoredComponents, dispatch]
  );

  const transformToScreenSpace = useCallback(
    (position: Position): Position => {
      return {
        x: position.x * localViewport.zoom + localViewport.offset.x,
        y: position.y * localViewport.zoom + localViewport.offset.y,
      };
    },
    [localViewport.zoom, localViewport.offset.x, localViewport.offset.y]
  );

  const transformedComponents = useMemo(() => {
    return restoredComponents.map((component) => {
      const screenPos = transformToScreenSpace(component.position);
      return { ...component, screenPos };
    });
  }, [restoredComponents, transformToScreenSpace]);

  const transformToWorldSpace = useCallback(
    (screenPosition: Position): Position => {
      return {
        x: (screenPosition.x - localViewport.offset.x) / localViewport.zoom,
        y: (screenPosition.y - localViewport.offset.y) / localViewport.zoom,
      };
    },
    [localViewport]
  );

  const restoredComponentsRef = useRef(restoredComponents);
  useEffect(() => {
    restoredComponentsRef.current = restoredComponents;
  }, [restoredComponents]);

  useEffect(() => {
    const handleCircuitUpdate = (u: { components?: Record<string, unknown> }) => {
      if (isRunningRef.current) {
        const raw = u.components || {};
        const numeric: Record<string, number> = Object.fromEntries(
          Object.entries(raw).map(([k, v]) => {
            const n = typeof v === 'number' ? v : Number(v);
            return [k, Number.isFinite(n) ? n : 0];
          })
        );
        dispatch(applyCircuitUpdate(numeric));
      }
    };
    
    const handleLog = (m: unknown) => {
      try {
        const msg = m as Record<string, unknown> | null;
        if (!msg) return;
        const type = (msg as any).type;
        const inner = (msg as any).message;
        if (type === 'event') {
          dispatch(appendLog(msg as unknown as Record<string, unknown>));
        } else if (inner && typeof inner === 'object' && (inner as any).type === 'event') {
          dispatch(appendLog(inner as Record<string, unknown>));
        }
      } catch {}
    };
    
    const handleSimulationFinished = () => {
      if (pressedButtonIdRef.current) {
        const comp = restoredComponentsRef.current.find(c => c.id === pressedButtonIdRef.current);
        if (comp && String(comp.type || '').toLowerCase().includes('button')) {
          dispatch(updateComponentProperties({ id: comp.id, properties: { pressed: false } }));
        }
        setPressedButtonId(null);
      }
    };
    
    SimulatorAPI.onCircuitUpdate(handleCircuitUpdate);
    SimulatorAPI.onLog(handleLog);
    SimulatorAPI.onSimulationFinished(handleSimulationFinished);
    return () => {
      try {
        const socket = getSocket();
        if (socket) {
          socket.off('circuitUpdate', handleCircuitUpdate);
          socket.off('simulationOutput', handleLog);
          socket.off('simulationFinished', handleSimulationFinished);
        }
      } catch (e) {
      }
    };
  }, []);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (workareaRef.current) {
        const rect = workareaRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }

      if (panState.isPanning) {
        const deltaX = e.clientX - panState.startMousePosition.x;
        const deltaY = e.clientY - panState.startMousePosition.y;

        const newOffset = {
          x: panState.startViewportOffset.x + deltaX,
          y: panState.startViewportOffset.y + deltaY,
        };

        setLocalViewport((prev) => ({ ...prev, offset: newOffset }));
      }

      if (
        dragState.isDragging &&
        dragState.componentId &&
        workareaRef.current
      ) {
        const rect = workareaRef.current.getBoundingClientRect();
        const newWorldX = e.clientX - rect.left - dragState.offset.x;
        const newWorldY = e.clientY - rect.top - dragState.offset.y;

        const newSceneX =
          (newWorldX - localViewport.offset.x) / localViewport.zoom;
        const newSceneY =
          (newWorldY - localViewport.offset.y) / localViewport.zoom;

        setDragState((prev) => ({
          ...prev,
          startMousePosition: { x: e.clientX, y: e.clientY },
          startComponentPosition: { x: newSceneX, y: newSceneY },
        }));

        try {
          dispatch(
            moveComponent({ id: dragState.componentId, position: { x: newSceneX, y: newSceneY } })
          );
        } catch {}
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (tempWireState && wiringMode === 'drag' && workareaRef.current) {
        const rect = workareaRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const mousePos = {
          x: (mouseX - localViewport.offset.x) / localViewport.zoom,
          y: (mouseY - localViewport.offset.y) / localViewport.zoom,
        };

        let endPin: WireConnection | null = null;

        for (const component of restoredComponents) {
          if (component.id === tempWireState.startComponentId) continue;
          const pinName = component.getPinAtPoint(
            mousePos,
            20 / localViewport.zoom
          );
          if (pinName) {
            endPin = { componentId: component.id, pinName };
            break;
          }
        }

        if (endPin) {
          dispatch(
            connectPins({
              start: {
                componentId: tempWireState.startComponentId,
                pinName: tempWireState.startPinName,
              },
              end: endPin,
            })
          );
        }

        setTempWireState(null);
      }

      if (panState.isPanning) {
        setPanState({
          isPanning: false,
          startMousePosition: { x: 0, y: 0 },
          startViewportOffset: { x: 0, y: 0 },
        });
        dispatch(setViewport(localViewport));
      }

      if (dragState.isDragging && dragState.componentId) {
        dispatch(
          moveComponent({
            id: dragState.componentId,
            position: dragState.startComponentPosition,
          })
        );
        setDragState({
          isDragging: false,
          componentId: null,
          offset: { x: 0, y: 0 },
          startMousePosition: { x: 0, y: 0 },
          startComponentPosition: { x: 0, y: 0 },
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    tempWireState,
    panState,
  
    dragState,
    localViewport,
    restoredComponents,
    dispatch,
    wiringMode,
    isSimulationRunning,
    pressedButtonId,
  ]);

  const getWirePoints = useCallback(
    (startPin: WireConnection, endPin: WireConnection): Position[] => {
      try {
        const startComponent = restoredComponents.find(
          (c) => c.id === startPin.componentId
        );
        const endComponent = restoredComponents.find(
          (c) => c.id === endPin.componentId
        );

        if (!startComponent || !endComponent) return [];

        let startWorldPos = startComponent.getAbsolutePinPosition(
          startPin.pinName
        );
        let endWorldPos = endComponent.getAbsolutePinPosition(endPin.pinName);

        if (dragState.isDragging && dragState.componentId) {
          if (startComponent.id === dragState.componentId) {
            const dx = dragState.startComponentPosition.x - startComponent.position.x;
            const dy = dragState.startComponentPosition.y - startComponent.position.y;
            startWorldPos = { x: startWorldPos.x + dx, y: startWorldPos.y + dy };
          }
          if (endComponent.id === dragState.componentId) {
            const dx = dragState.startComponentPosition.x - endComponent.position.x;
            const dy = dragState.startComponentPosition.y - endComponent.position.y;
            endWorldPos = { x: endWorldPos.x + dx, y: endWorldPos.y + dy };
          }
        }

        const startScreenPos = transformToScreenSpace(startWorldPos);
        const endScreenPos = transformToScreenSpace(endWorldPos);

        return [startScreenPos, endScreenPos];
      } catch (error) {
        return [];
      }
    },
    [restoredComponents, transformToScreenSpace, dragState]
  );

  const renderWires = () => {
    return wires.map((wire) => {
      const points = getWirePoints(wire.start, wire.end);
      if (points.length < 2) return null;

      return (
        <CircuitWire
          key={wire.id}
          wire={{ ...wire, points }}
          isSelected={selectedWireId === wire.id}
          onClick={() => dispatch(selectWire(wire.id))}
          onContextMenu={(e: React.MouseEvent<SVGElement, MouseEvent>) => handleWireContextMenu(e, wire.id)}
        />
      );
    });
  };


  const getPinScreenPosition = useCallback(
    (component: CircuitComponent, pinName: string): Position => {
      try {
        const absPos = component.getAbsolutePinPosition(pinName);
        return {
          x: absPos.x * localViewport.zoom + localViewport.offset.x,
          y: absPos.y * localViewport.zoom + localViewport.offset.y,
        };
      } catch (error) {
        return { x: 0, y: 0 };
      }
    },
    [localViewport]
  );

  const renderComponentPins = (component: CircuitComponent) => {
    return Object.entries(component.pinPositions).map(([pinName, relPos]) => {
      try {
        let worldPos = component.getAbsolutePinPosition(pinName);

        if (dragState.isDragging && dragState.componentId === component.id) {
          const dx = dragState.startComponentPosition.x - component.position.x;
          const dy = dragState.startComponentPosition.y - component.position.y;
          worldPos = { x: worldPos.x + dx, y: worldPos.y + dy };
        }

        const screenPos = transformToScreenSpace(worldPos);

        const isActive =
          tempWireState?.startComponentId === component.id &&
          tempWireState?.startPinName === pinName;
        const pinSize = 8 * localViewport.zoom;

        return (
          <div
            key={`${component.id}-${pinName}`}
            className={`${styles.pin} ${isActive ? styles.pinActive : ''} ${(dragState.isDragging || panState.isPanning || isZooming) ? styles.pinInstant : ''}`}
            style={{
              position: 'absolute',
              left: screenPos.x - pinSize / 2,
              top: screenPos.y - pinSize / 2,
              width: pinSize,
              height: pinSize,
              borderRadius: '50%',
              background: isActive ? '#00ff00' : '#ff4444',
              cursor: 'crosshair',
              zIndex: 20,
              pointerEvents: 'auto',
              border: `${1 * localViewport.zoom}px solid #fff`,
              boxShadow: isActive
                ? `0 0 0 ${2 * localViewport.zoom}px rgba(0, 255, 0, 0.3)`
                : 'none',
            }}
            onMouseDown={(e) => handlePinMouseDown(e, component.id, pinName)}
            onClick={(e) => handlePinClick(e, component.id, pinName)}
            title={`${component.name} - ${pinName}`}
          />
        );
      } catch (error) {
        return null;
      }
    });
  };



  const renderComponents = () => {
    return restoredComponents.map((component) => {
      const isSelected = component.id === selectedComponentId;
      const isBeingDragged = component.id === dragState.componentId;

      let position = component.position;
      if (isBeingDragged) {
        position = dragState.startComponentPosition;
      }

      const screenPos = transformToScreenSpace(position);

      return (
        <React.Fragment key={component.id}>
          <div
            className={`${styles.componentWrapper} ${
              isBeingDragged ? styles.dragging : ''
            }`}
            style={{
              position: 'absolute',
              left: screenPos.x,
              top: screenPos.y,
              width: component.width * localViewport.zoom,
              height: component.height * localViewport.zoom,
              transform: `rotate(${component.rotation}deg)`,
              transformOrigin: 'center center',
              cursor: isBeingDragged ? 'grabbing' : 'grab',
              zIndex: isSelected || isBeingDragged ? 10 : 1,
              transition: (isBeingDragged || panState.isPanning || isZooming) ? 'none' : 'left 0.1s, top 0.1s',
              opacity: isBeingDragged ? 0.8 : 1,
            }}
            onMouseDown={(e) => handleComponentMouseDown(e, component)}
            onPointerLeave={handleMouseUpAnywhere}
            onMouseLeave={handleMouseUpAnywhere}
            onClick={(e) => handleComponentClick(e, component)}
            onContextMenu={(e) => handleComponentContextMenu(e, component)}
          >
            {(() => {
              const raw = component.getSVGString(isSelected);
              const svg = resolveSvgColors(raw);
              const src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
              const isLed = String(component.type || '').toLowerCase().includes('led');
              const rawVal = Number((circuit && circuit[component.id]) ?? 0);
              const intensity = (() => {
                if (!Number.isFinite(rawVal) || rawVal <= 0) return 0;
                if (rawVal <= 1) return rawVal;              // already [0..1]
                if (rawVal <= 5) return Math.min(1, rawVal / 5); // small analog range
                if (rawVal <= 255) return Math.min(1, rawVal / 255); // typical 8-bit PWM
                return Math.min(1, rawVal / 1023);           // typical 10-bit PWM
              })();
              const ledColor = ((component as unknown as { properties?: { color?: string } })?.properties?.color) || '#ffff64';
              const toRgb = (hex: string) => {
                try { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return m ? `${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)}` : '255,255,100'; } catch { return '255,255,100'; }
              };
              const rgb = toRgb(ledColor);
              return (
                <img
                  src={src}
                  alt={component.name}
                  style={{
                    pointerEvents: 'none',
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    filter: isLed ? (intensity > 0 ? `drop-shadow(0 0 ${Math.round(4 + 12*intensity)}px rgba(${rgb},${0.3+0.6*intensity})) brightness(${(0.7 + 0.6*intensity).toFixed(2)})` : 'brightness(0.7)') : undefined,
                    transition: 'filter 120ms linear',
                  }}
                />
              );
            })()}
          </div>
          {renderComponentPins(component)}
        </React.Fragment>
      );
    });
  };

  const handleRotateComponent = useCallback(
    (degrees: number) => {
      if (contextMenu.componentId) {
        dispatch(
          rotateComponent({
            id: contextMenu.componentId,
            degrees,
          })
        );
      }
      setContextMenu((prev) => ({ ...prev, visible: false }));
    },
    [contextMenu.componentId, dispatch]
  );


  const handleRemoveComponent = useCallback(() => {
    if (contextMenu.componentId) {
      dispatch(removeComponent(contextMenu.componentId));
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, [contextMenu.componentId, dispatch]);

  // Обработчик открытия свойств компонента
  const handleOpenProperties = useCallback(() => {
    if (!contextMenu.componentId) return;
    setPropsModal({ open: true, componentId: contextMenu.componentId });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, [contextMenu.componentId]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);


  const [propsModal, setPropsModal] = useState<{ open: boolean; componentId: string | null }>({ open: false, componentId: null });

  const renderContextMenu = () => {
    if (!contextMenu.visible || !contextMenu.componentId) return null;

    return (
      <div
        ref={contextMenuRef}
        className={styles.contextMenu}
        style={{
          left: contextMenu.position.x,
          top: contextMenu.position.y,
        }}
      >
        <div
          className={styles.contextMenuItem}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpenProperties();
          }}
        >
          Свойства
        </div>
        <div
          className={styles.contextMenuItem}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleRotateComponent(90);
          }}
        >
          Повернуть на 90° вправо
        </div>
        <div
          className={styles.contextMenuItem}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleRotateComponent(-90);
          }}
        >
          Повернуть на 90° влево
        </div>
        <div
          className={styles.contextMenuItem}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleRotateComponent(180);
          }}
        >
          Повернуть на 180°
        </div>
        <div
          className={styles.contextMenuItem}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleRemoveComponent();
          }}
        >
          Удалить
        </div>
      </div>
    );
  };
  return (
    <div
      ref={setDropRef}
      className={`${styles.workarea} ${isOver ? styles.isOver : ''} ${
        panState.isPanning ? styles.panning : ''
      }`}
      onClick={handleWorkareaClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUpAnywhere}
      onContextMenu={handleWorkareaContextMenu}
      style={{ cursor: panState.isPanning ? 'grabbing' : 'default' }}
    >
      <div
        className={styles.svgContainer}
        style={{
          transform: `translate(${localViewport.offset.x}px, ${localViewport.offset.y}px)`,
        }}
      >
        {renderComponents()}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          {renderWires()}
        </svg>
      </div>
      {renderContextMenu()}

      <div className={styles.zoomIndicator}>
        Масштаб: {Math.round(localViewport.zoom * 100)}%
        {panState.isPanning && ' • Перемещение...'}
      </div>

      {/* {isOver && (
        <div className={styles.dropOverlay}>
          <div className={styles.dropIndicator}>Перетащите компонент сюда</div>
        </div>
      )} */}

      <EditorMenu
        leftButtonName='Старт'
        rightButtonName='Стоп'
        leftDisabled={isSimulationRunning}
        rightDisabled={!isSimulationRunning}
        extraButtonName={assignmentId && isStudent ? 'Проверить' : undefined}
        extraDisabled={isVerifying}
        onClickFirstButton={() => {
          dispatch(clearLogs());
          dispatch(startSimulation());
          const proj = { components, wires };
          SimulatorAPI.start(proj, sessionId);
          setVerificationStatus(null);
        }}
        onClickSecondButton={() => { dispatch(stopSimulation()); SimulatorAPI.stop(sessionId); }}
        onClickExtraButton={assignmentId && isStudent ? async () => {
          setIsVerifying(true);
          setVerificationStatus(null);
          try {
            setVerificationStatus({ message: 'Запуск симуляции...', isError: false });
            if (isSimulationRunning) {
          dispatch(stopSimulation());
          SimulatorAPI.stop(sessionId);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            dispatch(clearLogs());
            await new Promise(resolve => setTimeout(resolve, 500));
            let attempts = 0;
            while (attempts < 10) {
              const stateBeforeStart = store.getState() as RootState;
              const projectBeforeStart = stateBeforeStart.project;
              const logsBeforeStart = Array.isArray(projectBeforeStart?.logs) ? projectBeforeStart.logs : [];
              if (logsBeforeStart.length === 0) {
                break;
              }
              dispatch(clearLogs());
              await new Promise(resolve => setTimeout(resolve, 300));
              attempts++;
            }
            const finalCheckState = store.getState() as RootState;
            const finalCheckProject = finalCheckState.project;
            const finalCheckLogs = Array.isArray(finalCheckProject?.logs) ? finalCheckProject.logs : [];
            if (finalCheckLogs.length > 0) {
              dispatch(clearLogs());
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            let initialState = store.getState() as RootState;
            let initialProject = initialState.project;
            let initialLogs = Array.isArray(initialProject?.logs) ? initialProject.logs : [];
            let initialLogCount = initialLogs.length;
            if (initialLogCount > 0) {
              dispatch(clearLogs());
              await new Promise(resolve => setTimeout(resolve, 500));
              const recheckState = store.getState() as RootState;
              const recheckProject = recheckState.project;
              const recheckLogs = Array.isArray(recheckProject?.logs) ? recheckProject.logs : [];
              initialLogCount = recheckLogs.length;
              if (initialLogCount > 0) {
              }
            }
            dispatch(startSimulation());
            const proj = { components, wires };
            SimulatorAPI.start(proj, sessionId);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const buttons = restoredComponents.filter((comp: CircuitComponent) => 
              comp && String(comp.type || '').toLowerCase().includes('button')
            );
            if (buttons.length > 0) {
              setVerificationStatus({ message: 'Тестирование кнопок...', isError: false });
              for (const button of buttons) {
                const buttonId = button.id;
                SimulatorAPI.updateComponent(buttonId, { pressed: true }, sessionId);
                dispatch(updateComponentProperties({ id: buttonId, properties: { pressed: true } }));
                await new Promise(resolve => setTimeout(resolve, 2000));
                SimulatorAPI.updateComponent(buttonId, { pressed: false }, sessionId);
                dispatch(updateComponentProperties({ id: buttonId, properties: { pressed: false } }));
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            setVerificationStatus({ message: 'Сбор логов...', isError: false });
            const waitForLogs = async (): Promise<boolean> => {
              const maxWaitTime = 15000;
              const checkInterval = 300;
              const stabilityTime = 2000;
              const minEvents = 4;
              let lastLogCount = initialLogCount;
              let stableSince = Date.now();
              const startTime = Date.now();
              let firstLoopDetected = false;
              await new Promise(resolve => setTimeout(resolve, 1000));
              while (Date.now() - startTime < maxWaitTime) {
                const currentState = store.getState() as RootState;
                const currentProject = currentState.project;
                const currentLogs = Array.isArray(currentProject?.logs) ? currentProject.logs : [];
                const newLogs = currentLogs.slice(initialLogCount);
                const eventLogs = newLogs.filter((e: any) => e && typeof e === 'object' && e.type === 'event');
                const currentCount = eventLogs.length;
                if (!firstLoopDetected && eventLogs.length > 0) {
                  const loopStarts = eventLogs.filter((e: any) => e.name === 'loop' && e.phase === 'start');
                  const loopEnds = eventLogs.filter((e: any) => e.name === 'loop' && e.phase === 'end');
                  if (loopStarts.length > 0 && loopEnds.length > 0) {
                    let firstStartIdx = -1;
                    let firstEndIdx = -1;
                    for (let i = 0; i < eventLogs.length; i++) {
                      if (eventLogs[i].name === 'loop' && eventLogs[i].phase === 'start' && firstStartIdx === -1) {
                        firstStartIdx = i;
                      }
                      if (eventLogs[i].name === 'loop' && eventLogs[i].phase === 'end' && firstStartIdx !== -1 && firstEndIdx === -1) {
                        firstEndIdx = i;
                        break;
                      }
                    }
                    if (firstStartIdx !== -1 && firstEndIdx !== -1) {
                      firstLoopDetected = true;
                      const eventsInFirstLoop = firstEndIdx - firstStartIdx - 1;
                      dispatch(stopSimulation());
                      SimulatorAPI.stop(sessionId);
                      await new Promise(resolve => setTimeout(resolve, 800));
                      const finalState = store.getState() as RootState;
                      const finalProject = finalState.project;
                      const finalLogs = Array.isArray(finalProject?.logs) ? finalProject.logs : [];
                      const finalNewLogs = finalLogs.slice(initialLogCount);
                      const finalEventLogs = finalNewLogs.filter((e: Record<string, unknown>) => e && typeof e === 'object' && (e as any).type === 'event');
                      const finalLoopStarts = finalEventLogs.filter((e: Record<string, unknown>) => (e as any).name === 'loop' && (e as any).phase === 'start');
                      const finalLoopEnds = finalEventLogs.filter((e: Record<string, unknown>) => (e as any).name === 'loop' && (e as any).phase === 'end');
                      if (finalEventLogs.length < minEvents) {
                        
                      }
                      if (finalLoopStarts.length > 1 || finalLoopEnds.length > 1) {
                        
                      }
                      return true;
                    }
                  }
                }
                const elapsed = Date.now() - startTime;
                if (currentCount >= minEvents && currentCount === lastLogCount) {
                  const stableDuration = Date.now() - stableSince;
                  if (stableDuration >= stabilityTime) {
                    dispatch(stopSimulation());
                    SimulatorAPI.stop(sessionId);
                    await new Promise(resolve => setTimeout(resolve, 800));
                    return true;
                  }
                } else {
                  if (currentCount !== lastLogCount) {
                    stableSince = Date.now();
                    lastLogCount = currentCount;
                  }
                }
                await new Promise(resolve => setTimeout(resolve, checkInterval));
              }
              dispatch(stopSimulation());
              SimulatorAPI.stop(sessionId);
              await new Promise(resolve => setTimeout(resolve, 1000));
              const finalState = store.getState() as RootState;
              const finalProject = finalState.project;
              const finalLogs = Array.isArray(finalProject?.logs) ? finalProject.logs : [];
              const finalNewLogs = finalLogs.slice(initialLogCount);
              const finalEventLogs = finalNewLogs.filter((e: Record<string, unknown>) => e && typeof e === 'object' && (e as any).type === 'event');
              return finalEventLogs.length >= minEvents;
            };
            
            const logsReady = await waitForLogs();
            
            if (!logsReady) {
              setVerificationStatus({ message: 'Не удалось собрать достаточно логов. Попробуйте еще раз.', isError: true });
              dispatch(stopSimulation());
              SimulatorAPI.stop(sessionId);
              await new Promise(resolve => setTimeout(resolve, 1000));
              dispatch(clearLogs());
              await new Promise(resolve => setTimeout(resolve, 200));
              dispatch(clearLogs());
              return;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            let allLogsSnapshot: Array<Record<string, unknown>> = [];
            for (let i = 0; i < 3; i++) {
              const currentState = store.getState() as RootState;
              const currentProject = currentState.project;
              const currentLogs = Array.isArray(currentProject?.logs) ? currentProject.logs : [];
              if (currentLogs.length > allLogsSnapshot.length) {
                allLogsSnapshot = currentLogs.map((log: Record<string, unknown>) => ({ ...log }));
                await new Promise(resolve => setTimeout(resolve, 200));
              } else {
                break;
              }
            }
            if (allLogsSnapshot.length === 0) {
              setVerificationStatus({ message: 'Не удалось собрать логи. Попробуйте еще раз.', isError: true });
              return;
            }
            setVerificationStatus({ message: 'Проверка задания...', isError: false });
            let verifyId: string | null = null;
          if (resolvedAssignmentId) {
              verifyId = resolvedAssignmentId;
          } else if (assignmentId) {
              const baseId = getBaseAssignmentId(assignmentId, user);
              if (baseId && baseId !== assignmentId) {
                verifyId = baseId;
              } else if (/^\d+$/.test(assignmentId)) {
                try {
                  const apiData = await apiGet<{ assignment?: { id?: number } }>(`/api/assignments/${assignmentId}`);
                  if (apiData?.assignment?.id) {
                    verifyId = String(apiData.assignment.id);
                    sessionStorage.setItem(`assignmentMapping:${assignmentId}`, verifyId);
                  } else {
                    const apiBaseId = await getNormalizedBaseId(assignmentId, user);
                    verifyId = apiBaseId || assignmentId;
                  }
                } catch (apiErr) {
                  verifyId = assignmentId;
                }
              } else {
                verifyId = assignmentId;
              }
            }
            
            if (!verifyId) {
              setVerificationStatus({ message: 'ID задания не найден', isError: true });
              return;
            }
            const allLogs = allLogsSnapshot.length > 0 ? allLogsSnapshot : (() => {
              const currentState = store.getState() as RootState;
              const currentProject = currentState.project;
              return Array.isArray(currentProject?.logs) ? currentProject.logs : [];
            })();
            const newLogs = allLogs.slice(initialLogCount);
            if (newLogs.length === 0) {
              setVerificationStatus({ message: 'Нет данных для проверки. Запустите симуляцию.', isError: true });
              return;
            }
            const eventLogs = newLogs.filter((e: Record<string, unknown>) => e && typeof e === 'object' && (e as any).type === 'event');
            if (eventLogs.length === 0) {
              setVerificationStatus({ message: 'Логи не содержат событий симуляции.', isError: true });
              return;
            }
            const eventTypes = eventLogs.reduce((acc: Record<string, number>, e: Record<string, unknown>) => {
              const type = (e as any).name || 'unknown';
              acc[type] = (acc[type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            const normalizedLogs = eventLogs
              .map((e: Record<string, unknown>) => {
                const ev = e as any;
                if (ev.t) return ev;
                if (ev.name === 'led') return { t: 'led', id: ev.id, on: !!ev.on, b: Math.round(((ev.brightness ?? 0) as number) * 100) / 100 };
                if (ev.name === 'digitalWrite') return { t: 'dw', pin: ev.pin, v: ev.value ? 1 : 0 };
                if (ev.name === 'delay') return { t: 'del', ms: Number(ev.ms) || 0 };
                if (ev.name === 'button') return { t: 'btn', id: ev.id, p: !!ev.pressed };
                if (ev.name === 'loop') return { t: 'loop', phase: ev.phase, ms: ev.ms };
                return null;
              })
              .filter(Boolean);
            const normalizeEvents = (arr: Array<Record<string, unknown>>) => {
              const logs = Array.isArray(arr) ? arr : [];
              const loopStarts: number[] = [];
              const loopEnds: number[] = [];
              logs.forEach((e: Record<string, unknown>, i: number) => {
                const ev = e as any;
                if (ev && ev.t === 'loop') {
                  if (ev.phase === 'start') loopStarts.push(i);
                  if (ev.phase === 'end') loopEnds.push(i);
                }
              });
              if (loopStarts.length === 0 && loopEnds.length === 0) {
                logs.forEach((e: Record<string, unknown>, i: number) => {
                  const ev = e as any;
                  if (ev && ev.type === 'event' && ev.name === 'loop') {
                    if (ev.phase === 'start') loopStarts.push(i);
                    if (ev.phase === 'end') loopEnds.push(i);
                  }
                });
              }
              let slice: Array<Record<string, unknown>> = [];
              if (loopStarts.length > 0 && loopEnds.length > 0) {
                const firstStartIdx = loopStarts[0];
                const firstEndIdx = loopEnds.find(idx => idx > firstStartIdx);
                
                if (firstEndIdx !== undefined) {
                  slice = logs.slice(firstStartIdx + 1, firstEndIdx);
                  if (loopStarts.length > 1 || loopEnds.length > 1) {}
                } else {
                }
              } else {
                slice = logs;
              }
              
              const filtered = slice.filter((e: any) => e && e.t && e.t !== 'loop');
              return filtered;
            };
            
            const normalized = normalizeEvents(normalizedLogs);
            
            if (normalized.length === 0) {
              setVerificationStatus({ message: 'Не удалось нормализовать логи.', isError: true });
              return;
            }
            let data: { ok?: boolean; message?: string } | null = null;
            try {
              data = await apiPost<{ ok?: boolean; message?: string }>(`/api/assignments/${verifyId}/verify`, { logs: normalized });
            } catch (e: unknown) {
              const err = e as any;
              if (err?.status === 404) {
                data = await apiPost<{ ok?: boolean; message?: string }>(`/api/assignments/verify?id=${verifyId}`, { logs: normalized });
              } else {
                throw err;
              }
            }
            if (data?.ok) {
              setVerificationStatus({ message: 'Проверка: Верно!', isError: false });
            } else {
              setVerificationStatus({ message: `Проверка: Неверно${data?.message ? ` - ${data.message}` : ''}`, isError: true });
              setTimeout(() => {
                window.location.reload();
              }, 2000);
            }
            dispatch(stopSimulation());
            SimulatorAPI.stop(sessionId);
            await new Promise(resolve => setTimeout(resolve, 1000));
            dispatch(clearLogs());
            await new Promise(resolve => setTimeout(resolve, 300));
            dispatch(clearLogs());
            await new Promise(resolve => setTimeout(resolve, 300));
            let cleanupAttempts = 0;
            while (cleanupAttempts < 5) {
              const finalState = store.getState() as RootState;
              const finalProject = finalState.project;
              const remainingLogs = Array.isArray(finalProject?.logs) ? finalProject.logs : [];
              if (remainingLogs.length === 0) {
                break;
              }
              dispatch(clearLogs());
              await new Promise(resolve => setTimeout(resolve, 300));
              cleanupAttempts++;
            }
          } catch (err: unknown) {
            const e = err as { message?: string };
            setVerificationStatus({ message: e?.message || 'Ошибка проверки', isError: true });
            dispatch(stopSimulation());
            SimulatorAPI.stop(sessionId);
            await new Promise(resolve => setTimeout(resolve, 1000));
            dispatch(clearLogs());
            await new Promise(resolve => setTimeout(resolve, 300));
            dispatch(clearLogs());
            await new Promise(resolve => setTimeout(resolve, 300));
            let errorCleanupAttempts = 0;
            while (errorCleanupAttempts < 5) {
              const errorState = store.getState() as RootState;
              const errorProject = errorState.project;
              const errorLogs = Array.isArray(errorProject?.logs) ? errorProject.logs : [];
              if (errorLogs.length === 0) {
                break;
              }
              dispatch(clearLogs());
              await new Promise(resolve => setTimeout(resolve, 300));
              errorCleanupAttempts++;
            }
          } finally {
            setIsVerifying(false);
          }
        } : undefined}
      />
      {verificationStatus && (
        <div 
          style={{
            position: 'fixed',
            bottom: 80,
            right: 20,
            padding: '12px 20px',
            borderRadius: '8px',
            backgroundColor: verificationStatus.isError ? 'rgba(255, 87, 87, 0.95)' : 'rgba(76, 175, 80, 0.95)',
            color: 'white',
            zIndex: 10000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            cursor: isVerifying ? 'default' : 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'opacity 0.3s ease',
          }}
          onClick={() => {
            if (!isVerifying) {
              setVerificationStatus(null);
            }
          }}
        >
          {verificationStatus.message}
        </div>
      )}
      {propsModal.open && propsModal.componentId && (
        <PropertiesModal componentId={propsModal.componentId} onClose={() => setPropsModal({ open: false, componentId: null })} />
      )}
    </div>
  );
};
