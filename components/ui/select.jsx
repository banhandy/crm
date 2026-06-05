import * as React from "react";
import { twMerge } from "tailwind-merge";

const Select = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <div className="relative w-full">
      <select
        className={twMerge(
          "flex h-10 w-full rounded-lg border border-border bg-input pl-3 pr-8 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 cursor-pointer appearance-none",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted text-xs">▼</span>
    </div>
  );
});
Select.displayName = "Select";

// Modular shadcn compatibility elements:
const SelectGroup = ({ children }) => <>{children}</>;
const SelectValue = ({ placeholder, value }) => <span>{value || placeholder}</span>;
const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <button
    ref={ref}
    className={twMerge(
      "flex h-10 w-full items-center justify-between rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <span className="ml-2 opacity-50">▼</span>
  </button>
));
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = ({ children, className, ...props }) => (
  <div className={twMerge("absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-card text-foreground shadow-md", className)} {...props}>
    <div className="p-1">{children}</div>
  </div>
);

const SelectItem = React.forwardRef(({ className, children, value, ...props }, ref) => (
  <div
    ref={ref}
    className={twMerge(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-card-hover focus:bg-card-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </div>
));
SelectItem.displayName = "SelectItem";

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem };
