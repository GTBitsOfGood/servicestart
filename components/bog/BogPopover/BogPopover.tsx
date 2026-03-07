import React, {
  Dispatch,
  ReactElement,
  SetStateAction,
  CSSProperties,
  useState,
} from "react";
import { Popover } from "radix-ui";
import BogIcon from "../BogIcon/BogIcon";
import styles from "./styles.module.css";

interface OpenState {
  /** Whether the popover is open or not */
  open: boolean;
  /** State function to set the open state */
  setOpen: Dispatch<SetStateAction<boolean>>;
}

interface BogPopoverContentProps extends React.ComponentProps<
  typeof Popover.Content
> {
  /** CSS or Tailwind class names to style the content */
  className?: string;
  /** CSS styles to style the content */
  style?: CSSProperties;
}

interface BogPopoverArrowProps extends React.ComponentProps<
  typeof Popover.Arrow
> {
  /** CSS or Tailwind class names to style the arrow */
  className?: string;
  /** CSS styles to style the arrow */
  style?: CSSProperties;
}

interface BogPopoverCloseProps extends React.ComponentProps<
  typeof Popover.Close
> {
  /** Custom close button element */
  closeButton?: ReactElement;
  /** CSS or Tailwind class names to style the close button */
  className?: string;
  /** CSS styles to style the close button */
  style?: CSSProperties;
}

interface BogPopoverProps extends React.ComponentProps<typeof Popover.Root> {
  /** Trigger element for the popover */
  trigger: ReactElement;
  /** Content inside the popover */
  content: ReactElement;
  /** The title of the modal. */
  title?: ReactElement;
  /** The open state and function to set the open state */
  openState?: OpenState;
  /** The default value for the open state */
  defaultOpen?: boolean;
  /** Callback function when the open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Whether the popover should behave as a modal */
  modal?: boolean;
  /** Props for customizing the content of the popover */
  contentProps?: BogPopoverContentProps;
  /** Props for customizing the arrow of the popover */
  arrowProps?: BogPopoverArrowProps;
  /** Props for customizing the close button of the popover */
  closeProps?: BogPopoverCloseProps;
  /** CSS styles to style the popover */
  style?: CSSProperties;
  /** CSS or Tailwind class names to style the popover */
  className?: string;
}

export default function BogPopover({
  trigger,
  content,
  openState,
  defaultOpen = false,
  onOpenChange,
  modal = false,
  contentProps,
  arrowProps,
  closeProps,
  className,
  title = <h4>Heading</h4>,
  ...props
}: BogPopoverProps) {
  const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen);
  const open = openState ? openState.open : internalOpen;
  const setOpen = openState ? openState.setOpen : setInternalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (onOpenChange) onOpenChange(newOpen);
  };

  const closeButton = closeProps?.closeButton || (
    <BogIcon name="trash" size="24" />
  );

  const finalContentProps = contentProps || { side: "top" };

  return (
    <Popover.Root
      open={open}
      onOpenChange={handleOpenChange}
      modal={modal}
      {...props}
    >
      <Popover.Trigger className={styles.trigger} asChild>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={`${styles.content} ${className}`}
          {...finalContentProps}
        >
          <div className={styles.header}>
            {title}
            <Popover.Close className={styles.close} {...closeProps}>
              {closeButton}
            </Popover.Close>
          </div>
          {content}
          <Popover.Arrow className={styles.arrow} {...arrowProps} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
