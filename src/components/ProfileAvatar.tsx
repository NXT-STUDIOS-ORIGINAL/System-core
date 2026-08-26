import React, { useState } from 'react';
import { useSystemCore } from '../context/SystemCoreContext';
import { User, Shield } from 'lucide-react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

interface ProfileAvatarProps {
  size?: AvatarSize | number;
  className?: string;
  showBorder?: boolean;
  showStatusIndicator?: boolean;
  statusOnline?: boolean;
  alt?: string;
  customSrc?: string | null;
  onClick?: () => void;
}

const SIZE_CLASSES: Record<AvatarSize, { container: string; icon: string; indicator: string }> = {
  xs: {
    container: 'w-6 h-6',
    icon: 'w-3.5 h-3.5',
    indicator: 'w-1.5 h-1.5 ring-1',
  },
  sm: {
    container: 'w-8 h-8',
    icon: 'w-4 h-4',
    indicator: 'w-2 h-2 ring-1',
  },
  md: {
    container: 'w-10 h-10',
    icon: 'w-5 h-5',
    indicator: 'w-2.5 h-2.5 ring-1.5',
  },
  lg: {
    container: 'w-14 h-14',
    icon: 'w-7 h-7',
    indicator: 'w-3 h-3 ring-2',
  },
  xl: {
    container: 'w-20 h-20',
    icon: 'w-10 h-10',
    indicator: 'w-3.5 h-3.5 ring-2',
  },
  '2xl': {
    container: 'w-24 h-24',
    icon: 'w-12 h-12',
    indicator: 'w-4 h-4 ring-2',
  },
  '3xl': {
    container: 'w-32 h-32',
    icon: 'w-16 h-16',
    indicator: 'w-4 h-4 ring-2',
  },
};

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  size = 'md',
  className = '',
  showBorder = true,
  showStatusIndicator = false,
  statusOnline = true,
  alt = 'Player Avatar',
  customSrc,
  onClick,
}) => {
  const { profileAvatar } = useSystemCore();
  const [imageError, setImageError] = useState(false);

  const activeSrc = customSrc !== undefined ? customSrc : profileAvatar;

  const sizeConfig = typeof size === 'string' ? SIZE_CLASSES[size] : null;
  const customDimensions = typeof size === 'number' ? { width: size, height: size } : undefined;

  return (
    <div
      onClick={onClick}
      style={customDimensions}
      className={`relative rounded-full shrink-0 flex items-center justify-center select-none overflow-hidden transition-all ${
        sizeConfig ? sizeConfig.container : ''
      } ${
        showBorder
          ? 'ring-2 ring-[#00f2ff]/40 bg-[#05070a] shadow-[0_0_12px_rgba(0,242,255,0.2)]'
          : 'bg-[#05070a]'
      } ${onClick ? 'cursor-pointer hover:ring-[#00f2ff] hover:scale-105' : ''} ${className}`}
    >
      {activeSrc && !imageError ? (
        <img
          src={activeSrc}
          alt={alt}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover rounded-full"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-[#0c1624] via-[#05070a] to-[#040810] flex items-center justify-center relative">
          {/* Cyber decorative grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(#00f2ff_1px,transparent_1px)] [background-size:6px_6px] opacity-15" />
          
          <User
            className={`text-[#00f2ff]/80 drop-shadow-[0_0_6px_rgba(0,242,255,0.4)] ${
              sizeConfig ? sizeConfig.icon : 'w-1/2 h-1/2'
            }`}
          />
        </div>
      )}

      {/* Online / Active status dot */}
      {showStatusIndicator && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-[#05070a] ${
            statusOnline ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]' : 'bg-slate-500'
          } ${sizeConfig ? sizeConfig.indicator : 'w-2 h-2 ring-1'}`}
        />
      )}
    </div>
  );
};
