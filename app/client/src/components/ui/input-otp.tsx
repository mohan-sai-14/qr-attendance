import * as React from "react"
import { Dot } from "lucide-react"
import { cn } from "@/lib/utils"

interface InputOTPProps extends React.InputHTMLAttributes<HTMLInputElement> {
  numInputs?: number
  separator?: React.ReactNode
  value?: string
  onChange?: (value: string) => void
}

const InputOTP = React.forwardRef<HTMLInputElement, InputOTPProps>(
  ({ className, numInputs = 6, separator = <Dot />, value = "", onChange, ...props }, ref) => {
    const [otp, setOtp] = React.useState(value)
    const inputRefs = React.useRef<HTMLInputElement[]>([])

    React.useEffect(() => {
      setOtp(value)
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      const newValue = e.target.value
      if (newValue.length > 1) return

      const newOtp = otp.split("")
      newOtp[index] = newValue
      const finalOtp = newOtp.join("")
      setOtp(finalOtp)
      onChange?.(finalOtp)

      if (newValue && index < numInputs - 1) {
        inputRefs.current[index + 1]?.focus()
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
      if (e.key === "Backspace" && !otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    }

    return (
      <div className={cn("flex items-center gap-2", className)}>
        {Array.from({ length: numInputs }).map((_, index) => (
          <React.Fragment key={index}>
            <input
              ref={(el) => (inputRefs.current[index] = el!)}
              type="text"
              maxLength={1}
              value={otp[index] || ""}
              onChange={(e) => handleChange(e, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-center text-sm ring-offset-background transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                className
              )}
              {...props}
            />
            {index < numInputs - 1 && separator}
          </React.Fragment>
        ))}
      </div>
    )
  }
)
InputOTP.displayName = "InputOTP"

export { InputOTP }
