import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
}

export const AppLogo: React.FC<AppLogoProps> = ({ className = '', size = 20 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Precision C-Glyph with chamfered inner curvature and optical weight */}
      <path
        d="M17.5 7.2C16.1 5.2 13.8 4 11.2 4C6.7 4 3 7.6 3 12C3 16.4 6.7 20 11.2 20C13.8 20 16.1 18.8 17.5 16.8"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
};
