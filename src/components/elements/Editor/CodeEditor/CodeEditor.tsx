'use client'

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { SimulatorAPI } from '@/lib/ws/client';
import CodeMirror from '@uiw/react-codemirror';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { cpp } from '@codemirror/lang-cpp';
import style from './CodeEditor.module.scss';
import './CodeMirrorCustom.css';
import { tags } from '@lezer/highlight';
import {
  File,
  CompileResult,
  PistonExecuteRequest,
  PistonExecuteResponse,
} from './types';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getHighlightStyle } from './CustomHighlight';
import { useThemeListener } from '@/components/hooks/useThemeListener';
import EditorMenu from '../EditorMenu/EditorMenu';
import { useAuth } from '@hooks/useAuth';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import { setUploadedCode, appendLog, clearLogs, resetProject } from '@/store/project/projectSlice';
import { getNormalizedBaseId, getBaseAssignmentId, getStorageKey } from '@lib';
import { apiGet, apiPost, apiPut } from '@api';

const CodeEditor = () => {
  const theme = useThemeListener();
  const dispatch = useDispatch();
  const { user, loading } = useAuth();
  const isStudent = !!user && user.role_id === 3;

  const extensions = useMemo(() => {
    return [cpp(), syntaxHighlighting(getHighlightStyle(theme))];
  }, [theme]);

  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rawAssignmentId = searchParams?.get('assignmentId');
  const teacherSessionId = !isStudent && user ? String(user.id) : null;
  const fallbackSessionId = 'global';
  const [sessionId, setSessionId] = useState<string>(rawAssignmentId || teacherSessionId || fallbackSessionId);
  const prevSessionRef = useRef<string | null>(null);
  const lastLoadKeyRef = useRef<string | null>(null);
  const filesLoadedRef = useRef<boolean>(false); // Track if files have been loaded to prevent overwriting
  const [resolvedAssignmentId, setResolvedAssignmentId] = useState<string | null>(null);
  const [normalizedBaseId, setNormalizedBaseId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  
  // STORAGE KEY: For students, create compositeId to isolate code even if URL has baseId
  // For teachers, use rawAssignmentId or teacherSessionId
  // This ensures students' code is isolated while URLs are simplified
  const getStorageKeyForAssignment = () => {
    if (isStudent && rawAssignmentId && user?.id && user?.group_id) {
      // For students: create compositeId from baseId + userId + groupId for isolation
      // This allows using baseId in URL while maintaining code isolation
      const userIdStr = String(user.id);
      const groupIdStr = String(user.group_id);
      const suffix = `${userIdStr}${groupIdStr}`;
      // Check if it's already a compositeId
      if (rawAssignmentId.endsWith(suffix) && rawAssignmentId.length > suffix.length) {
        return rawAssignmentId; // Already compositeId
      }
      // Create compositeId
      return `${rawAssignmentId}${userIdStr}${groupIdStr}`;
    }
    return rawAssignmentId || teacherSessionId || 'global';
  };
  
  const assignmentStorageKey = getStorageKeyForAssignment();
  
  // SIMULATION SESSION ID: Unique per user (student or teacher) for complete isolation
  // Format: assignmentId_userId to ensure each user has separate simulation
  // This is critical for multi-user scenarios on the same assignment
  // Teachers and students must NEVER share the same simulation session
  const getSimulationSessionId = () => {
    if (rawAssignmentId && user?.id) {
      // For both students and teachers: use assignmentId_userId format
      // This ensures complete isolation between all users
      // Format: assignment_<assignmentId>_user_<userId>
      return `assignment_${rawAssignmentId}_user_${user.id}`;
    }
    // Fallback: use teacherSessionId or global
    return teacherSessionId || 'global';
  };
  
  const simulationSessionId = getSimulationSessionId();
  const filesStorageKey = `editorFiles:${assignmentStorageKey}`;
  const currentFileStorageKey = `editorCurrentFile:${assignmentStorageKey}`;
  
  // Load files and currentFileName from sessionStorage IMMEDIATELY on mount or when assignment changes
  // Uses the same key format as updateAssignment: assignmentId || teacherSessionId || 'global'
  // This is the PRIMARY loading mechanism - it should run first and set all state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Use the same key format as MenuEditor.handleUpdateAssignment
    const sessionKey = rawAssignmentId || teacherSessionId || 'global';
    const filesKey = `editorFiles:${sessionKey}`;
    const currentFileKey = `editorCurrentFile:${sessionKey}`;
    const loadKey = `${sessionKey}-${filesKey}`;
    
    // Reset loaded flag if assignment changed (but only if we have files in state)
    if (lastLoadKeyRef.current !== loadKey) {
      // Only reset if we don't have files in state yet
      if (files.length === 0) {
        filesLoadedRef.current = false;
      } else {
        // If we have files, keep the loaded flag to prevent overwriting
      }
    }
    
    // Prevent multiple loads for the same assignment
    if (lastLoadKeyRef.current === loadKey && filesLoadedRef.current) {
      return;
    }
    
    // If we already have files in state, don't reload (prevent overwriting)
    if (files.length > 0 && filesLoadedRef.current) {
      setStorageLoaded(true);
      return;
    }
    
    
    
    try {
      // Load files - try primary key first, then fallback to 'editorFiles' for global
      let saved = sessionStorage.getItem(filesKey);
      if (!saved && sessionKey === 'global') {
        saved = sessionStorage.getItem('editorFiles');
      }
      
      
      
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Check if files have content - if all files are empty, treat as not found
          const hasContent = parsed.some(f => f.content && f.content.trim().length > 0);
          
          
          
          // Load current file name - try primary key first, then fallback
          let savedCurrent = sessionStorage.getItem(currentFileKey);
          if (!savedCurrent && sessionKey === 'global') {
            savedCurrent = sessionStorage.getItem('editorCurrentFile') || 'task.ino';
          }
          
          const finalCurrentFileName = savedCurrent || parsed[0]?.name || 'task.ino';
          
          // Set files and currentFileName immediately
          setFiles(parsed);
          setCurrentFileName(finalCurrentFileName);
          filesLoadedRef.current = true;
          lastLoadKeyRef.current = loadKey;
          
          // Also sync Redux with the loaded code
          const currentFile = parsed.find(f => f.name === finalCurrentFileName) || parsed[0];
          if (currentFile) {
            if (currentFile.content) {
              dispatch(setUploadedCode(currentFile.content));
            }
          }
          
          setStorageLoaded(true);
          return;
        } else {}
      } else {}
      
      // Only create empty file if we haven't loaded anything yet
      if (!filesLoadedRef.current) {
        
        // If no files found, create empty file initially (like scheme editor)
        const routeFileName = params?.path && typeof params.path === 'string' ? params.path : 'task.ino';
        const finalFileName = routeFileName.toLowerCase().endsWith('.ino') ? routeFileName : `${routeFileName}.ino`;
        
        // Create empty file initially
        const initialFile: File = { id: `${Date.now()}`, name: finalFileName, content: '', language: 'cpp' };
        setFiles([initialFile]);
        setCurrentFileName(finalFileName);
        filesLoadedRef.current = true;
        lastLoadKeyRef.current = loadKey;
        
        // Save initial empty file to sessionStorage using the same key format
        try {
          sessionStorage.setItem(filesKey, JSON.stringify([initialFile]));
          sessionStorage.setItem(currentFileKey, finalFileName);
        } catch (err) {}
      }
      
      setStorageLoaded(true);
    } catch (err) {
      setStorageLoaded(true);
    }
  }, [rawAssignmentId, teacherSessionId, params?.path, dispatch]);
  
  // Нормализуем базовый ID для синхронизации между редакторами
  useEffect(() => {
    const normalizeId = async () => {
      // Для teacherSessionId используем его как storageKey для синхронизации
      if (rawAssignmentId === teacherSessionId || (!rawAssignmentId && teacherSessionId)) {
        setNormalizedBaseId(teacherSessionId);
        return;
      }
      
      if (!rawAssignmentId || rawAssignmentId === fallbackSessionId) {
        setNormalizedBaseId(null);
        return;
      }
      
      // Быстрая проверка - если это просто число и не compositeId
      const quickBaseId = getBaseAssignmentId(rawAssignmentId, user);
      if (quickBaseId && quickBaseId === rawAssignmentId) {
        setNormalizedBaseId(quickBaseId);
        return;
      }
      
      // Для compositeId или кастомного ID - нормализуем
      const baseId = await getNormalizedBaseId(rawAssignmentId, user);
      setNormalizedBaseId(baseId);
    };
    normalizeId();
  }, [rawAssignmentId, user, teacherSessionId, fallbackSessionId]);
  
  // Используем нормализованный базовый ID для sessionStorage
  // Для teacherSessionId используем его напрямую для синхронизации между редакторами
  const storageKey = getStorageKey(normalizedBaseId, sessionId);
  
  useEffect(() => {}, [storageKey, normalizedBaseId, sessionId, rawAssignmentId, teacherSessionId, pathname]);

  useEffect(() => {
    if (!isStudent && teacherSessionId && !rawAssignmentId && user) {
      router.replace(`${pathname}?assignmentId=${teacherSessionId}`);
    }
  }, [rawAssignmentId, isStudent, teacherSessionId, user, router, pathname]);

  useEffect(() => {
    const targetSession = rawAssignmentId ?? (teacherSessionId ?? fallbackSessionId);
    setSessionId((prev) => (prev === targetSession ? prev : targetSession));
  }, [rawAssignmentId, teacherSessionId]);

  // Note: We removed the effect that was resetting storageLoaded when storageKey changed
  // This was causing issues where saved code wasn't being loaded properly
  // The Load effect below handles loading when storageKey changes

  useEffect(() => {
    const resolveId = async () => {
    if (!rawAssignmentId) {
      setResolvedAssignmentId(null);
      return;
    }
    if (teacherSessionId && rawAssignmentId === teacherSessionId) {
      setResolvedAssignmentId(null);
      return;
    }
    if (rawAssignmentId === fallbackSessionId) {
      setResolvedAssignmentId(null);
      return;
    }
      
      // Сначала проверяем mapping в sessionStorage
    const mapping = sessionStorage.getItem(`assignmentMapping:${rawAssignmentId}`);
    if (mapping) {
      setResolvedAssignmentId(mapping);
      return;
    }
      
      // Если это просто число, это может быть:
      // 1. Базовый ID из базы данных (например, 39) - используем как есть
      // 2. Кастомный ID (например, 409112025142023) - нужно получить базовый ID через API
    if (/^\d+$/.test(rawAssignmentId)) {
        // Пробуем определить, это базовый ID или кастомный
        // Кастомные ID обычно очень длинные (больше 10 цифр)
        if (rawAssignmentId.length > 10) {
          // Вероятно кастомный ID - пробуем получить базовый ID через API
      try {
            const apiData = await apiGet<{ assignment?: { id?: number } }>(`/api/assignments/${rawAssignmentId}`);
            if (apiData?.assignment?.id) {
                const dbId = String(apiData.assignment.id);
                setResolvedAssignmentId(dbId);
                // Сохраняем mapping
                sessionStorage.setItem(`assignmentMapping:${rawAssignmentId}`, dbId);
                return;
            }
          } catch (err) {}
        }
        
        // Если это короткий ID или API не помог, используем как есть
        // Это может быть базовый ID из базы данных
      setResolvedAssignmentId(rawAssignmentId);
    } else {
      setResolvedAssignmentId(null);
    }
    };
    
    resolveId();
  }, [rawAssignmentId, storageLoaded, teacherSessionId, fallbackSessionId]);

  const [currentFileName, setCurrentFileName] = useState<string>('');
  
  // Note: currentFileName is now set in the initial load effect above
  // This ensures it's loaded together with files from sessionStorage
  
  // Helper function to save files to sessionStorage
  // Uses the same key format as updateAssignment: assignmentId || teacherSessionId || 'global'
  // This ensures code is saved with the same key that updateAssignment reads from
  const saveFilesToStorage = (filesToSave: File[], fileName?: string) => {
    try {
      // Use the same key format as MenuEditor.handleUpdateAssignment
      // sessionKey = assignmentId || teacherIdParam
      const sessionKey = rawAssignmentId || teacherSessionId || 'global';
      const currentFilesKey = `editorFiles:${sessionKey}`;
      const currentFileKey = `editorCurrentFile:${sessionKey}`;
      
      // Always save files array (even if empty) to preserve state
      const filesJson = JSON.stringify(filesToSave);
      sessionStorage.setItem(currentFilesKey, filesJson);
      
      const fileNameToSave = fileName || currentFileName || 'task.ino';
      sessionStorage.setItem(currentFileKey, fileNameToSave);
      
      
    } catch (err) {}
  };

  // PERSIST CODE: Save files continuously whenever they change (like scheme editor does)
  // This is the PRIMARY save mechanism - saves on every change
  useEffect(() => {
    if (files.length > 0) {
      const sessionKey = rawAssignmentId || teacherSessionId || 'global';
      const filesKey = `editorFiles:${sessionKey}`;
      const currentFileKey = `editorCurrentFile:${sessionKey}`;
      
      try {
        const filesJson = JSON.stringify(files);
        sessionStorage.setItem(filesKey, filesJson);
        if (currentFileName) {
          sessionStorage.setItem(currentFileKey, currentFileName);
        }
        
        // Verify save worked (no logging)
        void sessionStorage.getItem(filesKey);
      } catch (err) {}
    }
  }, [files, rawAssignmentId, teacherSessionId, currentFileName]);

  // CRITICAL: Save code when pathname changes (switching between code/scheme pages)
  // This ensures code is saved BEFORE component unmounts (like scheme editor does)
  // Must run BEFORE any cleanup effects
  useLayoutEffect(() => {
    if (files.length > 0) {
      const sessionKey = rawAssignmentId || teacherSessionId || 'global';
      const filesKey = `editorFiles:${sessionKey}`;
      const currentFileKey = `editorCurrentFile:${sessionKey}`;
      
      try {
        // Save SYNCHRONOUSLY before navigation
        const filesJson = JSON.stringify(files);
        sessionStorage.setItem(filesKey, filesJson);
        if (currentFileName) {
          sessionStorage.setItem(currentFileKey, currentFileName);
        }
        
        // Verify save worked - retry if needed (silent)
        const verify = sessionStorage.getItem(filesKey);
        if (!verify || verify !== filesJson) {
          sessionStorage.setItem(filesKey, filesJson);
          if (currentFileName) {
            sessionStorage.setItem(currentFileKey, currentFileName);
          }
        }
      } catch (err) {}
    }
  }, [pathname, rawAssignmentId, teacherSessionId, files, currentFileName]);

  // File is created initially in the initial load effect if not found in sessionStorage

  const [output, setOutput] = useState<string>('');
  const [editorLoading, setEditorLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [compilationSuccess, setCompilationSuccess] = useState<boolean>(false);

  const currentFile = files.find((file) => file.name === currentFileName);

  // Присоединяемся к сессии симуляции при монтировании
  // Используем уникальный sessionId для каждого пользователя (студент или преподаватель) для полной изоляции
  useEffect(() => {
    if (simulationSessionId) {
      SimulatorAPI.joinSession(simulationSessionId);
    }
  }, [simulationSessionId, user?.id, isStudent]);

  // Logs subscription (for assignment verification)
  // Only collect events (type: 'event') to avoid spam and duplicates
  const project = useSelector((s: RootState) => s.project);
  const isSimulationRunning = useSelector((s: RootState) => s.project?.isSimulationRunning);
  
  // Use ref to track if we should collect logs
  // This is set to true when simulation starts and false when it finishes
  const shouldCollectLogsRef = useRef(false);
  
  // Update shouldCollectLogsRef when simulation state changes
  useEffect(() => {
    // When simulation starts running, enable log collection
    if (isSimulationRunning) {
      shouldCollectLogsRef.current = true;
    } else {
      shouldCollectLogsRef.current = false;
    }
  }, [isSimulationRunning]);
  
  useEffect(() => {
    const onLog = (m: Record<string, unknown>) => {
      // CRITICAL: Only add logs if we're actively collecting
      // This prevents stale logs from being added after simulation stops
      if (!shouldCollectLogsRef.current) {
        return;
      }
      
      // Only save events for verification - ignore regular log messages
      // Events can come in two formats:
      // 1. Wrapped: { type: 'log', message: { type: 'event', name: 'digitalWrite', ... } }
      // 2. Direct: { type: 'event', name: 'loop', phase: 'start', ... }
      if (m && typeof m === 'object') {
        const mm = m as Record<string, unknown> & { type?: string; message?: unknown };
        if (mm.type === 'event') {
          // Direct event - save as is (only events, no regular logs)
          dispatch(appendLog(mm as unknown as Record<string, unknown>));
        } else if (mm.message && typeof mm.message === 'object' && (mm.message as any).type === 'event') {
          // Wrapped event - extract the message (only events)
          dispatch(appendLog(mm.message as Record<string, unknown>));
        }
        // Ignore all other messages (regular logs, strings, etc.) to prevent spam
      }
      // Ignore string messages - we only need structured events
    };
    const onStart = () => {
      shouldCollectLogsRef.current = true;
      dispatch(clearLogs());
    };
    const onFinish = () => {
      shouldCollectLogsRef.current = false;
    };
    SimulatorAPI.onLog(onLog);
    SimulatorAPI.onSimulationStarted(onStart);
    SimulatorAPI.onSimulationFinished(onFinish);
    
    // Cleanup: remove listeners when component unmounts
    return () => {
      // Note: Socket.IO listeners are persistent, but we've added guards in onLog
      shouldCollectLogsRef.current = false;
    };
  }, [dispatch]);

  // File is now created automatically when user starts typing in updateCurrentFileContent

  // OLD COMPLEX LOAD EFFECT REMOVED - using simple load effect above instead

  // If nothing in storage for this assignment, load from API
  // Only load from API if we don't have files in sessionStorage
  // This effect runs AFTER the load effect to avoid overwriting saved code
  // IMPORTANT: For new assignments (rawAssignmentId === teacherSessionId), skip API load
  useEffect(() => {
    const bootstrapFromApi = async () => {
      
      
      // For new assignments (where teacher is creating), don't load from API
      // The assignment doesn't exist in the database yet
      const isNewAssignment = !isStudent && rawAssignmentId === teacherSessionId;
      if (isNewAssignment) {
        return;
      }
      
      const canUseRaw = rawAssignmentId && rawAssignmentId !== teacherSessionId && rawAssignmentId !== fallbackSessionId;
      const fetchId = resolvedAssignmentId ?? (canUseRaw ? rawAssignmentId : null);
      if (!fetchId) {
        return;
      }
      if (!storageLoaded) {
        return;
      }
      
      // Check if we have files in sessionStorage - use simple key
      let hasSavedFiles = false;
      try {
        const saved = sessionStorage.getItem(filesStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            hasSavedFiles = true;
          }
        }
      } catch {}
      
      
      
      // Don't load from API if we already have files (either in state or sessionStorage)
      if (files.length > 0 || hasSavedFiles) {
        return;
      }
      
      try {
        const data = await apiGet<{ assignment?: Record<string, unknown> }>(`/api/assignments/${fetchId}`);
        const a = data?.assignment;
        if (!a) {
          return;
        }
        if (!resolvedAssignmentId && canUseRaw && (a as any).id) {
          try {
            sessionStorage.setItem(`assignmentMapping:${rawAssignmentId}`, String((a as any).id));
          } catch {}
          setResolvedAssignmentId(String((a as any).id));
        }
        // For teachers: load code and schema from assignment
        // For students: never load code, only schema if show_schema is true
        if (!isStudent) {
        const aObj = a as Record<string, unknown> & { code?: string; schema_json?: unknown; parent_id?: unknown; assignment_id?: unknown; id?: unknown };
        if (!aObj.code && (aObj.parent_id || aObj.assignment_id)) {
          const originalId = aObj.parent_id || aObj.assignment_id;
          try {
            const d2 = await apiGet<{ assignment?: Record<string, unknown> }>(`/api/assignments/${originalId}`);
            if (d2?.assignment) {
              (d2.assignment as any).code && (aObj.code = (d2.assignment as any).code as string);
              (d2.assignment as any).schema_json && (aObj.schema_json = (d2.assignment as any).schema_json);
            }
          } catch {}
        }
          // Save schema to sessionStorage for scheme editor
          if (aObj.schema_json) {
            try {
              let schemaData = aObj.schema_json;
              if (typeof schemaData === 'string') {
                schemaData = JSON.parse(schemaData);
              }
              const schemeKey = `scheme:${storageKey}`;
              sessionStorage.setItem(schemeKey, JSON.stringify(schemaData));
            } catch {}
          }
        }
        const initialName = (params && params.path && typeof params.path === 'string') ? String(params.path) : 'task.ino';
        let name = initialName.toLowerCase().endsWith('.ino') ? initialName : `${initialName}.ino`;
        const codeContent = isStudent ? '' : (typeof (a as any).code === 'string' ? (a as any).code as string : '');
        const file: File = { id: `${Date.now()}`, name, content: codeContent, language: 'cpp' };
        setFiles([file]);
        setCurrentFileName(name);
        // Save to sessionStorage immediately using simple key
        try {
          sessionStorage.setItem(filesStorageKey, JSON.stringify([file]));
          sessionStorage.setItem(currentFileStorageKey, name);
        } catch {}
      } catch (err) {}
    };
    bootstrapFromApi();
  }, [resolvedAssignmentId, rawAssignmentId, teacherSessionId, storageLoaded, files.length, params?.path, fallbackSessionId, isStudent, filesStorageKey, currentFileStorageKey]);

  // Save code before component unmounts or page unloads
  // Using useLayoutEffect to ensure synchronous save before unmount
  // CRITICAL: This must save BEFORE any cleanup effects run
  // Save on EVERY files change to ensure code is always persisted
  // BUT: Don't save when creating a new assignment (no assignmentId in URL) - let MenuEditor handle it
  useLayoutEffect(() => {
    // Don't save if we're creating a new assignment (no assignmentId in URL)
    // When creating assignment, MenuEditor.handleCreateAssignment will save the code with the new assignmentId
    // We check !rawAssignmentId because when creating new assignment, there's no assignmentId in URL yet
    const isCreatingNewAssignment = !rawAssignmentId;
    if (isCreatingNewAssignment) {
      return;
    }
    
    // Save immediately when files change (before unmount)
    if (files.length > 0) {
      const sessionKey = rawAssignmentId || teacherSessionId || 'global';
      const filesKey = `editorFiles:${sessionKey}`;
      const currentFileKey = `editorCurrentFile:${sessionKey}`;
      
      try {
        // Save SYNCHRONOUSLY - this runs before cleanup
        const filesJson = JSON.stringify(files);
        sessionStorage.setItem(filesKey, filesJson);
        if (currentFileName) {
          sessionStorage.setItem(currentFileKey, currentFileName);
        }
        
        // Verify save worked - retry if needed (silent)
        const verify = sessionStorage.getItem(filesKey);
        if (!verify || verify !== filesJson) {
          sessionStorage.setItem(filesKey, filesJson);
          if (currentFileName) {
            sessionStorage.setItem(currentFileKey, currentFileName);
          }
        }
      } catch (err) {}
    }
    
    const saveCodeBeforeUnload = () => {
      // Don't save if we're creating a new assignment (no assignmentId in URL)
      const isCreatingNewAssignment = !rawAssignmentId;
      if (isCreatingNewAssignment) {
        return;
      }
      
      if (files.length > 0) {
        const sessionKey = rawAssignmentId || teacherSessionId || 'global';
        const filesKey = `editorFiles:${sessionKey}`;
        const currentFileKey = `editorCurrentFile:${sessionKey}`;
        
        try {
          // Save SYNCHRONOUSLY on page unload
          const filesJson = JSON.stringify(files);
          sessionStorage.setItem(filesKey, filesJson);
          if (currentFileName) {
            sessionStorage.setItem(currentFileKey, currentFileName);
          }
        } catch (err) {}
      }
    };

    window.addEventListener('beforeunload', saveCodeBeforeUnload);
    return () => {
      // Save synchronously on component unmount (when switching pages)
      // This runs AFTER the save above, so it's a backup
      // But skip if creating new assignment (no assignmentId in URL)
      const isCreatingNewAssignment = !rawAssignmentId;
      if (!isCreatingNewAssignment) {
        saveCodeBeforeUnload();
      }
      window.removeEventListener('beforeunload', saveCodeBeforeUnload);
    };
  }, [files, rawAssignmentId, teacherSessionId, currentFileName]);

  // Cleanup sessionStorage when exiting editor (but not when switching between code/scheme editors)
  // IMPORTANT: Do NOT cleanup when switching between /editor/code and /editor/scheme
  useEffect(() => {
    if (!pathname?.startsWith('/editor/code') && !pathname?.startsWith('/editor/scheme')) {
      try {
        // Only cleanup when completely leaving editor area
        // Use the same key format as save: rawAssignmentId || teacherSessionId || 'global'
        const sessionKey = rawAssignmentId || teacherSessionId || 'global';
        // Don't cleanup teacher sessions (new assignments) - they need to persist
        if (sessionKey !== teacherSessionId || !teacherSessionId) {
          const filesKey = `editorFiles:${sessionKey}`;
          const currentFileKey = `editorCurrentFile:${sessionKey}`;
          sessionStorage.removeItem(filesKey);
          sessionStorage.removeItem(currentFileKey);
          sessionStorage.removeItem(`scheme:${sessionKey}`);
        }
      } catch {}
    }
  }, [pathname, rawAssignmentId, teacherSessionId]);

  // Keep Redux in sync with current code (for teacher/editor flows)
  // This runs when the user edits code, but NOT during initial load (handled in initial load effect)
  // Also save to sessionStorage when Redux updates (like scheme editor does)
  useEffect(() => {
    if (!currentFile || !storageLoaded) return; // Don't sync during initial load
    
    // Sync Redux
    dispatch(setUploadedCode(currentFile.content));
    
    // Also save to sessionStorage when code changes (like scheme editor does)
    const sessionKey = rawAssignmentId || teacherSessionId || 'global';
    const filesKey = `editorFiles:${sessionKey}`;
    const currentFileKey = `editorCurrentFile:${sessionKey}`;
    
    try {
      // Update files array with current content
      const updatedFiles = files.map(f => 
        f.name === currentFileName ? { ...f, content: currentFile.content } : f
      );
      
      sessionStorage.setItem(filesKey, JSON.stringify(updatedFiles));
      if (currentFileName) {
        sessionStorage.setItem(currentFileKey, currentFileName);
      }
      
      
    } catch (err) {
      console.error('[CodeEditor] Error saving via Redux sync:', err);
    }
  }, [currentFile?.content, currentFileName, dispatch, storageLoaded, files, rawAssignmentId, teacherSessionId]);

  // OLD COMPLEX SAVE EFFECTS REMOVED - using simple save effect above instead

  // Save assignment modal state
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showSchema, setShowSchema] = useState(true);
  const [saving, setSaving] = useState(false);

  const openSave = () => setIsSaveOpen(true);
  const closeSave = () => { if (!saving) { setIsSaveOpen(false); } };
  const saveAssignment = async () => {
    if (!currentFile) return;
    setSaving(true);
    try {
      // Get schema from sessionStorage if Redux is empty, otherwise use Redux
      let schema_json: unknown = null;
      try {
        const schemeKey = `scheme:${storageKey}`;
        const savedScheme = sessionStorage.getItem(schemeKey);
        if (savedScheme) {
          schema_json = JSON.parse(savedScheme);
        } else if (project.components && project.components.length > 0) {
          schema_json = {
        components: project.components,
        wires: project.wires,
        viewport: project.viewport,
      };
        } else {
          // Try to get from sessionStorage with fallback
          const fallbackKey = `scheme:${rawAssignmentId || storageKey}`;
          const fallbackScheme = sessionStorage.getItem(fallbackKey);
          if (fallbackScheme) {
            schema_json = JSON.parse(fallbackScheme);
          }
        }
      } catch {}
      
      // If still no schema, use Redux as fallback
      const hasSchema = (v: unknown): v is { components: unknown[]; wires: unknown[]; viewport?: unknown } => {
        return !!v && typeof v === 'object' && Array.isArray((v as any).components) && Array.isArray((v as any).wires);
      };
      if (!hasSchema(schema_json)) {
        schema_json = {
          components: project.components || [],
          wires: project.wires || [],
          viewport: project.viewport || { zoom: 1, offset: { x: 0, y: 0 } },
        };
      }
      // Normalize expected logs to single loop iteration canonical format
      // This matches the normalization logic in the verification API
      // If teacher uses a loop, we extract the first complete loop iteration
      // If teacher does it without loop, we use all events
      const rawLogs = Array.isArray(project.logs) ? project.logs : [];
      
      
      
      // Find all loop iterations
      const loopStarts: number[] = [];
      const loopEnds: number[] = [];
      rawLogs.forEach((e: Record<string, unknown>, i: number) => {
        if (e && e.type === 'event' && e.name === 'loop') {
          if (e.phase === 'start') loopStarts.push(i);
          if (e.phase === 'end') loopEnds.push(i);
        }
      });
      
      
      
      // If we have loop iterations, extract events from the first complete loop
      let slice: Array<Record<string, unknown>> = [];
      if (loopStarts.length > 0 && loopEnds.length > 0) {
        // Find first complete loop (start before end)
        for (let i = 0; i < loopStarts.length; i++) {
          const startIdx = loopStarts[i];
          const endIdx = loopEnds.find(idx => idx > startIdx);
          if (endIdx !== undefined) {
            slice = rawLogs.slice(startIdx + 1, endIdx);
            
            break; // Use first complete loop
          }
        }
      } else {
        // No loops found - check if this contains multiple iterations
        // This handles cases where loop markers are missing but pattern repeats
        if (rawLogs.length > 0) {
          // First, normalize the raw logs to check for patterns
          const normalizedForCheck = rawLogs
            .filter((e) => e && (e as any).type === 'event')
            .map((e: Record<string, unknown>) => {
              const ev = e as any;
              if (ev.name === 'led') return { t: 'led', id: ev.id, on: !!ev.on, b: Math.round(((ev.brightness ?? 0) as number) * 100) / 100 };
              if (ev.name === 'digitalWrite') return { t: 'dw', pin: ev.pin, v: ev.value ? 1 : 0 };
              if (ev.name === 'delay') return { t: 'del', ms: Number(ev.ms) || 0 };
              if (ev.name === 'button') return { t: 'btn', id: ev.id, p: !!ev.pressed };
              return null;
            })
            .filter(Boolean);
          
          if (normalizedForCheck.length >= 12) {
            // Check for repeating patterns in normalized logs
            const eventSignatures = normalizedForCheck.map((e: any) => {
              if (e?.t === 'led') return `led:${e.id}:${e.on ? 'on' : 'off'}:${e.b || 0}`;
              if (e?.t === 'dw') return `dw:${e.pin}:${e.v}`;
              if (e?.t === 'del') return `del:${e.ms}`;
              return null;
            }).filter(Boolean);
            
            // Try exact pattern matching
            let cycleLength = 0;
            for (const candidate of [6, 4, 8, 10, 12]) {
              if (normalizedForCheck.length >= candidate * 2) {
                const firstCycle = eventSignatures.slice(0, candidate);
                const secondCycle = eventSignatures.slice(candidate, candidate * 2);
                if (JSON.stringify(firstCycle) === JSON.stringify(secondCycle)) {
                  cycleLength = candidate;
                  break;
                }
              }
            }
            
            // If no exact match, check for grouped events (e.g., 6x LED on, 6x delay)
            if (cycleLength === 0) {
              const uniqueSigs = new Map<string, number>();
              for (let i = 0; i < normalizedForCheck.length; i++) {
                const sig = eventSignatures[i];
                if (sig && !uniqueSigs.has(sig)) {
                  uniqueSigs.set(sig, i);
                }
              }
              
              const numUnique = uniqueSigs.size;
              if (numUnique >= 4 && numUnique <= 12 && normalizedForCheck.length >= numUnique * 2) {
                // Extract first occurrence of each unique event type
                // The indices in uniqueSigs are indices into normalizedForCheck
                // We need to map them back to rawLogs indices
                const firstOccurrences = Array.from(uniqueSigs.entries())
                  .sort((a, b) => a[1] - b[1])
                  .map(([sig, normalizedIdx]) => normalizedIdx);
                
                // Map normalized indices back to raw log indices
                // Build a map: normalized index -> raw log index
            const rawEvents = rawLogs.filter((e: Record<string, unknown>) => e && (e as any).type === 'event');
                if (rawEvents.length >= numUnique && firstOccurrences.every(idx => idx < rawEvents.length)) {
                  // Use the first occurrence indices directly on rawEvents
                  slice = firstOccurrences.map(idx => rawEvents[idx]);
                  
                } else {
                  // Fallback: use first N raw events where N is numUnique
                  if (rawEvents.length >= numUnique) {
                    slice = rawEvents.slice(0, numUnique);
                    
                  } else {
                    slice = rawLogs;
                  }
                }
              } else {
                // No clear pattern - use all events
                slice = rawLogs;
                
              }
            } else {
              // Found exact pattern match - extract first cycleLength events from raw logs
              const rawEvents = rawLogs.filter((e: Record<string, unknown>) => e && (e as any).type === 'event');
              if (rawEvents.length >= cycleLength) {
                slice = rawEvents.slice(0, cycleLength);
              } else {
                slice = rawLogs;
              }
            }
          } else {
            // Too few events - use all
            slice = rawLogs;
          }
        } else {
          slice = rawLogs;
        }
      }
      
      const expectedNormalized = slice
        .filter((e: Record<string, unknown>) => e && (e as any).type === 'event')
        .map((e: Record<string, unknown>) => {
          const ev = e as any;
          if (ev.name === 'led') return { t: 'led', id: ev.id, on: !!ev.on, b: Math.round(((ev.brightness ?? 0) as number) * 100) / 100 };
          if (ev.name === 'digitalWrite') return { t: 'dw', pin: ev.pin, v: ev.value ? 1 : 0 };
          if (ev.name === 'delay') return { t: 'del', ms: Number(ev.ms) || 0 };
          if (ev.name === 'button') return { t: 'btn', id: ev.id, p: !!ev.pressed };
          return null;
        })
        .filter(Boolean);
      
      
      let customAssignmentId: string | null = null;
      if (!isStudent && !resolvedAssignmentId) {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear());
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        customAssignmentId = `${user?.id ?? ''}${day}${month}${year}${hours}${minutes}${seconds}`;
      }

      const payload: Record<string, unknown> = {
        title,
        description,
        show_schema: showSchema,
        code: currentFile.content,
        schema_json,
        expected_logs: expectedNormalized,
      };
      if (customAssignmentId) {
        payload.assignment_id = customAssignmentId;
      } else if (rawAssignmentId) {
        payload.assignment_id = rawAssignmentId;
      }
      const isCreateOperation = !isStudent && !resolvedAssignmentId;
      const data = !isCreateOperation && resolvedAssignmentId
        ? await apiPut<{ success?: boolean; error?: string; assignment?: { id?: number } }>(`/api/assignments/${resolvedAssignmentId}`, payload)
        : await apiPost<{ success?: boolean; error?: string; assignment?: { id?: number } }>(`/api/assignments`, payload);
      if (!data?.success) {
        setError(data?.error || 'Не удалось сохранить задание');
      } else {
        try {
          if (isCreateOperation) {
            const dbId = data?.assignment?.id ? String(data.assignment.id) : null;
            if (dbId) {
              // CRITICAL: Create mapping from custom ID to database ID
              // This ensures that when student opens assignment with custom ID, 
              // we can resolve it to the correct database ID for verification
              const baseId = customAssignmentId ?? dbId;
              
              // Create mapping: customId -> dbId (for verification)
              if (customAssignmentId) {
                sessionStorage.setItem(`assignmentMapping:${customAssignmentId}`, dbId);
                
              }
              
              // Also create reverse mapping: dbId -> dbId (for direct access)
              sessionStorage.setItem(`assignmentMapping:${dbId}`, dbId);
              
              const key = `editorFiles:${baseId}`;
              const keyCur = `editorCurrentFile:${baseId}`;
              const filesToSave = files.length
                ? files
                : [{ id: `${Date.now()}`, name: currentFileName || 'task.ino', content: currentFile.content, language: 'cpp' }];
              sessionStorage.setItem(key, JSON.stringify(filesToSave));
              sessionStorage.setItem(keyCur, currentFileName || 'task.ino');
              try {
                const schemeSourceKey = rawAssignmentId ? `scheme:${rawAssignmentId}` : 'scheme:global';
                const schemeData = sessionStorage.getItem(schemeSourceKey);
                if (schemeData) {
                  sessionStorage.setItem(`scheme:${baseId}`, schemeData);
                }
              } catch {}
              // Clear redux project/code after saving
              try { dispatch(resetProject()); dispatch(setUploadedCode(null)); } catch {}
              
              // Redirect to assignment using custom ID if available, otherwise use dbId
              // This ensures URL consistency
              const redirectId = customAssignmentId || dbId;
              window.location.href = `/editor/code/${encodeURIComponent(currentFileName || 'task.ino')}?assignmentId=${redirectId}`;
              return;
            }
          } else if (resolvedAssignmentId) {
            const filesKey = `editorFiles:${rawAssignmentId ?? resolvedAssignmentId}`;
            const curKey = `editorCurrentFile:${rawAssignmentId ?? resolvedAssignmentId}`;
            const filesToSave = files.length
              ? files
              : [{ id: `${Date.now()}`, name: currentFileName || 'task.ino', content: currentFile.content, language: 'cpp' }];
            sessionStorage.setItem(filesKey, JSON.stringify(filesToSave));
            sessionStorage.setItem(curKey, currentFileName || 'task.ino');
            if ((rawAssignmentId ?? resolvedAssignmentId) === fallbackSessionId) {
              sessionStorage.setItem('editorFiles', JSON.stringify(filesToSave));
              sessionStorage.setItem('editorCurrentFile', currentFileName || 'task.ino');
            }
          }
        } catch {}
        setOutput('Задание сохранено');
        setIsSaveOpen(false);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка сохранения задания';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const compileCode = async () => {
    if (!currentFile) return;
    setEditorLoading(true);
    setError('');
    setOutput('');
    setCompilationSuccess(false); // Reset success status
    SimulatorAPI.compile(currentFile.content, (r) => {
      setEditorLoading(false);
      if (r.success) {
        setOutput('✅ Compilation successful!');
        setCompilationSuccess(true);
      } else {
        setError(r.errors?.join('\n') || 'Compilation failed');
        setCompilationSuccess(false);
      }
    });
  };

  const clearOutput = () => {
    setOutput('');
    setError('');
  };

  const uploadToController = () => {
    if (!currentFile) return;
    if (!compilationSuccess) {
      setError('Сначала необходимо успешно скомпилировать код');
      return;
    }
    dispatch(setUploadedCode(currentFile.content));
    // Don't clear logs here - they will be cleared when simulation starts
    // This ensures logs are available if student checks without restarting simulation
    setOutput('Загрузка кода в контроллер...');
    setError('');
    SimulatorAPI.upload(currentFile.content, simulationSessionId);
    const ack = (_m: unknown) => {
      setOutput('Код загружен в виртуальный контроллер');
    };
    SimulatorAPI.onUploadAck(ack);
  };

  // Reset compilation success when code changes
  useEffect(() => {
    if (currentFile?.content) {
      setCompilationSuccess(false);
    }
  }, [currentFile?.content]);

  const updateCurrentFileContent = (newContent: string) => {
    // Save synchronously on every keystroke (like scheme editor does)
    const sessionKey = rawAssignmentId || teacherSessionId || 'global';
    const filesKey = `editorFiles:${sessionKey}`;
    const currentFileKey = `editorCurrentFile:${sessionKey}`;
    
    setFiles((prevFiles) => {
      // File should already exist (created initially), but if not, create it
      if (prevFiles.length === 0) {
        const routeFileName = params?.path && typeof params.path === 'string' ? params.path : 'task.ino';
        let fileName = routeFileName.toLowerCase().endsWith('.ino') ? routeFileName : `${routeFileName}.ino`;
        const newFile: File = { id: `${Date.now()}`, name: fileName, content: newContent, language: 'cpp' };
        
        // Set current file name
        setCurrentFileName(fileName);
        
        // Save SYNCHRONOUSLY to sessionStorage immediately (like scheme editor)
        try {
          sessionStorage.setItem(filesKey, JSON.stringify([newFile]));
          sessionStorage.setItem(currentFileKey, fileName);
        } catch (err) {}
        
        return [newFile];
      }
      
      // Update existing file
      const next = prevFiles.map((file) =>
        file.name === currentFileName ? { ...file, content: newContent } : file
      );
      
      // Save SYNCHRONOUSLY to sessionStorage immediately (like scheme editor does)
      // CRITICAL: Save multiple times to ensure it persists
      try {
        const filesJson = JSON.stringify(next);
        const fileNameToSave = currentFileName || 'task.ino';
        
        // Save immediately
        sessionStorage.setItem(filesKey, filesJson);
        sessionStorage.setItem(currentFileKey, fileNameToSave);
        
        // Note: Redux will be updated automatically by the useEffect that watches currentFile.content
        // No need to dispatch here - it would cause "Cannot update component while rendering" error
        
        // Verify save worked - retry if needed (silent)
        const verify1 = sessionStorage.getItem(filesKey);
        if (!verify1 || verify1 !== filesJson) {
          sessionStorage.setItem(filesKey, filesJson);
          sessionStorage.setItem(currentFileKey, fileNameToSave);
        }
      } catch (err) {}
      
      return next;
    });
  };

  const getOutputContent = () => {
    if (editorLoading) {
      return <div className={style.loading}>Compiling...</div>;
    }

    if (error) {
      return <div className={style.error}>{error}</div>;
    }

    if (output) {
      return <pre className={style.success}>{output}</pre>;
    }

    return <div className={style.placeholder}></div>;
  };

  const updateAssignment = async () => {
    if (!resolvedAssignmentId) return;
    if (!currentFile) return;
    try {
      // Get schema from sessionStorage if Redux is empty, otherwise use Redux
      let schema_json: unknown = null;
      try {
        const schemeKey = `scheme:${storageKey}`;
        const savedScheme = sessionStorage.getItem(schemeKey);
        if (savedScheme) {
          schema_json = JSON.parse(savedScheme);
        } else if (project.components && project.components.length > 0) {
          schema_json = {
        components: project.components,
        wires: project.wires,
        viewport: project.viewport,
      };
        } else {
          // Try to get from sessionStorage with fallback
          const fallbackKey = `scheme:${rawAssignmentId || storageKey}`;
          const fallbackScheme = sessionStorage.getItem(fallbackKey);
          if (fallbackScheme) {
            schema_json = JSON.parse(fallbackScheme);
          }
        }
      } catch {}
      
      // If still no schema, use Redux as fallback
      const hasSchema2 = (v: unknown): v is { components: unknown[]; wires: unknown[]; viewport?: unknown } => {
        return !!v && typeof v === 'object' && Array.isArray((v as any).components) && Array.isArray((v as any).wires);
      };
      if (!hasSchema2(schema_json)) {
        schema_json = {
          components: project.components || [],
          wires: project.wires || [],
          viewport: project.viewport || { zoom: 1, offset: { x: 0, y: 0 } },
        };
      }
      
      const payload: Record<string, unknown> = {
        code: currentFile.content,
        schema_json,
      };
      if (rawAssignmentId) {
        payload.assignment_id = rawAssignmentId;
      }
      const data = await apiPut<{ success?: boolean; error?: string }>(`/api/assignments/${resolvedAssignmentId}`, payload);
      if (!data?.success) {
        setError(data?.error || 'Не удалось обновить задание');
      } else {
        setOutput('Задание обновлено');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка обновления задания';
      setError(msg);
    }
  };

  const isTeacher = !isStudent;
  const hasPersistedAssignment = !!resolvedAssignmentId;
  const isTeacherSession = isTeacher && rawAssignmentId !== null && rawAssignmentId !== undefined && rawAssignmentId === teacherSessionId;

  return (
    <div className={style.codeEditor}>
      <div className={style.codeName}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {files.length === 0 ? (
              <span style={{ opacity: 0.7 }}>Начните печатать, чтобы создать файл</span>
            ) : (
              files.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setCurrentFileName(f.name)}
                  className={f.name === currentFileName ? style.activeTab : style.tab}
                >
                  {f.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
      <div className={style.editorArea}>
        <CodeMirror
          key={`${theme}`}
          value={currentFile?.content || ''}
          height="650px"
          extensions={extensions}
          className="custom-codemirror"
          style={{ width: '100%' }}
          onChange={updateCurrentFileContent}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
          }}
        />
      </div>
      <div className={style.outputPanel}>
        <h2>Вывод:</h2>
        <div className={style.outputContent}>{getOutputContent()}</div>
      </div>

      <EditorMenu
        leftButtonName="Компилировать"
        rightButtonName="Загрузить на контролер"
        onClickFirstButton={compileCode}
        onClickSecondButton={uploadToController}
        disabled={editorLoading || !currentFile}
        rightDisabled={editorLoading || !currentFile || !compilationSuccess}
      />


      {isSaveOpen && (
        <div className={style.modalOverlay} onClick={closeSave}>
          <div className={style.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Сохранить задание</h3>
            <label className={style.label}>Название</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={style.input}
            />
            <label className={style.label}>Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={style.textarea}
              rows={4}
            />
            <label className={style.checkboxRow}>
              <input type="checkbox" checked={showSchema} onChange={(e) => setShowSchema(e.target.checked)} /> Показывать схему студенту
            </label>
            <div className={style.modalActions}>
              <button className={style.button} onClick={saveAssignment} disabled={saving || !title}>Сохранить</button>
              <button className={style.clearButton} onClick={closeSave} disabled={saving}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
