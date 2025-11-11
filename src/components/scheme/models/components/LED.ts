import { CircuitComponent } from '../Component';
import { LEDProperties, Position } from '../../types/schema';

export class LED extends CircuitComponent {
  private isOn: boolean = false;

  constructor(position?: Position) {
    super('led', 'Светодиод', '💡', position, {
      color: '#ff0000',
      forwardVoltage: 2.0,
      maxCurrent: 20,
    } as LEDProperties);
  }

  get width(): number {
    return 160;
  }
  get height(): number {
    return 89;
  }

  get pinPositions(): { [pinName: string]: Position } {
    return {
      // Поменяли местами выводы: катод слева, анод справа
      cathode: { x: 0, y:this.height/2 },
      anode: { x: this.width, y: this.height/2 }
    };
  }

  getSVGString(isSelected: boolean = false): string {
    
     return `
       <svg width="160" height="89" viewBox="0 0 160 89" fill="none" xmlns="http://www.w3.org/2000/svg">
       transform="rotate(${this.rotation} ${this.width/2} ${this.height/2})">
<path d="M80.0002 2C103.441 2.00008 122.445 21.0031 122.445 44.4443C122.445 67.8855 103.441 86.8886 80.0002 86.8887C56.559 86.8887 37.556 67.8856 37.5559 44.4443C37.5559 21.0031 56.559 2 80.0002 2Z" stroke="var(--text-color)" stroke-width="4"/>
<path d="M107.777 16.348V72.5424L59.1113 44.4457L107.777 16.348Z" stroke="var(--text-color)" stroke-width="4"/>
<line x1="57.1113" y1="8.00073" x2="57.1113" y2="80.8892" stroke="var(--text-color)" stroke-width="4"/>
<line x1="37.333" y1="44.6672" x2="-0.000110626" y2="44.6672" stroke="var(--text-color)" stroke-width="4"/>
<line x1="160" y1="44.6672" x2="122.667" y2="44.6672" stroke="var(--text-color)" stroke-width="4"/>
</svg>
    `;
  }

  getSVGPreviewString(size: number = 60): string {
    
    return `
      <svg width="79" height="65" viewBox="0 0 97 97" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M32.9179 32.4933C41.5834 23.8279 55.6331 23.8278 64.2985 32.4933C72.9639 41.1587 72.9639 55.2085 64.2985 63.8739C55.6331 72.5393 41.5834 72.5393 32.9179 63.8739C24.2524 55.2084 24.2524 41.1587 32.9179 32.4933Z" stroke="var(--text-color)" stroke-width="4"/>
<path d="M48.9571 28.4412L68.3507 47.8348L41.8577 54.9349L48.9571 28.4412Z" stroke="var(--text-color)" stroke-width="4"/>
<line x1="26.4184" y1="42.3221" x2="54.4696" y2="70.3734" stroke="var(--text-color)" stroke-width="4"/>
<line x1="32.9176" y1="65.3341" x2="18.5499" y2="79.7019" stroke="var(--text-color)" stroke-width="4"/>
<line x1="80.1264" y1="18.1252" x2="65.7587" y2="32.4929" stroke="var(--text-color)" stroke-width="4"/>
</svg>

    `;
  }

  clone(): LED {
    const cloned = new LED(this.position);
    cloned.id = this.id;
    cloned.rotation = this.rotation;
    cloned.properties = { ...this.properties };
    return cloned;
  }

  validateProperties(): boolean {
    const props = this.properties as LEDProperties;
    const hexColorRegex = /^#([0-9A-F]{3}){1,2}$/i;

    return (
      hexColorRegex.test(props.color) &&
      props.forwardVoltage >= 1.5 &&
      props.forwardVoltage <= 4.0 &&
      props.maxCurrent >= 5 &&
      props.maxCurrent <= 100
    );
  }

  // Методы для управления состоянием светодиода
  turnOn(): void {
    this.isOn = true;
  }

  turnOff(): void {
    this.isOn = false;
  }

  toggle(): void {
    this.isOn = !this.isOn;
  }

  getIsOn(): boolean {
    return this.isOn;
  }

  // Получение цвета с прозрачностью для эффектов
  getColorWithAlpha(alpha: number): string {
    const props = this.properties as LEDProperties;
    const hex = props.color.replace('#', '');

    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  
}
