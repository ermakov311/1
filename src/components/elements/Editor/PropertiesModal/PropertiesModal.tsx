'use client'

import React, { useState } from 'react'
import styles from './PropertiesModal.module.scss'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { updateComponentProperties } from '@/store/project/projectSlice'
import Portal from '@/components/UI/Portal/Portal'

interface PropsModalProps {
  componentId: string
  onClose: () => void
}

export default function PropertiesModal({ componentId, onClose }: PropsModalProps) {
  const dispatch = useDispatch()
  const comp = useSelector((s: RootState) => s.project.components.find((c) => c.id === componentId))

  const propsObj = (comp?.properties ?? {}) as Record<string, unknown>
  const [color, setColor] = useState<string>(typeof propsObj.color === 'string' ? propsObj.color : '#ff0000')
  const [resistance, setResistance] = useState<string>(String(typeof propsObj.resistance === 'number' ? propsObj.resistance : 1000))
  const [pressed, setPressed] = useState<boolean>(!!propsObj.pressed)

  const showColor = comp && typeof propsObj.color !== 'undefined'
  const showResistance = comp && typeof propsObj.resistance !== 'undefined'
  const showPressed = comp && typeof propsObj.pressed !== 'undefined'

  const handleSave = () => {
    const propsToSave: Record<string, unknown> = {}
    if (showColor) propsToSave.color = color
    if (showResistance) propsToSave.resistance = Math.max(0, Number(resistance) || 0)
    if (showPressed) propsToSave.pressed = !!pressed
    dispatch(updateComponentProperties({ id: componentId, properties: propsToSave }))
    onClose()
  }

  return (
    <Portal>
      <div className={styles.overlay} onMouseDown={onClose}>
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className={styles.header}>
            <h3>Свойства компонента</h3>
            <button className={styles.close} aria-label="Закрыть" onClick={onClose}>×</button>
          </div>
          <div className={styles.body}>
            {showColor && (
              <div className={styles.row}>
                <label>Цвет LED</label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
            )}
            {showPressed && (
              <div className={styles.row}>
                <label>Состояние кнопки</label>
                <input type="checkbox" checked={pressed} onChange={(e) => setPressed(e.target.checked)} />
              </div>
            )}
            {showResistance && (
              <div className={styles.row}>
                <label>Сопротивление</label>
                <div className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    type="text"
                    inputMode="numeric"
                    placeholder="Например, 220"
                    value={resistance}
                    onChange={(e) => setResistance(e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    autoFocus
                  />
                  <span className={styles.unit}>Ω</span>
                </div>
              </div>
            )}
            {!showColor && !showResistance && <div className={styles.empty}>Нет редактируемых свойств</div>}
          </div>
          <div className={styles.actions}>
            <button onClick={handleSave}>Сохранить</button>
            <button onClick={onClose}>Отмена</button>
          </div>
        </div>
      </div>
    </Portal>
  )
}


