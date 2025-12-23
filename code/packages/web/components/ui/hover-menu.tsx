'use client';

import { useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface HoverMenuProps {
  /** Content to render as the trigger (what you hover over) - optional if using external trigger */
  trigger?: ReactNode;
  /** Content to render in the menu */
  menu: ReactNode;
  /** Position of the menu relative to trigger */
  position?: 'left' | 'right' | 'top' | 'bottom';
  /** Offset from trigger in pixels */
  offset?: { x?: number; y?: number };
  /** Delay before hiding when mouse leaves (ms) - will be doubled for gap detection */
  hideDelay?: number;
  /** Delay before showing when mouse enters (ms) */
  showDelay?: number;
  /** Whether to show the menu (controlled mode) */
  visible?: boolean;
  /** Callback when menu visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
  /** Custom className for the menu wrapper */
  menuClassName?: string;
  /** Custom style for the menu wrapper */
  menuStyle?: React.CSSProperties;
  /** Whether to use portal (for z-index issues) */
  usePortal?: boolean;
  /** Expand hit area around menu (pixels) */
  hitAreaPadding?: number;
  /** External trigger ref (for cases where trigger is outside this component) */
  externalTriggerRef?: React.RefObject<HTMLElement>;
  /** Custom position calculation function */
  getPosition?: () => { top: number; left: number };
  /** Callback when mouse enters menu (to cancel parent hide timeouts) */
  onMenuMouseEnter?: () => void;
}

/**
 * HoverMenu - A reusable hover menu component
 * 
 * Shows a menu when hovering over a trigger element, with configurable
 * delays and positioning. Handles gaps between trigger and menu gracefully.
 */
export function HoverMenu({
  trigger,
  menu,
  position = 'right',
  offset = { x: 10, y: 0 },
  hideDelay = 300,
  showDelay = 0,
  visible: controlledVisible,
  onVisibilityChange,
  menuClassName = '',
  menuStyle = {},
  usePortal = false,
  hitAreaPadding = 30,
  externalTriggerRef,
  getPosition,
  onMenuMouseEnter,
}: HoverMenuProps) {
  const [internalVisible, setInternalVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isMouseOverTriggerRef = useRef(false);
  const isMouseOverMenuRef = useRef(false);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);

  // Controlled vs uncontrolled visibility
  const visible = controlledVisible !== undefined ? controlledVisible : internalVisible;
  const setVisible = useCallback((value: boolean) => {
    if (controlledVisible === undefined) {
      setInternalVisible(value);
    }
    onVisibilityChange?.(value);
  }, [controlledVisible, onVisibilityChange]);

  // Ensure we're mounted (for portal)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate menu position
  const updateMenuPosition = useCallback(() => {
    // Use custom position function if provided
    if (getPosition) {
      const pos = getPosition();
      setMenuPosition(pos);
      return;
    }

    // Use external trigger ref if provided
    const triggerElement = externalTriggerRef?.current || triggerRef.current;
    if (!triggerElement) return;

    const triggerRect = triggerElement.getBoundingClientRect();
    let top = triggerRect.top;
    let left = triggerRect.left;

    switch (position) {
      case 'right':
        left = triggerRect.right + (offset.x ?? 10);
        top = triggerRect.top + (offset.y ?? 0);
        break;
      case 'left':
        left = triggerRect.left - (offset.x ?? 10);
        top = triggerRect.top + (offset.y ?? 0);
        break;
      case 'top':
        left = triggerRect.left + (offset.x ?? 0);
        top = triggerRect.top - (offset.y ?? 10);
        break;
      case 'bottom':
        left = triggerRect.left + (offset.x ?? 0);
        top = triggerRect.bottom + (offset.y ?? 10);
        break;
    }

    setMenuPosition({ top, left });
  }, [position, offset, externalTriggerRef, getPosition]);

  // Handle trigger mouse enter
  const handleTriggerMouseEnter = useCallback(() => {
    isMouseOverTriggerRef.current = true;
    
    // Clear any pending hide
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // Show with delay
    if (showDelay > 0) {
      showTimeoutRef.current = setTimeout(() => {
        updateMenuPosition();
        setVisible(true);
        showTimeoutRef.current = null;
      }, showDelay);
    } else {
      updateMenuPosition();
      setVisible(true);
    }
  }, [showDelay, updateMenuPosition, setVisible]);

  // Handle trigger mouse leave
  const handleTriggerMouseLeave = useCallback(() => {
    isMouseOverTriggerRef.current = false;
    
    // Clear any pending show
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    // Hide with delay (to allow moving to menu)
    hideTimeoutRef.current = setTimeout(() => {
      if (!isMouseOverTriggerRef.current && !isMouseOverMenuRef.current) {
        setVisible(false);
      }
      hideTimeoutRef.current = null;
    }, hideDelay);
  }, [hideDelay, setVisible]);

  // Handle menu mouse enter
  const handleMenuMouseEnter = useCallback(() => {
    isMouseOverMenuRef.current = true;
    
    // Clear any pending hide
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    // Notify parent to cancel any hide timeouts
    onMenuMouseEnter?.();
    
    // Ensure menu stays visible
    setVisible(true);
  }, [setVisible, onMenuMouseEnter]);

  // Handle menu mouse leave
  const handleMenuMouseLeave = useCallback(() => {
    isMouseOverMenuRef.current = false;
    
    // Clear any pending show
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    // Hide with delay (to allow moving back to trigger)
    // Use shorter delay when leaving menu (user is done)
    hideTimeoutRef.current = setTimeout(() => {
      if (!isMouseOverTriggerRef.current && !isMouseOverMenuRef.current) {
        setVisible(false);
      }
      hideTimeoutRef.current = null;
    }, hideDelay);
  }, [hideDelay, setVisible]);

  // Global mouse move listener to handle gaps
  useEffect(() => {
    if (!visible) return;

    let gapHideTimeout: NodeJS.Timeout | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      // Clear any pending hide
      if (gapHideTimeout) {
        clearTimeout(gapHideTimeout);
        gapHideTimeout = null;
      }

      // Check if mouse is over trigger (internal or external)
      let isOverTrigger = false;
      const triggerElement = externalTriggerRef?.current || triggerRef.current;
      if (triggerElement) {
        const rect = triggerElement.getBoundingClientRect();
        isOverTrigger =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
      }

      // Check if mouse is over menu (with padding for gaps)
      let isOverMenu = false;
      if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        isOverMenu =
          e.clientX >= rect.left - hitAreaPadding &&
          e.clientX <= rect.right + hitAreaPadding &&
          e.clientY >= rect.top - hitAreaPadding &&
          e.clientY <= rect.bottom + hitAreaPadding;
      }

      // Update refs
      isMouseOverTriggerRef.current = isOverTrigger;
      isMouseOverMenuRef.current = isOverMenu;

      // Hide if mouse is not over either (with delay to allow moving through gap)
      // Use longer delay for gaps to give user time to move mouse
      if (!isOverTrigger && !isOverMenu) {
        gapHideTimeout = setTimeout(() => {
          if (!isMouseOverTriggerRef.current && !isMouseOverMenuRef.current) {
            setVisible(false);
          }
        }, Math.max(hideDelay * 2, 600)); // At least 600ms delay for gaps
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (gapHideTimeout) {
        clearTimeout(gapHideTimeout);
      }
    };
  }, [visible, hideDelay, hitAreaPadding, setVisible]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Update position when visible changes
  useEffect(() => {
    if (visible) {
      updateMenuPosition();
    }
  }, [visible, updateMenuPosition]);

  const menuElement = (
    <div
      ref={menuRef}
      className={menuClassName}
      style={{
        position: usePortal ? 'fixed' : 'absolute',
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        zIndex: 999999,
        pointerEvents: 'auto',
        ...menuStyle,
      }}
      onMouseEnter={handleMenuMouseEnter}
      onMouseLeave={handleMenuMouseLeave}
    >
      {menu}
    </div>
  );

  // Set up external trigger event listeners
  useEffect(() => {
    if (!externalTriggerRef?.current) return;
    
    const element = externalTriggerRef.current;
    const handleEnter = () => handleTriggerMouseEnter();
    const handleLeave = () => handleTriggerMouseLeave();
    
    element.addEventListener('mouseenter', handleEnter);
    element.addEventListener('mouseleave', handleLeave);
    
    return () => {
      element.removeEventListener('mouseenter', handleEnter);
      element.removeEventListener('mouseleave', handleLeave);
    };
  }, [externalTriggerRef, handleTriggerMouseEnter, handleTriggerMouseLeave]);

  return (
    <>
      {trigger && (
        <div
          ref={triggerRef}
          onMouseEnter={handleTriggerMouseEnter}
          onMouseLeave={handleTriggerMouseLeave}
          style={{ display: 'inline-block' }}
        >
          {trigger}
        </div>
      )}
      
      {visible && mounted && (
        usePortal ? createPortal(menuElement, document.body) : menuElement
      )}
    </>
  );
}

