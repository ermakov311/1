import { CircuitComponent } from '../Component';
import { Position } from '../../types/schema';

export class Button extends CircuitComponent {
  constructor(position?: Position) {
    super('button' as any, 'Кнопка', '🔘', position, {
      pressed: false,
    } as any);
  }

  get width(): number { return 79; }
  get height(): number { return 65; }

  get pinPositions(): { [pinName: string]: Position } {
    return {
      pin1: { x: 0, y: this.height/2 },
      pin2: { x: this.width, y: this.height/2 },
    };
  }

  getSVGString(isSelected: boolean = false): string {
    return `
    <svg width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="6" width="${this.width-16}" height="${this.height-12}" rx="8" fill="var(--second-color)" stroke="var(--text-color)" stroke-width="2" />
      <circle cx="${this.width/2}" cy="${this.height/2}" r="10" fill="${(this.properties as any).pressed ? 'var(--button-color)' : '#383838'}" />
    </svg>`;
  }

  getSVGPreviewString(size: number = 60): string {
    return this.getSVGString(false);
  }

  clone(): Button {
    const cloned = new Button(this.position);
    cloned.id = this.id;
    cloned.rotation = this.rotation;
    cloned.properties = { ...this.properties };
    return cloned;
  }

  validateProperties(): boolean {
    return typeof (this.properties as any).pressed === 'boolean';
  }
}












































