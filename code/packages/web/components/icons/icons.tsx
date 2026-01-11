/**
 * Icon Library - VS Code style outline icons (shared).
 *
 * Note: These are React components intended for app UI.
 */

interface IconProps {
  className?: string;
  strokeWidth?: number | string;
}

const baseIconProps = {
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  viewBox: '0 0 24 24' as const,
};

/**
 * Project Type Icons
 */
export function AcademicIcon({ className = 'w-5 h-5 text-[#cccccc]', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h8M8 15h4" />
    </svg>
  );
}

export function IndustryIcon({ className = 'w-5 h-5 text-[#cccccc]', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

export function CodeDocsIcon({ className = 'w-5 h-5 text-[#cccccc]', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h4M6 12h4M6 16h4M14 8h4M14 12h2" />
    </svg>
  );
}

export function OtherIcon({ className = 'w-5 h-5 text-[#cccccc]', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

export function ProjectTypeIcon({ type, className, strokeWidth }: { type: 'academic' | 'industry' | 'code-docs' | 'other' } & IconProps) {
  if (type === 'academic') return <AcademicIcon className={className} strokeWidth={strokeWidth} />;
  if (type === 'industry') return <IndustryIcon className={className} strokeWidth={strokeWidth} />;
  if (type === 'code-docs') return <CodeDocsIcon className={className} strokeWidth={strokeWidth} />;
  return <OtherIcon className={className} strokeWidth={strokeWidth} />;
}

/**
 * Navigation Icons
 */
export function DashboardIcon({ className = 'w-4 h-4', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

export function ProjectsIcon({ className = 'w-4 h-4', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function SettingsIcon({ className = 'w-4 h-4', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
    </svg>
  );
}

/**
 * AI/Sparkle Icon
 */
export function SparkleIcon({ className = 'w-4 h-4', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

/**
 * Common Icons
 */
export function PlusIcon({ className = 'w-4 h-4', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function ChevronRightIcon({ className = 'w-4 h-4', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function ChevronLeftIcon({ className = 'w-4 h-4', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function MenuIcon({ className = 'w-4 h-4', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth}>
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

/**
 * Loading/Spinner Icon (use with animate-spin class for rotation)
 */
export function LoaderIcon({ className = 'w-5 h-5', strokeWidth = 2 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth} strokeLinecap="round">
      <circle cx="12" cy="12" r="10" opacity="0.2" />
      <path d="M12 2 A10 10 0 0 1 22 12" opacity="0.8" strokeDasharray="15.708 31.416" />
    </svg>
  );
}

/**
 * Microphone Icon
 */
export function MicIcon({ className = 'w-4 h-4', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

/**
 * Arrow/Send Icon
 */
export function ArrowRightIcon({ className = 'w-4 h-4', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/**
 * Project Actions
 */
export function DuplicateIcon({ className = 'w-4 h-4', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function TrashIcon({ className = 'w-4 h-4', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M6 6l1 16h10l1-16" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function PencilIcon({ className = 'w-4 h-4', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg className={className} {...baseIconProps} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}


