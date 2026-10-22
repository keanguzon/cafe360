import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-xs font-medium transition-all duration-150 active:scale-95 active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90",
        destructive: "bg-red-500 text-white shadow-sm hover:bg-red-600",
        outline: "border border-border bg-background shadow-xs hover:bg-surface hover:text-foreground",
        secondary: "bg-surface text-foreground shadow-xs hover:bg-surface/80",
        ghost: "hover:bg-surface hover:text-foreground active:bg-surface/60",
        link: "text-accent underline-offset-4 hover:underline active:scale-100",
        pill: "bg-accent text-accent-foreground rounded-full shadow-sm hover:bg-accent/90 font-semibold",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-lg px-3.5",
        lg: "h-12 rounded-xl px-8 text-sm",
        pill: "h-9 rounded-full px-5 text-xs",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);


export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

