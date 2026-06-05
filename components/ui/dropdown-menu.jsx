import * as React from "react";
import { twMerge } from "tailwind-merge";

const DropdownMenu = ({ children }) => <div className="relative inline-block text-left">{children}</div>;

const DropdownMenuTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={twMerge("inline-flex w-full justify-center", className)} {...props}>
    {children}
  </div>
));
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={twMerge(
      "absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-xl border border-border bg-card p-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none",
      className
    )}
    {...props}
  >
    {children}
  </div>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <button
    ref={ref}
    className={twMerge(
      "flex w-full items-center rounded-lg px-3 py-2 text-sm text-foreground hover:bg-card-hover focus:bg-card-hover disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
      className
    )}
    {...props}
  >
    {children}
  </button>
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
