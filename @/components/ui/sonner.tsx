import {
  CircleCheckIcon,
  InfoIcon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
      }}
      toastOptions={{
        classNames: {
          toast: "text-[15px]! leading-snug! py-4! pl-4! pr-11! gap-3! items-start!",
          title: "font-semibold! whitespace-pre-line",
          icon: "mt-0.5",
          closeButton: "size-7! border-2! [&_svg]:size-4!",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "min(480px, calc(100vw - 32px))",
          "--toast-close-button-start": "unset",
          "--toast-close-button-end": "0",
          "--toast-close-button-transform": "translate(-25%, 25%)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
