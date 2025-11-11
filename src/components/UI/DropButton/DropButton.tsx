'use client'

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedGroup } from '@/store/groups/groupsSlice';
import { RootState } from '@/store/store';
import style from './DropButton.module.scss';
import { apiGet } from '@api';

interface DropButtonProps {
  name: string;
  options?: string[] ;
  isOpen?: boolean;
  link?: string;
  addFile?: boolean;
  onClose?: () => void;
  onToggle?: (isOpen: boolean) => void;
  onSelected?: string;
  customContent?: React.ReactNode; 
  children?: React.ReactNode; 
  // Optional: remote items support
  itemsApi?: string; // GET endpoint returning array of { id, name } or { items: [...] }
  itemHrefBase?: string; // base href for each item, default `/${link}`
}

const DropButton = ({
  name,
  options,
  link,
  addFile,
  onToggle,
  onSelected,
  customContent,
  children,
  itemsApi,
  itemHrefBase,
}: DropButtonProps) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const selected = useSelector(
    (state: RootState) => state.groups.selectedGroup
  );

  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [animationClass, setAnimationClass] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [remoteItems, setRemoteItems] = useState<Array<{ id: string | number; name: string }>>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  useEffect(() => {
    if (!pathname.startsWith(`/${link}/`)) {
      closeDropdown();
      dispatch(setSelectedGroup(''));
    }
  }, [pathname]);

  const toggleDropDown = () => {
    if (isAnimating) return;

    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  const openDropdown = () => {
    setIsVisible(true);
    setIsOpen(true);
    setIsAnimating(true);
    setAnimationClass('');
    onToggle?.(true);
    // Lazy-load items when needed
    if (itemsApi && remoteItems.length === 0 && !isLoadingItems) {
      setIsLoadingItems(true);
      setItemsError(null);
      apiGet<unknown>(itemsApi)
        .then((data) => {
          const tryArrays: unknown[] = [
            data,
            (data as Record<string, unknown>)?.items,
            (data as Record<string, unknown>)?.data,
            (data as Record<string, unknown>)?.groups,
          ];
          const list = tryArrays.find((x) => Array.isArray(x)) as Array<Record<string, unknown>> | undefined;
          const normalized = (list ?? [])
            .map((it) => ({ id: (it.id as string | number | undefined) ?? (it.name as string | undefined), name: String((it.name as string | undefined) ?? (it.title as string | undefined) ?? '') }))
            .filter((it) => it.name);
          setRemoteItems(normalized);
        })
        .catch((e: { message?: string }) => setItemsError(e?.message ?? 'Ошибка загрузки'))
        .finally(() => setIsLoadingItems(false));
    }
  };

  const closeDropdown = () => {
    if (!isOpen) return;

    setIsAnimating(true);
    setAnimationClass(style.closing);
    onToggle?.(false);
    setSelectedOption('');
  };

  const handleOptionClick = (option: string, e: React.MouseEvent) => {
    e.preventDefault();
    dispatch(setSelectedGroup(option));
    setSelectedOption(option);
    router.push(`/${link}/${option}`);
  };

  const handleAnimationEnd = () => {
    if (animationClass === style.closing) {
      setIsVisible(false);
      setIsOpen(false);
    }
    setAnimationClass('');
    setIsAnimating(false);
  };

  const renderDefaultContent = () => (
    <ul className={animationClass} onAnimationEnd={handleAnimationEnd}>
      {options?.map((option) => (
        <li className={option === selected ? style.active : ''} key={option}>
          <Link
            href={`/${link}/${option}`}
            onClick={(e) => handleOptionClick(option, e)}
          >
            {option}
          </Link>
        </li>
      ))}
    </ul>
  );

  const renderCustomContent = () => (
    <ul className={`${animationClass} ${style.list} ${style.inline}`} onAnimationEnd={handleAnimationEnd}>
      {customContent || children}
    </ul>
  );

  const renderRemoteItemsContent = () => (
    <ul className={`${animationClass} ${style.list}`} onAnimationEnd={handleAnimationEnd}>
      {isLoadingItems && <li>Загрузка...</li>}
      {itemsError && <li>Ошибка: {itemsError}</li>}
      {!isLoadingItems && !itemsError && remoteItems.length === 0 && (
        <li>Нет данных</li>
      )}
      {!isLoadingItems && !itemsError && remoteItems.map((item) => (
        <li key={item.id} className={item.name === selected ? style.active : ''}>
          <Link href={`${itemHrefBase ?? `/${link}`}/${encodeURIComponent(item.name)}`} onClick={(e) => handleOptionClick(item.name, e)}>
            {item.name}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={style.dropButton}>
      <button onClick={toggleDropDown}>
        {name}
        <span>
          {addFile && (
            <div className={style.iconAdd}>
              <svg
                width="27"
                height="27"
                viewBox="0 0 27 27"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M15 13H27V15H15V27H13V15H0V13H13V0H15V13Z"
                  fill="white"
                />
              </svg>
            </div>
          )}
          <svg
            width="27"
            height="27"
            viewBox="0 0 30 30"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`${style.icon} ${
              isOpen && !animationClass ? style.rotated : ''
            }`}
          >
            <g clipPath="url(#clip0_200_60)">
              <path
                d="M5.625 17.625L15 8.25L24.375 17.625L21.75 20.25L15 13.5L8.25 20.25L5.625 17.625Z"
                fill="white"
              />
              <path
                d="M28.125 15C28.125 22.3125 22.3125 28.125 15 28.125C7.6875 28.125 1.875 22.3125 1.875 15C1.875 7.6875 7.6875 1.875 15 1.875C22.3125 1.875 28.125 7.6875 28.125 15ZM30 15C30 6.75 23.25 0 15 0C6.75 0 0 6.75 0 15C0 23.25 6.75 30 15 30C23.25 30 30 23.25 30 15Z"
                fill="white"
              />
            </g>
            <defs>
              <clipPath id="clip0_200_60">
                <rect width="30" height="30" fill="white" />
              </clipPath>
            </defs>
          </svg>
        </span>
      </button>

      {isVisible && (
        <div className={style.list}>
          {itemsApi
            ? renderRemoteItemsContent()
            : (customContent || children)
              ? renderCustomContent()
              : renderDefaultContent()}
        </div>
      )}
    </div>
  );
};

export default DropButton;
