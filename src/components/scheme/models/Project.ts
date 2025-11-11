import { CircuitComponent } from './Component';
import { ComponentFactory } from './ComponentFactory';
import { Wire, ProjectSchema, SerializedComponent, SerializedWire, ViewportState, ProjectMetadata, WireConnection } from '../types/schema';

export class Project {
  private components: CircuitComponent[] = [];
  private wires: Wire[] = [];
  private viewport: ViewportState = {
    zoom: 1.0,
    offset: { x: 0, y: 0 }
  };

  // ==================== КОМПОНЕНТЫ ====================

  addComponent(component: CircuitComponent): void {
    this.components.push(component);
  }

  removeComponent(componentId: string): void {
    this.components = this.components.filter(c => c.id !== componentId);
    this.removeWiresByComponent(componentId);
  }

  getComponent(id: string): CircuitComponent | undefined {
    return this.components.find(c => c.id === id);
  }

  getComponents(): CircuitComponent[] {
    return [...this.components];
  }

  // ==================== ПРОВОДА ====================

  addWire(wire: Wire): void {
    this.wires.push(wire);
  }

  removeWire(wireId: string): void {
    this.wires = this.wires.filter(w => w.id !== wireId);
  }

  removeWiresByComponent(componentId: string): void {
    this.wires = this.wires.filter(wire => 
      wire.start.componentId !== componentId && wire.end.componentId !== componentId
    );
  }

  getWires(): Wire[] {
    return [...this.wires];
  }

  getWiresByComponent(componentId: string): Wire[] {
    return this.wires.filter(wire => 
      wire.start.componentId === componentId || wire.end.componentId === componentId
    );
  }


  canConnectPins(start: WireConnection, end: WireConnection): boolean {
    const startComponent = this.getComponent(start.componentId);
    const endComponent = this.getComponent(end.componentId);

    if (!startComponent || !endComponent) return false;
    if (start.componentId === end.componentId) return false;

    // Проверяем, что пины существуют
    if (!startComponent.pinPositions[start.pinName]) return false;
    if (!endComponent.pinPositions[end.pinName]) return false;

    return true;
  }

  addWireWithValidation(wire: Wire): boolean {
    if (this.canConnectPins(wire.start, wire.end)) {
      this.wires.push(wire);
      return true;
    }
    return false;
  }

  // ==================== VIEWPORT ====================

  setViewport(viewport: ViewportState): void {
    this.viewport = viewport;
  }

  getViewport(): ViewportState {
    return { ...this.viewport };
  }

  zoomIn(): void {
    this.viewport.zoom = Math.min(this.viewport.zoom * 1.1, 3.0);
  }

  zoomOut(): void {
    this.viewport.zoom = Math.max(this.viewport.zoom / 1.1, 0.5);
  }

  pan(delta: { x: number; y: number }): void {
    this.viewport.offset.x += delta.x;
    this.viewport.offset.y += delta.y;
  }

  resetViewport(): void {
    this.viewport = { zoom: 1.0, offset: { x: 0, y: 0 } };
  }

  // ==================== СЕРИАЛИЗАЦИЯ ====================

  serialize(): ProjectSchema {
    return {
      components: this.components.map(c => c.serialize()),
      wires: this.wires.map(w => ({
        id: w.id,
        points: w.points.map(p => ({ ...p })),
        start: { ...w.start },
        end: { ...w.end },
        color: w.color || '#000',
        width: w.width || 2
      })),
      viewport: { ...this.viewport },
      metadata: {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }

  // ==================== ДЕСЕРИАЛИЗАЦИЯ ====================

  static deserialize(schema: ProjectSchema): Project {
    const project = new Project();
    
    project.components = schema.components.map(c => 
      ComponentFactory.deserialize(c)
    );

    project.wires = schema.wires;
    project.viewport = schema.viewport;

    return project;
  }

  // ==================== ЭКСПОРТ/ИМПОРТ ====================

  toJSON(): string {
    return JSON.stringify(this.serialize(), null, 2);
  }

  static fromJSON(json: string): Project {
    try {
      const schema = JSON.parse(json) as ProjectSchema;
      return this.deserialize(schema);
    } catch (error) {
      throw new Error('Invalid project JSON format');
    }
  }

  // ==================== УТИЛИТЫ ====================

  isEmpty(): boolean {
    return this.components.length === 0 && this.wires.length === 0;
  }

  clear(): void {
    this.components = [];
    this.wires = [];
    this.resetViewport();
  }

  clone(): Project {
    const project = new Project();
    project.components = this.components.map(c => c.clone());
    project.wires = this.wires.map(w => ({ ...w }));
    project.viewport = { ...this.viewport };
    return project;
  }

  // ==================== ПОИСК И ФИЛЬТРАЦИЯ ====================

  findComponentByType(type: string): CircuitComponent[] {
    return this.components.filter(c => c.type === type);
  }

  findComponentsInArea(x: number, y: number, width: number, height: number): CircuitComponent[] {
    return this.components.filter(c => 
      c.position.x >= x && 
      c.position.x <= x + width &&
      c.position.y >= y && 
      c.position.y <= y + height
    );
  }

  // ==================== ВАЛИДАЦИЯ ====================

  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    this.components.forEach(component => {
      if (!component.validateProperties()) {
        errors.push(`Component ${component.id} has invalid properties`);
      }
    });

    this.wires.forEach(wire => {
      const startComponent = this.getComponent(wire.start.componentId);
      const endComponent = this.getComponent(wire.end.componentId);

      if (!startComponent) errors.push(`Wire ${wire.id} has invalid start component`);
      if (!endComponent) errors.push(`Wire ${wire.id} has invalid end component`);
    });

    return { isValid: errors.length === 0, errors };
  }
}