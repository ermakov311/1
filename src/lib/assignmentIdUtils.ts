/**
 * Утилиты для работы с ID заданий
 * Нормализует различные форматы ID (обычный, composite, кастомный) к базовому ID
 */
import { apiGet } from '@api';

/**
 * Извлекает базовый ID задания из любого формата assignmentId
 * @param assignmentId - ID задания (может быть обычным, composite или кастомным)
 * @param user - объект пользователя (для парсинга compositeId)
 * @returns базовый ID задания или null
 */
export function getBaseAssignmentId(
  assignmentId: string | null,
  user: { id?: number; group_id?: number } | null
): string | null {
  if (!assignmentId) return null;

  // Если это просто число - проверяем, не compositeId ли это
  if (/^\d+$/.test(assignmentId)) {
    // Проверяем, не является ли это compositeId (baseId + userId + groupId)
    // Формат: baseId + userId + groupId (конкатенация без разделителей)
    // Например: 29123 = baseId(29) + userId(1) + groupId(23)
    if (user?.id && user?.group_id) {
      const userIdStr = String(user.id);
      const groupIdStr = String(user.group_id);
      const suffix = `${userIdStr}${groupIdStr}`;
      
      // Проверяем, заканчивается ли ID на userId+groupId
      if (assignmentId.endsWith(suffix) && assignmentId.length > suffix.length) {
        // Это compositeId, извлекаем базовый ID
        const basePart = assignmentId.slice(0, assignmentId.length - suffix.length);
        const baseId = parseInt(basePart);
        if (!isNaN(baseId) && baseId > 0) {
          return String(baseId);
        }
      }
    }
    // Обычный ID (не compositeId) - возвращаем как есть
    // Но для студентов это может быть compositeId, который нужно обработать через API
    return assignmentId;
  }

  // Кастомный ID (например, 408112025154800) - нужно получить из mapping или API
  return null;
}

/**
 * Получает базовый ID из API, если assignmentId - это кастомный ID
 * @param assignmentId - кастомный ID
 * @returns базовый ID из API или null
 */
export async function resolveBaseIdFromApi(assignmentId: string): Promise<string | null> {
  try {
    const data = await apiGet<{ assignment?: { id?: number } }>(`/api/assignments/${assignmentId}`);
    const assignment = data?.assignment;
    if (assignment?.id) {
      return String(assignment.id);
    }
  } catch (err) {
    // silent
  }
  return null;
}

/**
 * Получает нормализованный базовый ID для использования в sessionStorage
 * Использует кэш в sessionStorage для кастомных ID
 */
export async function getNormalizedBaseId(
  assignmentId: string | null,
  user: { id?: number; group_id?: number } | null
): Promise<string | null> {
  if (!assignmentId) return null;

  // Сначала пробуем извлечь базовый ID напрямую
  let baseId = getBaseAssignmentId(assignmentId, user);

  // Если получили baseId и он отличается от assignmentId - это compositeId
  if (baseId && baseId !== assignmentId) {
    return baseId;
  }

  // Если baseId === assignmentId, это может быть:
  // 1. Обычный ID (не compositeId) - возвращаем как есть
  // 2. CompositeId, который не распарсился (нужно проверить через API)
  
  // Проверяем кэш в sessionStorage
  const cached = typeof window !== 'undefined' 
    ? sessionStorage.getItem(`assignmentMapping:${assignmentId}`)
    : null;
  
  if (cached) {
    return cached;
  }

  // Пробуем получить из API (API правильно обработает compositeId)
  const apiBaseId = await resolveBaseIdFromApi(assignmentId);
  if (apiBaseId && typeof window !== 'undefined') {
    // Сохраняем в кэш
    sessionStorage.setItem(`assignmentMapping:${assignmentId}`, apiBaseId);
    return apiBaseId;
  }

  // Если API не вернул baseId, но мы получили baseId из getBaseAssignmentId
  // и он равен assignmentId - это обычный ID, возвращаем его
  return baseId;
}

/**
 * Получает ключ для sessionStorage на основе базового ID
 * Используется для синхронизации между редакторами кода и схемы
 */
export function getStorageKey(baseId: string | null, fallbackId: string): string {
  return baseId || fallbackId;
}










