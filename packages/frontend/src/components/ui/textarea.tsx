import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Два вида поля. bordered — обычная рамка, если поле стоит само по себе.
 * bare — текст без рамки внутри «листа»: рамку там уже держит сам лист,
 * а вторая вокруг текста делает из документа форму.
 */
const textareaVariants = cva(
  "flex w-full text-[17px] leading-[30px] placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        bordered:
          "min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        bare:
          "min-h-[80px] border-0 bg-transparent p-0 focus-visible:outline-none",
      },
    },
    defaultVariants: {
      variant: "bordered",
    },
  }
)

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea, textareaVariants }
