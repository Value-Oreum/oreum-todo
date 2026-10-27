"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
let dialogCount = 0;
let originalOverflow = "";
export function Dialog({
  label,
  className,
  onClose,
  children,
  dismissOnBackdrop = true,
}: {
  label: string;
  className: string;
  onClose: () => void;
  children: ReactNode;
  dismissOnBackdrop?: boolean;
}) {
  const section = useRef<HTMLElement>(null),
    overlay = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = section.current;
    if (!el) return;
    if (dialogCount++ === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    if (!el.contains(document.activeElement))
      el.querySelector<HTMLButtonElement>(".dialog-close")?.focus({
        preventScroll: true,
      });
    const viewport = window.visualViewport;
    let frame = 0;
    const resize = () => {
      if (!overlay.current) return;
      overlay.current.style.height = `${viewport?.height || window.innerHeight}px`;
      overlay.current.style.top = `${viewport?.offsetTop || 0}px`;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = document.activeElement;
        if (
          active instanceof HTMLElement &&
          el.contains(active) &&
          active.matches("input,textarea,select")
        )
          active.scrollIntoView({ block: "nearest", behavior: "auto" });
      });
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    const keys = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if ([...document.querySelectorAll('[role="dialog"]')].at(-1) !== el)
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const fields = [
        ...el.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ),
      ].filter((node) => node.getClientRects().length > 0);
      const first = fields[0],
        last = fields.at(-1);
      if (!first) {
        event.preventDefault();
        el.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("keydown", keys);
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
      if (--dialogCount === 0) document.body.style.overflow = originalOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
      else
        document
          .querySelector<HTMLButtonElement>(".heading-actions .primary")
          ?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      className="overlay"
      ref={overlay}
      onClick={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget)
          close.current();
      }}
    >
      <section
        ref={section}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <div className="dialog-controls">
          <span>{label}</span>
          <button
            type="button"
            className="dialog-close"
            aria-label="닫기"
            onClick={() => close.current()}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
