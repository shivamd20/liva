/**
 * AccessButton - Interactive button to display and toggle board access status
 */
import { Globe, Lock } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface AccessButtonProps {
    access: 'public' | 'private';
    isOwner: boolean;
    onToggle?: () => void | Promise<void>;
    className?: string;
}

export function AccessButton({
    access,
    isOwner,
    onToggle,
    className = ''
}: AccessButtonProps) {
    const isPublic = access === 'public';

    const tooltipContent = isPublic ? (
        <div className="text-center max-w-xs">
            <div className="font-semibold mb-1">🌍 Public Board</div>
            <div className="text-xs opacity-90">
                Anyone with the link can view and collaborate on this board in real-time
            </div>
            {isOwner && (
                <div className="text-xs opacity-75 mt-1 pt-1 border-t border-white/20">
                    Click to make private
                </div>
            )}
        </div>
    ) : (
        <div className="text-center max-w-xs">
            <div className="font-semibold mb-1">🔒 Private Board</div>
            <div className="text-xs opacity-90">
                Only you can access this board. Share it to enable collaboration
            </div>
            {isOwner && (
                <div className="text-xs opacity-75 mt-1 pt-1 border-t border-white/20">
                    Click to make public
                </div>
            )}
        </div>
    );

    const handleClick = () => {
        if (isOwner && onToggle) {
            onToggle();
        }
    };

    return (
        <Tooltip content={tooltipContent} position="bottom">
            <button
                onClick={handleClick}
                disabled={!isOwner}
                className={`
          inline-flex items-center justify-center gap-2 px-4 rounded-full
          h-8
          text-sm font-semibold
          transition-all duration-300 ease-in-out
          shadow-sm hover:shadow-md
          ${isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}
          ${isPublic
                        ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600'
                        : 'bg-gradient-to-r from-slate-600 to-slate-700 text-white hover:from-slate-700 hover:to-slate-800'
                    }
          ${!isOwner ? 'opacity-90' : ''}
          ${className}
        `}
                aria-label={isPublic ? 'Make board private' : 'Make board public'}
            >
                {isPublic ? (
                    <>
                        <Globe className="w-4 h-4 animate-pulse" />
                        <span>Public</span>
                    </>
                ) : (
                    <>
                        <Lock className="w-4 h-4" />
                        <span>Private</span>
                    </>
                )}
            </button>
        </Tooltip>
    );
}
