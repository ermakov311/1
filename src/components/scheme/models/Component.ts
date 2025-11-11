import {
  Position,
  ComponentProperties,
  SerializedComponent,
  ComponentType,
} from '../types/schema';

export abstract class CircuitComponent {
  public id: string;
  public rotation: number = 0;

  constructor(
    public type: ComponentType,
    public name: string,
    public icon: string,
    public position: Position = { x: 0, y: 0 },
    public properties: ComponentProperties
  ) {
    this.id = `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Абстрактные методы
  abstract get width(): number;
  abstract get height(): number;
  abstract get pinPositions(): { [pinName: string]: Position };
  abstract clone(): CircuitComponent;
  abstract validateProperties(): boolean;
  abstract getSVGString(isSelected?: boolean): string;
  abstract getSVGPreviewString(size?: number): string;

  getSVGWithPins(isSelected: boolean = false): string {
    const baseSVG = this.getSVGString(isSelected);

    // Создаем временный элемент для парсинга SVG
    const parser = new DOMParser();
    const doc = parser.parseFromString(baseSVG, 'image/svg+xml');
    const svgElement = doc.documentElement;

    // Добавляем точки для каждого пина
    Object.entries(this.pinPositions).forEach(([pinName, position]) => {
      const circle = doc.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle'
      );
      circle.setAttribute('cx', position.x.toString());
      circle.setAttribute('cy', position.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#ff4444');
      circle.setAttribute('stroke', '#ffffff');
      circle.setAttribute('stroke-width', '1');
      circle.setAttribute('class', 'component-pin');
      circle.setAttribute('data-pin-name', pinName);
      circle.setAttribute('data-component-id', this.id);
      circle.setAttribute('style', 'cursor: crosshair; pointer-events: all;');

      svgElement.appendChild(circle);
    });

    return new XMLSerializer().serializeToString(svgElement);
  }

  private getPinsSVG(): string {
    let pinsSVG = '';

    for (const [pinName, position] of Object.entries(this.pinPositions)) {
      pinsSVG += `
        <circle 
          cx="${position.x}" 
          cy="${position.y}" 
          r="5" 
          fill="#ff4444" 
          stroke="#fff" 
          stroke-width="1"
          class="component-pin"
          data-pin-name="${pinName}"
          style="cursor: pointer;"
        />
      `;
    }

    return pinsSVG;
  }

  getRotatedSVGString(isSelected: boolean = false): string {
    const svgContent = this.getSVGString(isSelected);

    if (this.rotation === 0) {
      return svgContent;
    }

    // Создаем временный элемент для парсинга SVG
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgElement = doc.documentElement;

    // Получаем размеры SVG
    const width = parseFloat(svgElement.getAttribute('width') || '0');
    const height = parseFloat(svgElement.getAttribute('height') || '0');

    // Добавляем transform для поворота
    svgElement.setAttribute(
      'transform',
      `rotate(${this.rotation} ${width / 2} ${height / 2})`
    );

    return new XMLSerializer().serializeToString(svgElement);
  }

  protected getBaseSVGString(
    content: string,
    isSelected: boolean = false
  ): string {
    return `
      <svg width="${this.width}" height="${this.height}" viewBox="0 0 ${
      this.width
    } ${this.height}" xmlns="http://www.w3.org/2000/svg">
        ${content}
        ${isSelected ? this.getSelectionOverlay() : ''}
      </svg>
    `;
  }

  protected getSelectionOverlay(): string {
    return `<rect x="0" y="0" width="${this.width}" height="${this.height}" fill="none" stroke="#2196f3" stroke-width="2" stroke-dasharray="5,3"/>`;
  }

  // Получение абсолютной позиции пина
  getAbsolutePinPosition(pinName: string): Position {
    const relPos = this.pinPositions[pinName];
    if (!relPos) {
      throw new Error(`Pin ${pinName} not found in component ${this.id}`);
    }

    // Если поворота нет, просто возвращаем позицию
    if (this.rotation === 0) {
      return {
        x: this.position.x + relPos.x,
        y: this.position.y + relPos.y,
      };
    }

    // Центр компонента в мировых координатах
    const centerX = this.position.x + this.width / 2;
    const centerY = this.position.y + this.height / 2;

    // Позиция пина относительно центра компонента
    const relX = relPos.x - this.width / 2;
    const relY = relPos.y - this.height / 2;

    // Преобразуем градусы в радианы
    const radians = (this.rotation * Math.PI) / 180;

    // Поворачиваем точку относительно центра
    const rotatedX = relX * Math.cos(radians) - relY * Math.sin(radians);
    const rotatedY = relX * Math.sin(radians) + relY * Math.cos(radians);

    // Возвращаем абсолютные координаты
    return {
      x: centerX + rotatedX,
      y: centerY + rotatedY,
    };
  }

  // Применение поворота к позиции
  private applyRotation(position: Position): Position {
    if (this.rotation === 0) return position;

    // Конвертируем градусы в радианы
    const radians = (this.rotation * Math.PI) / 180;

    // Центр компонента
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    // Смещаем точку относительно центра
    const x = position.x - centerX;
    const y = position.y - centerY;

    // Применяем матрицу поворота
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const rotatedX = x * cos - y * sin;
    const rotatedY = x * sin + y * cos;

    // Возвращаем обратно к абсолютным координатам
    return {
      x: rotatedX + centerX,
      y: rotatedY + centerY,
    };
  }

  // Получение bounding box компонента (для отладки)
  getBoundingBox(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.width,
      height: this.height,
    };
  }

  // Проверка попадания в компонент
  containsPoint(point: Position): boolean {
    const contains =
      point.x >= this.position.x &&
      point.x <= this.position.x + this.width &&
      point.y >= this.position.y &&
      point.y <= this.position.y + this.height;
    return contains;
  }

  // Проверка попадания в пин
  getPinAtPoint(point: Position, tolerance: number = 8): string | null {
    for (const [pinName] of Object.entries(this.pinPositions)) {
      try {
        const absPos = this.getAbsolutePinPosition(pinName);
        const distance = Math.sqrt(
          Math.pow(point.x - absPos.x, 2) + Math.pow(point.y - absPos.y, 2)
        );

        if (distance <= tolerance) {
          return pinName;
        }
      } catch (error) {
        console.error(`Error checking pin ${pinName}:`, error);
      }
    }
    return null;
  }

  // Сериализация
  serialize(): SerializedComponent {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      icon: this.icon,
      position: { ...this.position },
      rotation: this.rotation,
      properties: { ...this.properties },
    };
  }

  // Перемещение
  moveBy(delta: Position): void {
    this.position.x += delta.x;
    this.position.y += delta.y;
  }

  moveTo(position: Position): void {
    this.position = position;
  }

  // Поворот
  rotate(degrees: number): void {
    this.rotation = degrees;
  }
}
