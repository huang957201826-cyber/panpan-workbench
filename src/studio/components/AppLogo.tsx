import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
}

/** C · 折角入口：黑底白 C，右上角折角；与安装包/PWA 图标同源 */
export const AppLogo: React.FC<AppLogoProps> = ({ className = 'w-4 h-4', size = 16 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="5.5" fill="#0A0A0B" />
      <path
        d="M17 7.2C15.9 6 14 5.2 12 5.2C7.6 5.2 4.2 8.6 4.2 12C4.2 15.4 7.6 18.8 12 18.8C14 18.8 15.9 18 17 16.8"
        stroke="#FFFFFF"
        strokeWidth="3.4"
        strokeLinecap="square"
      />
      <path d="M17 7.2L20.6 3.6V7.2Z" fill="#FFFFFF" />
    </svg>
  );
};
