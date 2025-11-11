import { CircuitComponent } from '../Component';
import { GroundProperties, Position } from '../../types/schema';

export class Ground extends CircuitComponent {
  constructor(position?: Position) {
    super(
      'ground', 
      'Земля', 
      '⏚', 
      position, 
      {
        voltage: 0
      } as GroundProperties
    );
  }

  get width(): number { return 130; }
  get height(): number { return 106; }

  get pinPositions(): { [pinName: string]: Position } {
    return {
      output: { x: this.width, y: this.height/2-5 }
    };
  }

  // Возвращаем SVG как строку
  getSVGString(isSelected: boolean = false): string {


    return `
      <svg width="130" height="106" viewBox="0 0 130 106" xmlns="http://www.w3.org/2000/svg">
      transform="rotate(${this.rotation} ${this.width/2} ${this.height/2})">
        <line x1="130" y1="48.4287" x2="71.1905" y2="48.4287" stroke="var(--text-color)" stroke-width="4"/>
        <path d="M72.2861 10.623L72.2861 94.6152L3.8252 52.6191L72.2861 10.623Z" stroke="var(--text-color)" stroke-width="4"/>
      </svg>
    `;
  }

  // Для превью в меню
  getSVGPreviewString(size: number = 60): string {
    return `
      <svg width="79" height="65" viewBox="0 0 130 106" xmlns="http://www.w3.org/2000/svg">
        <line  x1="130" y1="48.4287" x2="71.1905" y2="48.4287" stroke="var(--text-color)" stroke-width="4"/>
        <path d="M72.2861 10.623L72.2861 94.6152L3.8252 52.6191L72.2861 10.623Z" stroke="var(--text-color)" stroke-width="4" fill="none"/>
      </svg>
    `;
  }

  clone(): Ground {
    const cloned = new Ground(this.position);
    cloned.id = this.id;
    cloned.rotation = this.rotation;
    cloned.properties = { ...this.properties };
    return cloned;
  }

  // Валидация свойств для Ground
  validateProperties(): boolean {
    const props = this.properties as GroundProperties;
    return props.voltage >= 0 && props.voltage <= 1000; // 0-1000V reasonable range
  }

  
}