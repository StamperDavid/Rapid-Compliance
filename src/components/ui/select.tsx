import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const SelectContext = React.createContext<SelectContextValue | undefined>(undefined)

function useSelect() {
  const context = React.useContext(SelectContext)
  if (!context) {
    throw new Error("Select components must be used within a Select component")
  }
  return context
}

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

const Select = ({ value: controlledValue, defaultValue, onValueChange, children }: SelectProps) => {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || "")
  const [open, setOpen] = React.useState(false)
  const value = controlledValue ?? uncontrolledValue
  const handleValueChange = onValueChange ?? setUncontrolledValue

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = useSelect()

  return (
    <button
      ref={ref}
      type="button"
      role="combobox"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }
>(({ className, placeholder, ...props }, ref) => {
  const { value } = useSelect()

  return (
    <span ref={ref} className={cn(className)} {...props}>
      {value || placeholder}
    </span>
  )
})
SelectValue.displayName = "SelectValue"

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = useSelect()
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open, setOpen])

  if (!open) return null

  return (
    <div
      ref={contentRef}
      className={cn(
        "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
SelectContent.displayName = "SelectContent"

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, value: itemValue, children, ...props }, ref) => {
    const { value, onValueChange, setOpen } = useSelect()
    const isSelected = value === itemValue

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isSelected}
        onClick={() => {
          onValueChange(itemValue)
          setOpen(false)
        }}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
          isSelected && "bg-accent",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
SelectItem.displayName = "SelectItem"

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
