import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const buttonVariants = "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  const cn = twMerge(
    buttonVariants,
    variant === "default" && "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-primary-glow",
    variant === "outline" && "border border-border bg-transparent hover:bg-card-hover text-foreground",
    variant === "ghost" && "hover:bg-card-hover text-foreground",
    variant === "secondary" && "bg-card border border-border text-foreground hover:bg-card-hover",
    size === "default" && "h-10 px-4 py-2",
    size === "sm" && "h-8 rounded-md px-3 text-xs",
    size === "lg" && "h-12 rounded-lg px-8",
    size === "icon" && "h-9 w-9",
    className
  );
  return <button ref={ref} className={cn} {...props} />;
});
Button.displayName = "Button";

export { Button };
