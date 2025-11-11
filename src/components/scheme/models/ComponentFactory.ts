import { CircuitComponent } from './Component';
import { Ground } from './components/Ground';
import { Resistor } from './components/Resistor';
import { LED } from './components/LED';
import { Button } from './components/Button';
import { Arduino } from './components/Arduino';
import { ComponentCategory, Position } from '../types/schema';
import { ComponentType, SerializedComponent } from '../types/schema';

export const COMPONENT_CATEGORIES = {
  COMPONENT: {
    name: 'Компоненты',
    types: ['resistor', 'led', 'ground', 'button'] as ComponentType[],
    icon: '⚡'
  },
  CONTROLLER: {
    name: 'Микроконтроллеры',
    types: ['arduino'] as ComponentType[],
    icon: '🔌'
  }
} as const;

export class ComponentFactory {
  private static componentRegistry: Record<
    ComponentType,
    new (position?: Position) => CircuitComponent
  > = {
    ground: Ground,
    resistor: Resistor,
    led: LED,
    arduino: Arduino,
    button: Button,
  };

  /**
   * Получает компоненты по категориям
   */
  static getComponentsByCategory(): Record<ComponentCategory, {
    type: ComponentType;
    name: string;
    icon: string;
  }[]> {
    const allComponents = this.getAvailableComponents();
    
    return {
      [ComponentCategory.COMPONENT]: allComponents.filter(comp => 
        COMPONENT_CATEGORIES.COMPONENT.types.includes(comp.type)
      ),
      [ComponentCategory.MODULE]: allComponents.filter(comp => false),
      [ComponentCategory.CONTROLLER]: allComponents.filter(comp => 
        COMPONENT_CATEGORIES.CONTROLLER.types.includes(comp.type)
      ),
    };
  }

  static getComponentsForCategory(category: ComponentCategory): {
    type: ComponentType;
    name: string;
    icon: string;
  }[] {
    const categories = this.getComponentsByCategory();
    return categories[category] || [];
  }

  static getCategoryName(category: ComponentCategory): string {
    switch (category) {
      case ComponentCategory.COMPONENT:
        return COMPONENT_CATEGORIES.COMPONENT.name;
      case ComponentCategory.CONTROLLER:
        return COMPONENT_CATEGORIES.CONTROLLER.name;
      case ComponentCategory.MODULE:
        return 'Модули';
      default:
        return 'Неизвестная категория';
    }
  }

  static getCategoryIcon(category: ComponentCategory): string {
    switch (category) {
      case ComponentCategory.COMPONENT:
        return COMPONENT_CATEGORIES.COMPONENT.icon;
      case ComponentCategory.CONTROLLER:
        return COMPONENT_CATEGORIES.CONTROLLER.icon;
      case ComponentCategory.MODULE:
        return '📦';
      default:
        return '❓';
    }
  }

  static createComponent(
    type: ComponentType,
    position?: Position
  ): CircuitComponent {
    const ComponentClass = this.componentRegistry[type];

    if (!ComponentClass) {
      throw new Error(`Unknown component type: ${type}`);
    }

    return new ComponentClass(position);
  }

  static getAvailableComponents(): {
    type: ComponentType;
    name: string;
    icon: string;
  }[] {
    return [
      { type: 'ground', name: 'Земля', icon: '⏚' },
      { type: 'resistor', name: 'Резистор', icon: '📏' },
      { type: 'led', name: 'Светодиод', icon: '💡' },
      { type: 'button', name: 'Кнопка', icon: '🔘' },
      { type: 'arduino', name: 'Arduino Uno', icon: '🔌' },
    ];
  }

  static isValidComponentType(type: string): type is ComponentType {
    return type in this.componentRegistry;
  }

  static isComponentInCategory(type: ComponentType, category: ComponentCategory): boolean {
    switch (category) {
      case ComponentCategory.COMPONENT:
        return COMPONENT_CATEGORIES.COMPONENT.types.includes(type);
      case ComponentCategory.CONTROLLER:
        return COMPONENT_CATEGORIES.CONTROLLER.types.includes(type);
      case ComponentCategory.MODULE:
        return false;
      default:
        return false;
    }
  }

  static createComponentFromData(data: {
    type: string;
    position?: Position;
    properties?: Record<string, unknown>;
  }): CircuitComponent {
    if (!this.isValidComponentType(data.type)) {
      throw new Error(`Invalid component type: ${data.type}`);
    }

    const component = this.createComponent(data.type, data.position);

    if (data.properties) {
      component.properties = { ...component.properties, ...data.properties };
    }

    return component;
  }

  static createComponentFromSerialized(
    data: SerializedComponent
  ): CircuitComponent {
    if (!this.isValidComponentType(data.type)) {
      throw new Error(`Invalid component type: ${data.type}`);
    }

    const component = this.createComponent(data.type, data.position);
    component.id = data.id;
    component.rotation = data.rotation;
    component.properties = data.properties;

    return component;
  }

  static deserialize(data: SerializedComponent): CircuitComponent {
    if (!this.isValidComponentType(data.type)) {
      throw new Error(`Invalid component type: ${data.type}`);
    }

    const component = this.createComponent(data.type, data.position);
    component.id = data.id;
    component.rotation = data.rotation;
    component.properties = data.properties;
    
    this.validateComponentMethods(component);
    
    return component;
  }

  private static validateComponentMethods(component: CircuitComponent): void {
    const requiredMethods = [
      'getSVGString',
      'getSVGPreviewString',
      'clone',
      'validateProperties'
    ];

    for (const method of requiredMethods) {
      const compObj = component as unknown as Record<string, unknown>;
      if (typeof compObj[method as keyof typeof compObj] !== 'function') {}
    }
  }

  static getComponentIcon(type: ComponentType): string {
    const component = this.getAvailableComponents().find(
      (comp) => comp.type === type
    );
    return component?.icon || '❓';
  }

  static getComponentName(type: ComponentType): string {
    const component = this.getAvailableComponents().find(
      (comp) => comp.type === type
    );
    return component?.name || 'Unknown Component';
  }

  static getComponentCategory(type: ComponentType): ComponentCategory {
    if (COMPONENT_CATEGORIES.COMPONENT.types.includes(type)) {
      return ComponentCategory.COMPONENT;
    }
    if (COMPONENT_CATEGORIES.CONTROLLER.types.includes(type)) {
      return ComponentCategory.CONTROLLER;
    }
    return ComponentCategory.MODULE;
  }

  static getSVGPreview(type: ComponentType, size: number = 60): string {
    const component = this.createComponent(type);
    return component.getSVGPreviewString(size);
  }

  static getSVGString(
    type: ComponentType,
    isSelected: boolean = false
  ): string {
    const component = this.createComponent(type);
    return component.getSVGString(isSelected);
  }

  static getComponentSVG(
    component: CircuitComponent,
    isSelected: boolean = false
  ): string {
    return component.getSVGString(isSelected);
  }

  static getComponentPreviewSVG(
    component: CircuitComponent,
    size: number = 60
  ): string {
    return component.getSVGPreviewString(size);
  }
}