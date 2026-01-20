import * as React from "react"
import { cn } from "@/lib/utils"

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
    value?: number[];
    max?: number;
    step?: number;
    onValueChange?: (value: number[]) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
    ({ className, value, max = 100, step = 1, onValueChange, ...props }, ref) => {
        const val = value ? value[0] : 0;

        return (
            <input
                type="range"
                ref={ref}
                value={val}
                max={max}
                step={step}
                onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
                className={cn(
                    "w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary",
                    className
                )}
                {...props}
            />
        )
    }
)
Slider.displayName = "Slider"

export { Slider }
