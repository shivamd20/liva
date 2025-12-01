/**
 * AccessBadge - Beautiful badge component to display board access status
 */
import { Globe, Lock } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface AccessBadgeProps {
    access: 'public' | 'private';
    className?: string;
}

export function AccessBadge({ access, className = '' }: AccessBadgeProps) {
    const isPublic = access === 'public';

    const tooltipContent = isPublic ? (
        <div className="text-center max-w-xs">
            <div className="font-semibold mb-1">🌍 Public Board</div>
            <div className="text-xs opacity-90">
                Anyone with the link can view and collaborate on this board in real-time
            </div>
        </div>
    ) : (
        <div className="text-center max-w-xs">
            <div className="font-semibold mb-1">🔒 Private Board</div>
            <div className="text-xs opacity-90">
                Only you can access this board. Share it to enable collaboration
            </div>
        </div>
    );

    return (
        <Tooltip content={tooltipContent} position="bottom">
            <div
                className={`
          inline-flex items-center gap-1.5 px-3 py-2 rounded-full
          text-xs font-semibold
          transition-all duration-300 ease-in-out
          shadow-sm hover:shadow-md cursor-help
          h-6
          ${isPublic
                        ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600'
                        : 'bg-gradient-to-r from-slate-600 to-slate-700 text-white hover:from-slate-700 hover:to-slate-800'
                    }
          ${className}
        `}
            >
                {isPublic ? (
                    <>
                        <Globe className="w-6 h-6 animate-pulse" />
                        <span>Public</span>
                    </>
                ) : (
                    <>
                        <Lock className="w-6 h-6" />
                        <span>Private</span>
                    </>
                )}
            </div>
        </Tooltip>
    );
}
