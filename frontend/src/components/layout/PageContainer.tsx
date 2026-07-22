import type { ReactNode } from "react"

type PageContainerProps = {
  children: ReactNode
  className?: string
}

export function PageContainer({
  children,
  className = "",
}: PageContainerProps) {
  return (
    <div
      className={[
        "mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  )
}