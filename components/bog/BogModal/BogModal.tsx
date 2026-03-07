import React, { ReactElement, Dispatch, SetStateAction, useState } from "react";
import styles from "./styles.module.css";
import { Dialog } from "radix-ui";
import BogButton from "../BogButton/BogButton";
import BogIcon from "../BogIcon/BogIcon";
import { useResponsive } from "../../../utils/design-system/hooks/useResponsive";
import { getSizeFromBreakpoint } from "../../../utils/design-system/breakpoints/breakpoints";

interface BogModalContentProps extends React.ComponentProps<
  typeof Dialog.Content
> {
  className?: string;
  style?: React.CSSProperties;
}

interface OpenState {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

interface BogModalProps extends React.ComponentProps<typeof Dialog.Root> {
  size?: "small" | "medium" | "large" | "responsive";
  openState?: OpenState;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
  closeButton?: ReactElement;
  trigger?: ReactElement;
  contentProps?: BogModalContentProps;
  title?: ReactElement;
  description?: ReactElement;
  /** Label for the primary button. Defaults to "Primary". */
  primaryLabel?: string;
  /** Label for the secondary button. Defaults to "Secondary". */
  secondaryLabel?: string;
  /** Called when the primary button is clicked. Defaults to closing the modal. */
  onPrimary?: () => void;
  /** Called when the secondary button is clicked. Defaults to closing the modal. */
  onSecondary?: () => void;
  /** Whether the primary button is disabled. */
  primaryDisabled?: boolean;
  /** Additional class names for the buttons container div. */
  buttonsContainerClassName?: string;
  /** Additional styles for the buttons container div. */
  buttonsContainerStyle?: React.CSSProperties;
  /** Additional class names applied to the primary button. */
  primaryButtonClassName?: string;
  /** Additional styles applied to the primary button. */
  primaryButtonStyle?: React.CSSProperties;
  /** Additional class names applied to the secondary button. */
  secondaryButtonClassName?: string;
  /** Additional styles applied to the secondary button. */
  secondaryButtonStyle?: React.CSSProperties;
}

const defaultCloseButton = <BogIcon name="x" size="auto" />;
const defaultTrigger = <BogButton>Click me!</BogButton>;

export default function BogModal({
  size = "responsive",
  openState,
  defaultOpen = false,
  onOpenChange,
  modal = true,
  closeButton = defaultCloseButton,
  trigger = defaultTrigger,
  contentProps,
  title = <h3>Modal Heading</h3>,
  description = (
    <span>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
      tempor incididunt ut labore et dolore magna aliqua.
    </span>
  ),
  primaryLabel = "Primary",
  secondaryLabel = "Secondary",
  onPrimary,
  onSecondary,
  primaryDisabled = false,
  buttonsContainerClassName,
  buttonsContainerStyle,
  primaryButtonClassName,
  primaryButtonStyle,
  secondaryButtonClassName,
  secondaryButtonStyle,
  ...props
}: BogModalProps) {
  const breakpoint = useResponsive();
  const responsiveSize =
    size === "responsive" ? getSizeFromBreakpoint(breakpoint) : size;

  const headerSizeClass =
    responsiveSize === "small"
      ? "text-heading-4"
      : responsiveSize === "medium"
        ? "text-heading-3"
        : "text-heading-2";

  const descriptionClass = `${styles.description} ${
    responsiveSize === "small" ? "text-paragraph-2" : "text-paragraph-1"
  }`;

  const buttonSize: "small" | "medium" | "large" | "responsive" =
    responsiveSize === "large" ? "large" : "medium";

  const [internalOpen, internalSetOpen] = useState(defaultOpen);
  const open = openState ? openState.open : internalOpen;
  const setOpen = openState ? openState.setOpen : internalSetOpen;

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (onOpenChange) onOpenChange(newOpen);
  };

  const handlePrimary = () => {
    if (onPrimary) onPrimary();
    else handleOpenChange(false);
  };

  const handleSecondary = () => {
    if (onSecondary) onSecondary();
    else handleOpenChange(false);
  };

  const { className: contentClassName, ...restContentProps } =
    contentProps ?? {};

  return (
    <Dialog.Root
      open={open}
      onOpenChange={handleOpenChange}
      modal={modal}
      {...props}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          {...restContentProps}
          className={`${styles.content} ${styles[responsiveSize]} ${contentClassName ?? ""}`}
          onPointerDownOutside={(e) => {
            if (!modal) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (!modal) e.preventDefault();
          }}
        >
          <div className={styles.titleContainer}>
            <Dialog.Close
              className={`${headerSizeClass} ${styles.closeButton}`}
            >
              {closeButton}
            </Dialog.Close>
            <Dialog.Title
              className={`${headerSizeClass} ${styles.title}`}
              asChild
            >
              {title}
            </Dialog.Title>
          </div>
          <Dialog.Description className={descriptionClass} asChild>
            {description}
          </Dialog.Description>
          <div
            className={`${styles.buttonsContainer} justify-end ${buttonsContainerClassName ?? ""}`}
            style={buttonsContainerStyle}
          >
            <BogButton
              variant="secondary"
              size={buttonSize}
              onClick={handleSecondary}
              className={secondaryButtonClassName}
              style={secondaryButtonStyle}
            >
              {secondaryLabel}
            </BogButton>
            <BogButton
              variant="primary"
              size={buttonSize}
              onClick={handlePrimary}
              disabled={primaryDisabled}
              className={primaryButtonClassName}
              style={primaryButtonStyle}
            >
              {primaryLabel}
            </BogButton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
