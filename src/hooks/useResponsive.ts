/**
 * useResponsive - Hook to detect screen size and device type
 * Returns responsive breakpoint information for conditional rendering
 */
import { useState, useEffect } from 'react';

export interface ResponsiveState {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    width: number;
    height: number;
}

const BREAKPOINTS = {
    mobile: 768,
    tablet: 1024,
} as const;

export function useResponsive(): ResponsiveState {
    const [state, setState] = useState<ResponsiveState>(() => {
        const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
        const height = typeof window !== 'undefined' ? window.innerHeight : 768;

        return {
            isMobile: width < BREAKPOINTS.mobile,
            isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
            isDesktop: width >= BREAKPOINTS.tablet,
            width,
            height,
        };
    });

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;

            setState({
                isMobile: width < BREAKPOINTS.mobile,
                isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
                isDesktop: width >= BREAKPOINTS.tablet,
                width,
                height,
            });
        };

        // Use ResizeObserver for better performance if available
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(handleResize);
            resizeObserver.observe(document.body);

            return () => {
                resizeObserver.disconnect();
            };
        } else {
            // Fallback to window resize event
            window.addEventListener('resize', handleResize);
            return () => {
                window.removeEventListener('resize', handleResize);
            };
        }
    }, []);

    return state;
}
