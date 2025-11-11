'use client'

import { useEffect, useMemo, useRef, useState } from 'react';
import style from './MenuEditor.module.scss';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import DropButton from '@/components/UI/DropButton/DropButton';
import { useDispatch } from 'react-redux';
import { resetProject, setUploadedCode } from '@/store/project/projectSlice';
import { ComponentCategory, ComponentType } from '@/components/scheme/types/schema';
import { ComponentFactory } from '@entities/circuit';
import { addComponent } from '@/store/project/projectSlice';
import { ComponentCard } from '@/components/elements/Editor/ComponentCard/ComponentCard';
import ExitButton from '@/components/UI/ExitButton/ExitButton';
import SwitchTheme from '@/components/UI/SwitchTheme/SwitchTheme';
import { useAuth } from '@hooks/useAuth';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import Portal from '@/components/UI/Portal/Portal';
import { apiGet } from '@api';
import { useAssignmentDescription, useCreateAssignment, useUpdateAssignment } from '@features/assignments';

const MenuEditor = () => {
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [assignmentDescription, setAssignmentDescription] = useState<string | null>(null);
  const [loadingDescription, setLoadingDescription] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isStudent = !!user && user.role_id === 3;
  const project = useSelector((state: RootState) => state.project);
  const components = ComponentFactory.getAvailableComponents();

  const dispatch = useDispatch();

  const componentComponents = ComponentFactory.getComponentsForCategory(
    ComponentCategory.COMPONENT
  );
  const controllerComponents = ComponentFactory.getComponentsForCategory(
    ComponentCategory.CONTROLLER
  );



  const isActiveCode = pathname.startsWith('/editor/code');
  const assignmentId = searchParams?.get('assignmentId');
  const teacherIdParam = (!isStudent && user?.id) ? String(user.id) : null;
  const sessionParam = assignmentId || teacherIdParam;
  const isTeacherSession = !isStudent && sessionParam !== null && sessionParam === teacherIdParam;
  const resolvedAssignmentId = useMemo(() => {
    if (!assignmentId) return null;
    if (teacherIdParam && assignmentId === teacherIdParam) return null;
    if (assignmentId === 'global') return null;
    if (/^\d+$/.test(assignmentId)) return assignmentId;
    if (typeof window !== 'undefined') {
      const mapped = sessionStorage.getItem(`assignmentMapping:${assignmentId}`);
      if (mapped) return mapped;
    }
    return null;
  }, [assignmentId, teacherIdParam]);
  const codeBasePath = isActiveCode ? pathname : '/editor/code/task.ino';
  const codeHref = sessionParam
    ? `${codeBasePath}?assignmentId=${sessionParam}`
    : codeBasePath;
  const schemeHref = sessionParam
    ? `/editor/scheme?assignmentId=${sessionParam}`
    : '/editor/scheme';

  const fetchDescription = useAssignmentDescription();
  const updateAssignmentReq = useUpdateAssignment();
  const createAssignmentReq = useCreateAssignment();

  const handleViewAssignment = async () => {
    if (!resolvedAssignmentId && !assignmentId) {
      setAssignmentDescription('Задание не найдено');
      setIsDescriptionModalOpen(true);
      return;
    }
    
    setLoadingDescription(true);
    try {
      const verifyId = resolvedAssignmentId || assignmentId;
      if (!verifyId) {
        setAssignmentDescription('Задание не найдено');
        setIsDescriptionModalOpen(true);
        return;
      }
      
      const desc = await fetchDescription(verifyId);
      setAssignmentDescription(desc);
    } catch (error) {
      setAssignmentDescription('Ошибка при загрузке описания');
    } finally {
      setLoadingDescription(false);
      setIsDescriptionModalOpen(true);
    }
  };

  const handleUpdateAssignment = async () => {
    try {
      const apiId = resolvedAssignmentId;
      if (!apiId) return;
      
      // Get schema from sessionStorage if Redux is empty, otherwise use Redux
      let schema_json: unknown = null;
      try {
        const sessionKey = sessionParam || 'global';
        const schemeKey = `scheme:${sessionKey}`;
        const savedScheme = sessionStorage.getItem(schemeKey);
        if (savedScheme) {
          schema_json = JSON.parse(savedScheme);
        } else if (project?.components && project.components.length > 0) {
          schema_json = {
            components: project.components || [],
            wires: project.wires || [],
            viewport: project.viewport || { zoom: 1, offset: { x: 0, y: 0 } },
          };
        } else {
          // Try to get from sessionStorage with fallback
          const fallbackKey = `scheme:${assignmentId || sessionKey}`;
          const fallbackScheme = sessionStorage.getItem(fallbackKey);
          if (fallbackScheme) {
            schema_json = JSON.parse(fallbackScheme);
          }
        }
      } catch {}
      
      // If still no schema, use Redux as fallback
      if (
        !schema_json ||
        !(typeof schema_json === 'object' && schema_json !== null && 'components' in (schema_json as Record<string, unknown>))
      ) {
        schema_json = {
          components: project?.components || [],
          wires: project?.wires || [],
          viewport: project?.viewport || { zoom: 1, offset: { x: 0, y: 0 } },
        };
      }
      
      // Pull current code from sessionStorage for this assignment
      let code: string | null = null;
      try {
        const sessionKey = sessionParam || 'global';
        const filesStr = sessionStorage.getItem(`editorFiles:${sessionKey}`) ?? sessionStorage.getItem('editorFiles');
        const curName = sessionStorage.getItem(`editorCurrentFile:${sessionKey}`) || sessionStorage.getItem('editorCurrentFile') || 'task.ino';
        if (filesStr) {
          const files = JSON.parse(filesStr);
          const f = Array.isArray(files) ? files.find((x: { name?: string; content?: unknown }) => x && x.name === curName) : null;
          code = f ? String(f.content || '') : null;
        }
      } catch {}
      const payload: Record<string, unknown> = { schema_json };
      if (code !== null) payload.code = code;
      if (assignmentId) payload.assignment_id = assignmentId;
      const data = await updateAssignmentReq(apiId, payload);
      if (!data?.success) {
        alert(data?.error || 'Не удалось обновить задание');
      } else {
        alert('Задание обновлено');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка сохранения';
      alert(msg);
    }
  };

  // Modal for creating a new assignment when no assignmentId
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showSchema, setShowSchema] = useState(true);
  const [saving, setSaving] = useState(false);

  const openSave = () => setIsSaveOpen(true);
  const closeSave = () => { if (!saving) setIsSaveOpen(false); };

  const handleCreateAssignment = async () => {
    try {
      setSaving(true);
      // Pull current code from global editor storage
      let code = '';
      try {
        const sessionKey = sessionParam || 'global';
        const filesStr = sessionStorage.getItem(`editorFiles:${sessionKey}`) ?? sessionStorage.getItem('editorFiles');
        const curName = sessionStorage.getItem(`editorCurrentFile:${sessionKey}`) || sessionStorage.getItem('editorCurrentFile') || 'task.ino';
        if (filesStr) {
          const files = JSON.parse(filesStr);
          const f = Array.isArray(files) ? files.find((x: { name?: string; content?: unknown }) => x && x.name === curName) : null;
          code = f ? String(f.content || '') : '';
        }
      } catch {}
      
      // Get schema from sessionStorage if Redux is empty, otherwise use Redux
      let schema_json: unknown = null;
      try {
        const sessionKey = sessionParam || 'global';
        const schemeKey = `scheme:${sessionKey}`;
        const savedScheme = sessionStorage.getItem(schemeKey);
        if (savedScheme) {
          schema_json = JSON.parse(savedScheme);
        } else if (project?.components && project.components.length > 0) {
          schema_json = {
            components: project.components || [],
            wires: project.wires || [],
            viewport: project.viewport || { zoom: 1, offset: { x: 0, y: 0 } },
          };
        } else {
          // Try to get from sessionStorage with fallback
          const fallbackKey = `scheme:${assignmentId || sessionKey}`;
          const fallbackScheme = sessionStorage.getItem(fallbackKey);
          if (fallbackScheme) {
            schema_json = JSON.parse(fallbackScheme);
          }
        }
      } catch {}
      
      // If still no schema, use Redux as fallback
      if (
        !schema_json ||
        !(typeof schema_json === 'object' && schema_json !== null && 'components' in (schema_json as Record<string, unknown>))
      ) {
        schema_json = {
          components: project?.components || [],
          wires: project?.wires || [],
          viewport: project?.viewport || { zoom: 1, offset: { x: 0, y: 0 } },
        };
      }
      // Normalize expected logs to single loop iteration canonical format
      // This matches the normalization logic in the verification API
      const rawLogs = Array.isArray(project?.logs) ? project.logs : [];
      
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
        // No loops found - use all events (teacher did it without loop)
        slice = rawLogs;
      }
      const expected_logs = slice
        .filter((e) => e && e.type === 'event')
        .map((e) => {
          if (e.name === 'led') return { t: 'led', id: e.id, on: !!e.on, b: Math.round(((e.brightness ?? 0) as number) * 100) / 100 };
          if (e.name === 'digitalWrite') return { t: 'dw', pin: e.pin, v: e.value ? 1 : 0 };
          if (e.name === 'delay') return { t: 'del', ms: Number(e.ms) || 0 };
          if (e.name === 'button') return { t: 'btn', id: e.id, p: !!e.pressed };
          return null;
        })
        .filter(Boolean);
      let customId: string | null = null;
      if (!resolvedAssignmentId && isTeacherSession && user) {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear());
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        customId = `${user.id}${day}${month}${year}${hours}${minutes}${seconds}`;
      }

      const payload: Record<string, unknown> = { title, description, show_schema: showSchema, code, schema_json, expected_logs };
      if (customId) payload.assignment_id = customId;

      const data = await createAssignmentReq(payload);
      if (!data?.success) {
        alert(data?.error || 'Не удалось сохранить задание');
      } else {
        const dbId = data?.assignment?.id ? String(data.assignment.id) : null;
        if (dbId) {
          const finalId = customId ?? dbId;
          if (customId) {
            try { sessionStorage.setItem(`assignmentMapping:${finalId}`, dbId); } catch {}
          }
          try {
            const filesStr = sessionStorage.getItem(`editorFiles:${sessionParam || 'global'}`) ?? sessionStorage.getItem('editorFiles');
            const curName = sessionStorage.getItem(`editorCurrentFile:${sessionParam || 'global'}`) || sessionStorage.getItem('editorCurrentFile') || 'task.ino';
            if (filesStr) sessionStorage.setItem(`editorFiles:${finalId}`, filesStr);
            if (curName) sessionStorage.setItem(`editorCurrentFile:${finalId}`, curName);
            const schemeData = sessionStorage.getItem(`scheme:${sessionParam || 'global'}`);
            if (schemeData) sessionStorage.setItem(`scheme:${finalId}`, schemeData);
          } catch {}
          window.location.href = `/editor/code/${encodeURIComponent(sessionStorage.getItem(`editorCurrentFile:${finalId}`) || sessionStorage.getItem('editorCurrentFile') || 'task.ino')}?assignmentId=${finalId}`;
          return;
        }
        alert('Задание сохранено');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка сохранения задания';
      alert(msg);
    } finally {
      setSaving(false);
      setIsSaveOpen(false);
    }
  };

  return (
    <div className={style.menuEditor}>
      <div className={style.switchEditor}>
        <button className={!isActiveCode ? style.active : ''}>
          <Link href={schemeHref}>Редактор схем</Link>
        </button>
        <button className={isActiveCode ? style.active : ''}>
          <Link href={codeHref}>Редактор кода</Link>
        </button>
      </div>
      <div className={style.mainEditor}>
        {isActiveCode && (
          <div className={style.buttonEditor}>
            <DropButton
              name="Мои файлы"
              options={['blink.ino', 'test.ino']}
              isOpen={isDropDownOpen}
              onToggle={setIsDropDownOpen}
              onClose={() => setIsDropDownOpen(false)}
              link="editor/code"
              addFile={true}
            />
            <DropButton
              name="Библиотеки"
              options={['blink.ino', 'test.ino']}
              isOpen={isDropDownOpen}
              onToggle={setIsDropDownOpen}
              onClose={() => setIsDropDownOpen(false)}
              link="editor/code"
            />
            <a href="https://www.google.com/?hl=ru">
              Помощь
              <span>
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 17 17"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M16.5384 2.00017C16.5384 1.17174 15.8668 0.500169 15.0384 0.500169L1.53841 0.500168C0.709979 0.500168 0.0384061 1.17174 0.0384061 2.00017C0.0384065 2.8286 0.709979 3.50017 1.53841 3.50017H13.5384V15.5002C13.5384 16.3286 14.21 17.0002 15.0384 17.0002C15.8668 17.0002 16.5384 16.3286 16.5384 15.5002L16.5384 2.00017ZM2 15.0386L3.06066 16.0992L16.0991 3.06083L15.0384 2.00017L13.9777 0.939508L0.93934 13.9779L2 15.0386Z"
                    fill="white"
                  />
                </svg>
              </span>
            </a>
          </div>
        )}

        {!isActiveCode && (
          <div className={style.buttonEditor}>
            <DropButton
              name="Компоненты"
              isOpen={isDropDownOpen}
              onToggle={setIsDropDownOpen}
              onClose={() => setIsDropDownOpen(false)}
              link="editor/scheme"
            >
              {componentComponents.map((component) => (
                <ComponentCard
                  key={component.type}
                  type={component.type}
                  name={component.name}
                />
              ))}
            </DropButton>
            <DropButton
              name="Модули"
              isOpen={isDropDownOpen}
              onToggle={setIsDropDownOpen}
              onClose={() => setIsDropDownOpen(false)}
              link="editor/scheme"
            />

            <DropButton
              name="Контроллеры"
              isOpen={isDropDownOpen}
              onToggle={setIsDropDownOpen}
              onClose={() => setIsDropDownOpen(false)}
              link="editor/scheme"
            >
              {controllerComponents.map((component) => (
                <ComponentCard
                  key={component.type}
                  type={component.type}
                  name={component.name}
                />
              ))}
            </DropButton>

          </div>
        )}

        <div className={style.endEditor}>
          {!isStudent ? (
            <div className={style.actionRow}>
              {resolvedAssignmentId && !isTeacherSession ? (
                <button>
                  <Link href="" onClick={(e) => { e.preventDefault(); handleUpdateAssignment(); }}>
                    Обновить задание
                    <span>
                      <svg
                        width="30"
                        height="30"
                        viewBox="0 0 30 30"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <g clipPath="url(#clip0_200_549)">
                          <path
                            d="M29.1959 3.99768C28.1228 2.9246 26.3841 2.9246 25.311 3.99768L8.97198 20.3366L4.62746 16.6046C3.56904 15.5462 1.85317 15.5462 0.793817 16.6046C-0.264606 17.6631 -0.264606 19.3798 0.793817 20.4382L7.28455 26.0133C8.34297 27.0718 10.0588 27.0718 11.1182 26.0133C11.2244 25.9072 11.3132 25.789 11.3984 25.6709C11.4139 25.6563 11.4313 25.6462 11.4469 25.6315L29.1959 7.88162C30.268 6.80947 30.268 5.06983 29.1959 3.99768Z"
                            fill="white"
                          />
                        </g>
                        <defs>
                          <clipPath id="clip0_200_549">
                            <rect width="30" height="30" fill="white" />
                          </clipPath>
                        </defs>
                      </svg>
                    </span>
                  </Link>
                </button>
              ) : (
                <button>
                  <Link href="" onClick={(e) => { e.preventDefault(); openSave(); }}>
                    Сохранить задание
                  <span>
                    <svg
                      width="30"
                      height="30"
                      viewBox="0 0 30 30"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g clipPath="url(#clip0_200_549)">
                        <path
                          d="M29.1959 3.99768C28.1228 2.9246 26.3841 2.9246 25.311 3.99768L8.97198 20.3366L4.62746 16.6046C3.56904 15.5462 1.85317 15.5462 0.793817 16.6046C-0.264606 17.6631 -0.264606 19.3798 0.793817 20.4382L7.28455 26.0133C8.34297 27.0718 10.0588 27.0718 11.1182 26.0133C11.2244 25.9072 11.3132 25.789 11.3984 25.6709C11.4139 25.6563 11.4313 25.6462 11.4469 25.6315L29.1959 7.88162C30.268 6.80947 30.268 5.06983 29.1959 3.99768Z"
                          fill="white"
                        />
                      </g>
                      <defs>
                        <clipPath id="clip0_200_549">
                          <rect width="30" height="30" fill="white" />
                        </clipPath>
                      </defs>
                    </svg>
                  </span>
                  </Link>
                </button>
              )}
              <button>
                <Link href="/tasks" onClick={() => { 
                  try { 
                    dispatch(resetProject()); 
                    dispatch(setUploadedCode(null));
                    // Clear sessionStorage when exiting editor
                    const sessionKey = sessionParam || 'global';
                    sessionStorage.removeItem(`editorFiles:${sessionKey}`);
                    sessionStorage.removeItem(`editorCurrentFile:${sessionKey}`);
                    sessionStorage.removeItem(`scheme:${sessionKey}`);
                  } catch {} 
                }}>Назад</Link>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(resolvedAssignmentId || assignmentId) && (
                <button className={style.fullWidthButton}>
                  <Link href="#" onClick={(e) => { e.preventDefault(); handleViewAssignment(); }}>
                    Посмотреть задание
                  </Link>
                </button>
              )}
            <button className={style.fullWidthButton}>
              <Link href="/tasks" onClick={() => { 
                try { 
                  dispatch(resetProject()); 
                  dispatch(setUploadedCode(null));
                  // Clear sessionStorage when exiting editor
                  const sessionKey = sessionParam || 'global';
                  sessionStorage.removeItem(`editorFiles:${sessionKey}`);
                  sessionStorage.removeItem(`editorCurrentFile:${sessionKey}`);
                  sessionStorage.removeItem(`scheme:${sessionKey}`);
                } catch {} 
              }}>Назад</Link>
            </button>
            </div>
          )}
        </div>
      </div>
      <ExitButton className={style.exitInset} />

      {isDescriptionModalOpen && (
        <Portal>
          <div className={style.modalOverlay} onClick={() => setIsDescriptionModalOpen(false)}>
            <div className={style.modal} onClick={(e) => e.stopPropagation()}>
              <h3>Описание задания</h3>
              <div className={style.descriptionContent}>
                {loadingDescription ? (
                  <div>Загрузка...</div>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {assignmentDescription || 'Описание отсутствует'}
                  </div>
                )}
              </div>
              <div className={style.modalActions}>
                <button className={style.button} onClick={() => setIsDescriptionModalOpen(false)}>Закрыть</button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {isSaveOpen && (
        <Portal>
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
              <button className={style.button} onClick={handleCreateAssignment} disabled={saving || !title}>Сохранить</button>
              <button className={style.clearButton} onClick={closeSave} disabled={saving}>Отмена</button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
};

export default MenuEditor;
