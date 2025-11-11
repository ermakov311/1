'use client'

import style from './EditorMenu.module.scss'

interface EditorMenuProps{
    leftButtonName: string;
    rightButtonName: string;
    onClickFirstButton?:() => void;
    onClickSecondButton?:() => void;
    disabled?: boolean | undefined;
    leftDisabled?: boolean | undefined;
    rightDisabled?: boolean | undefined;
    extraButtonName?: string;
    onClickExtraButton?: () => void;
    extraDisabled?: boolean | undefined;
}

const EditorMenu = ({leftButtonName, rightButtonName, onClickFirstButton,onClickSecondButton, disabled, leftDisabled, rightDisabled, extraButtonName, onClickExtraButton, extraDisabled} : EditorMenuProps) => {
  return (
    <div className={style.controls}>
      <button
        onClick={onClickFirstButton}
        disabled={leftDisabled ?? disabled}
        className={`${style.button}`}
      >
        {leftButtonName}
      </button>

      <button
        onClick={onClickSecondButton}
        disabled={rightDisabled ?? disabled}
        className={`${style.button} ${style.clearButton}`}
      >
        {rightButtonName}
      </button>
      {extraButtonName && (
        <button
          onClick={onClickExtraButton}
          disabled={extraDisabled ?? disabled}
          className={`${style.button}`}
        >
          {extraButtonName}
        </button>
      )}
    </div>
  );
};

export default EditorMenu;
