"use client";

import type { WizardStep } from "@/types";

interface StepIndicatorProps {
  steps: { key: WizardStep; label: string }[];
  currentStep: WizardStep;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-2 mt-6">
      {steps.map((step, i) => {
        const isActive = i === currentIndex;
        const isCompleted = i < currentIndex;

        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--accent)] text-white"
                    : isCompleted
                      ? "bg-[var(--success)] text-white"
                      : "bg-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {isCompleted ? "✓" : i + 1}
              </div>
              <span
                className={`text-sm ${
                  isActive
                    ? "text-[var(--foreground)] font-medium"
                    : "text-[var(--muted)]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-px ${
                  isCompleted ? "bg-[var(--success)]" : "bg-[var(--border)]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
