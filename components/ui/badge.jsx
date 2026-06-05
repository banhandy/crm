import * as React from "react";
import { twMerge } from "tailwind-merge";

function Badge({ className, variant = "default", ...props }) {
  return (
    <div
      className={twMerge(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variant === "default" && "border-transparent bg-primary text-primary-foreground",
        variant === "secondary" && "border-transparent bg-muted text-muted-foreground",
        variant === "destructive" && "border-transparent bg-destructive text-destructive-foreground",
        variant === "outline" && "border-border text-foreground bg-transparent",
        variant === "won" && "border-won bg-won/10 text-won",
        variant === "pending" && "border-pending bg-pending/10 text-pending",
        variant === "follow" && "border-follow bg-follow/10 text-follow",
        variant === "stale" && "border-stale bg-stale/10 text-stale",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
