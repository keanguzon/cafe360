import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  href?: string;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
  responsiveText?: boolean;
}

export function Logo({
  className,
  iconClassName,
  textClassName,
  href = "/",
  onClick,
  size = "md",
  responsiveText = false,
}: LogoProps) {
  const sizeMap = {
    sm: {
      iconContainer: "size-6",
      icon: "size-3.5",
      text: "text-sm",
    },
    md: {
      iconContainer: "size-7 sm:size-7.5",
      icon: "size-4 sm:size-4.5",
      text: "text-base sm:text-lg",
    },
    lg: {
      iconContainer: "size-8 sm:size-9",
      icon: "size-4.5 sm:size-5",
      text: "text-lg sm:text-xl",
    },
  };

  const selectedSize = sizeMap[size];

  const content = (
    <>
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-accent text-accent-foreground shadow-xs shrink-0 transition-transform group-hover:scale-105",
          selectedSize.iconContainer,
          iconClassName
        )}
      >
        <Coffee className={cn(selectedSize.icon, "shrink-0")} strokeWidth={2.25} />
      </div>
      <span
        className={cn(
          "font-display font-bold tracking-tight text-foreground transition-colors group-hover:text-accent select-none",
          selectedSize.text,
          responsiveText && "hidden sm:inline-block",
          textClassName
        )}
      >
        Cafe360
      </span>
    </>
  );

  if (!href) {
    return (
      <div
        onClick={onClick}
        className={cn("group flex items-center gap-2 cursor-pointer", className)}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group flex min-h-[44px] items-center gap-2 rounded-md px-1 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className
      )}
      aria-label="Cafe360 Home"
    >
      {content}
    </Link>
  );
}

