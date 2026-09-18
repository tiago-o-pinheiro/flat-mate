"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  returnFocus?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content
          className="dialog-content"
          onCloseAutoFocus={(event) => {
            if (returnFocus?.current) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
        >
          <div className="dialog-header">
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="icon-button" aria-label="Cerrar">
              <X size={20} />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description
            className={description ? "dialog-description" : "sr-only"}
          >
            {description || title}
          </DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
