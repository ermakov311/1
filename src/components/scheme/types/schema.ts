export enum ComponentCategory {
  COMPONENT = 'component',
  MODULE = 'module',
  CONTROLLER = 'controller'
}


export interface Position {
  x: number;
  y: number;
}

//КОМПОНЕНТЫ

// Свойства для каждого типа компонента
export interface GroundProperties {
  voltage: number;
}

export interface ResistorProperties {
  resistance: number; // Омы
  tolerance: number;  // Проценты
  power: number;      // Ватты
}

export interface LEDProperties {
  color: string;          // HEX цвет
  forwardVoltage: number; // Вольты
  maxCurrent: number;     // Миллиамперы
}

export interface ArduinoProperties {
  model: string;
  voltage: number;
}

export interface ButtonProperties {
  pressed: boolean;
}

// Объединение всех свойств
export type ComponentProperties = 
  | GroundProperties
  | ResistorProperties
  | LEDProperties
  | ArduinoProperties
  | ButtonProperties;

// Типы компонентов
export type ComponentType = 
  | 'ground'
  | 'resistor'
  | 'led'
  | 'arduino'
  | 'button';

// Базовый интерфейс компонента
export interface BaseComponent {
  id: string;
  type: ComponentType;
  name: string;
  icon: string;
  position: Position;
  rotation: number;
}

// Сериализованный компонент (для сохранения)
export interface SerializedComponent extends BaseComponent {
  properties: ComponentProperties;
}

// ==================== ПРОВОДА ====================

export interface WireConnection {
  componentId: string;
  pinName: string;
}

export interface Wire {
  id: string;
  points: Position[];
  start: WireConnection;
  end: WireConnection;
  color: string;
  width: number;
}

// Сериализованный провод
export interface SerializedWire extends Wire {}

// ПРОЕКТ

export interface ViewportState {
  zoom: number;
  offset: Position;
}

export interface ProjectSchema {
  components: SerializedComponent[];
  wires: SerializedWire[];
  viewport: ViewportState;
  metadata: {
    version: string;
    createdAt: string;
    updatedAt: string;
  };
}

// TYPE GUARDS
// Для безопасной проверки типов во время выполнения

export function isGroundProperties(properties: ComponentProperties): properties is GroundProperties {
  return 'voltage' in properties;
}

export function isResistorProperties(properties: ComponentProperties): properties is ResistorProperties {
  return 'resistance' in properties && 'tolerance' in properties;
}

export function isLEDProperties(properties: ComponentProperties): properties is LEDProperties {
  return 'color' in properties && 'forwardVoltage' in properties;
}

export function isArduinoProperties(properties: ComponentProperties): properties is ArduinoProperties {
  return 'model' in properties && 'voltage' in properties;
}

export function isButtonProperties(properties: ComponentProperties): properties is ButtonProperties {
  return 'pressed' in properties;
}

//ВСПОМОГАТЕЛЬНЫЕ ТИПЫ

export type CanvasMode = 
  | 'select'     // Режим выбора
  | 'wire'       // Режим рисования проводов
  | 'pan'        // Режим перемещения canvas
  | 'component'  // Режим размещения компонентов

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionState {
  selectedComponents: string[]; 
  selectedWires: string[];     
  selectionBox: BoundingBox | null;
}

export interface ProjectMetadata {
  version: string;
  createdAt: string;
  updatedAt: string;
}

// (ProjectSchema already declared above)