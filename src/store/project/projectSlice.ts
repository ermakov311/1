import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Project } from '../../components/scheme/models/Project';
import { CircuitComponent } from '../../components/scheme/models/Component';
import {
  Position,
  ProjectSchema,
  SerializedComponent,
  Wire,
  WireConnection,
} from '../../components/scheme/types/schema';

interface ProjectState {
  components: SerializedComponent[];
  wires: Wire[];
  viewport: {
    zoom: number;
    offset: Position;
  };
  selectedComponentId: string | null;
  isDragging: boolean;
  selectedWireId: string | null;
  uploadedCode?: string | null;
  isSimulationRunning?: boolean;
  circuit?: Record<string, number>;
  logs?: Array<Record<string, unknown>>;
}

const initialState: ProjectState = {
  components: [],
  wires: [],
  viewport: {
    zoom: 1.0,
    offset: { x: 0, y: 0 },
  },
  selectedComponentId: null,
  isDragging: false,
  selectedWireId: null,
  uploadedCode: null,
  isSimulationRunning: false,
  circuit: {},
  logs: [],
};

export const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    addComponent: (state, action: PayloadAction<SerializedComponent>) => {
      state.components.push(action.payload);
    },

    moveComponent: (
      state,
      action: PayloadAction<{ id: string; position: Position }>
    ) => {
      const component = state.components.find(
        (c) => c.id === action.payload.id
      );
      if (component) {
        component.position = action.payload.position;
      } else {
      }
    },

    removeComponent: (state, action: PayloadAction<string>) => {
      state.components = state.components.filter(
        (c) => c.id !== action.payload
      );
      if (state.selectedComponentId === action.payload) {
        state.selectedComponentId = null;
      }
    },

    selectComponent: (state, action: PayloadAction<string | null>) => {
      state.selectedComponentId = action.payload;
    },

    loadProject: (state, action: PayloadAction<ProjectSchema>) => {
      state.components = action.payload.components;
      state.wires = action.payload.wires;
      state.viewport = action.payload.viewport;
    },

    resetProject: (state) => {
      state.components = [];
      state.wires = [];
      state.viewport = { zoom: 1.0, offset: { x: 0, y: 0 } };
      state.selectedComponentId = null;
    },

    setViewport: (
      state,
      action: PayloadAction<{ zoom: number; offset: Position }>
    ) => {
      state.viewport = action.payload;
    },
    resetViewport: (state) => {
      state.viewport = { zoom: 1, offset: { x: 0, y: 0 } };
    },
    rotateComponent: (
      state,
      action: PayloadAction<{ id: string; degrees: number }>
    ) => {
      const component = state.components.find(
        (c) => c.id === action.payload.id
      );
      if (component) {
        let newRotation = (component.rotation + action.payload.degrees) % 360;
        if (newRotation < 0) newRotation += 360;

        const validRotations = [0, 90, 180, 270];
        const closestRotation = validRotations.reduce((prev, curr) =>
          Math.abs(curr - newRotation) < Math.abs(prev - newRotation)
            ? curr
            : prev
        );
        component.rotation = closestRotation;
      }
    },
    addWire: (state, action: PayloadAction<Wire>) => {
      state.wires.push(action.payload);
    },

    removeWire: (state, action: PayloadAction<string>) => {
      state.wires = state.wires.filter((wire) => wire.id !== action.payload);
      if (state.selectedWireId === action.payload) {
        state.selectedWireId = null;
      }
    },

    updateWire: (
      state,
      action: PayloadAction<{ id: string; points: Position[] }>
    ) => {
      const wire = state.wires.find((w) => w.id === action.payload.id);
      if (wire) {
        wire.points = action.payload.points;
      }
    },

    connectPins: (
      state,
      action: PayloadAction<{ start: WireConnection; end: WireConnection }>
    ) => {
      const { start, end } = action.payload;

      const existingWire = state.wires.find(
        (wire) =>
          (wire.start.componentId === start.componentId &&
            wire.start.pinName === start.pinName &&
            wire.end.componentId === end.componentId &&
            wire.end.pinName === end.pinName) ||
          (wire.start.componentId === end.componentId &&
            wire.start.pinName === end.pinName &&
            wire.end.componentId === start.componentId &&
            wire.end.pinName === start.pinName)
      );

      if (!existingWire) {
        const newWire: Wire = {
          id: `wire-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          points: [],
          start,
          end,
          color: '#000000',
          width: 2,
        };
        state.wires.push(newWire);
      }
    },

    selectWire: (state, action: PayloadAction<string | null>) => {
      state.selectedWireId = action.payload;
    },

    setUploadedCode: (state, action: PayloadAction<string | null>) => {
      state.uploadedCode = action.payload;
    },
    startSimulation: (state) => {
      state.isSimulationRunning = true;
    },
    stopSimulation: (state) => {
      state.isSimulationRunning = false;
      state.circuit = {};
    },
    applyCircuitUpdate: (state, action: PayloadAction<Record<string, number>>) => {
      state.circuit = action.payload ?? {};
    },
    appendLog: (state, action: PayloadAction<Record<string, unknown>>) => {
      if (!state.logs) {
        state.logs = [];
      }
      const MAX_LOGS = 10000;
      const logs = state.logs as Array<Record<string, unknown>>;
      if (!action.payload || typeof action.payload !== 'object') {
        return;
      }
      if (logs.length >= MAX_LOGS) {
        const keepCount = Math.floor(MAX_LOGS * 0.8);
        logs.splice(0, logs.length - keepCount);
      }
      logs.push(action.payload);
    },
    clearLogs: (state) => {
      state.logs = [];
    },
    updateComponentProperties: (
      state,
      action: PayloadAction<{ id: string; properties: Record<string, unknown> }>
    ) => {
      const comp = state.components.find((c) => c.id === action.payload.id);
      if (comp) {
        const current = (comp as any).properties ?? {};
        comp.properties = { ...current, ...action.payload.properties } as any;
      }
    },
  },
});

export const {
  addComponent,
  moveComponent,
  removeComponent,
  selectComponent,
  loadProject,
  resetProject,
  setViewport,
  resetViewport,
  rotateComponent,
  addWire,
  removeWire,
  selectWire,
  connectPins,
  updateWire,
  setUploadedCode,
  startSimulation,
  stopSimulation,
  applyCircuitUpdate,
  appendLog,
  clearLogs,
  updateComponentProperties,
} = projectSlice.actions;

export const projectReducer = projectSlice.reducer;
