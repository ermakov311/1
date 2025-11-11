import { CircuitComponent } from '../Component';
import { ResistorProperties, Position } from '../../types/schema';


export class Resistor extends CircuitComponent {
  constructor(position?: Position) {
    super('resistor', 'Резистор', '📏', position, {
      resistance: 220,
      tolerance: 5,
      power: 0.25,
    } as ResistorProperties);
  }

  get width(): number {
    return 160;
  }
  get height(): number {
    return 30;
  }

  get pinPositions(): { [pinName: string]: Position } {
    return {
      pin1: { x: 0, y: this.height / 2 }, // Левая сторона по центру
      pin2: { x: this.width, y: this.height / 2 }, // Правая сторона по центру
    };
  }

  getSVGString(isSelected: boolean = false): string {
    return `
     <svg width="161" height="30" viewBox="0 0 161 30" fill="none" xmlns="http://www.w3.org/2000/svg"> 
     transform="rotate(${this.rotation} ${this.width / 2} ${this.height / 2})">
<line y1="14.8748" x2="44.8166" y2="14.8748" stroke="var(--text-color)" stroke-width="4"/>
<line x1="115.58" y1="14.5118" x2="160.396" y2="14.5118" stroke="var(--text-color)" stroke-width="4"/>
<rect x="46.4534" y="2" width="67.126" height="25.2125" stroke="var(--text-color)" stroke-width="4"/> 



</svg>
    `;
  }

  getSVGPreviewString(size: number = 60): string {
    return `
     <svg width="79" height="65" viewBox="0 0 79 79" fill="none" xmlns="http://www.w3.org/2000/svg">
<line x1="5.6163" y1="72.4442" x2="24.2886" y2="53.7718" stroke="var(--text-color)" stroke-width="4"/>
<line x1="53.6202" y1="24.1375" x2="72.2925" y2="5.4652" stroke="var(--text-color)" stroke-width="4"/>
<rect x="21.3497" y="48.3066" width="37.9086" height="13.2125" transform="rotate(-45 21.3497 48.3066)" stroke="var(--text-color)" stroke-width="4"/>
</svg>
    `;
  }

  clone(): Resistor {
    const cloned = new Resistor(this.position);
    cloned.id = this.id;
    cloned.rotation = this.rotation;
    cloned.properties = { ...this.properties };
    return cloned;
  }

  validateProperties(): boolean {
    const props = this.properties as ResistorProperties;
    return (
      props.resistance > 0 &&
      props.resistance <= 10000000 && // 10MΩ max
      props.tolerance >= 1 &&
      props.tolerance <= 20 &&
      props.power > 0 &&
      props.power <= 10 // 10W max
    );
  }

  getResistanceString(): string {
    const props = this.properties as ResistorProperties;
    if (props.resistance >= 1000) {
      return `${(props.resistance / 1000).toFixed(1)}kΩ`;
    }
    return `${props.resistance}Ω`;
  }
}
