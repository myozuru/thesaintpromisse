import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium tracking-wide ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary/90 text-primary-foreground border border-primary/40 shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.5)] hover:bg-primary hover:shadow-[0_0_22px_-2px_hsl(var(--primary)/0.7)] hover:-translate-y-px",
        destructive:
          "bg-destructive/90 text-destructive-foreground border border-destructive/40 shadow-[0_4px_14px_-4px_hsl(var(--destructive)/0.5)] hover:bg-destructive hover:shadow-[0_0_20px_-2px_hsl(var(--destructive)/0.6)]",
        outline:
          "border border-border/80 bg-card/60 hover:bg-secondary/60 hover:text-foreground hover:border-primary/50 hover:shadow-[0_0_14px_-4px_hsl(var(--primary)/0.4)]",
        secondary:
          "bg-secondary/80 text-secondary-foreground border border-border/50 hover:bg-secondary hover:border-border",
        ghost:
          "hover:bg-secondary/60 hover:text-foreground",
        link:
          "text-accent underline-offset-4 hover:underline hover:text-accent/80",
        /** CTA principal — gradiente místico violeta com glow forte. */
        mystic:
          "gradient-mystic text-primary-foreground border border-primary/40 shadow-[0_0_22px_-4px_hsl(var(--primary)/0.55)] hover:shadow-[0_0_32px_-2px_hsl(var(--primary)/0.85)] hover:-translate-y-px font-semibold",
        /** CTA dourado — para confirmações importantes (compras, finalizações). */
        gold:
          "gradient-gold text-accent-foreground border border-accent/50 shadow-[0_0_18px_-4px_hsl(var(--accent)/0.55)] hover:shadow-[0_0_28px_-2px_hsl(var(--accent)/0.8)] hover:-translate-y-px font-semibold",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        xs: "h-7 rounded-md px-2 text-xs",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
