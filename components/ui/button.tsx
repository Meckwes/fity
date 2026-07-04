"use client";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    const variants = {
      primary: "bg-green-600 text-white hover:bg-green-700 hover:shadow-lg hover:-translate-y-0.5",
      secondary: "bg-white text-green-700 border-2 border-green-600 hover:bg-green-50",
      ghost: "bg-transparent text-ink-700 hover:text-green-700",
    };
    const sizes = {
      md: "px-5 py-2.5 text-sm",
      lg: "px-7 py-4 text-base",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
