import {CloseButton, Dialog, Portal} from "@chakra-ui/react";
import type {ReactNode} from "react";

interface DexDialogProps {
    title: ReactNode;
    onClose: () => void;
    children: ReactNode;
    /** Content width on desktop; phones use almost the whole screen. */
    width?: string;
}

/**
 * The DEX dialog frame (the fee details frame of ui-kit): card fill, hairline, 20 px radius,
 * a 19 px title and the close button. It is mounted only while open.
 */
export const DexDialog = ({title, onClose, children, width = '480px'}: DexDialogProps) => (
    <Dialog.Root open onOpenChange={(e) => !e.open && onClose()} placement="center" scrollBehavior="inside">
        <Portal>
            <Dialog.Backdrop/>
            <Dialog.Positioner>
                <Dialog.Content
                    maxW={{base: '92vw', md: width}}
                    bg="hg.card"
                    borderWidth="1px"
                    borderColor="hg.hairline"
                    borderRadius="20px"
                    boxShadow="hg.popover"
                >
                    <Dialog.Header pb="0">
                        <Dialog.Title fontSize="18px" fontWeight="700" pr="32px">{title}</Dialog.Title>
                        <Dialog.CloseTrigger asChild>
                            <CloseButton size="sm" aria-label="Close"/>
                        </Dialog.CloseTrigger>
                    </Dialog.Header>
                    <Dialog.Body pt="12px" pb="20px">{children}</Dialog.Body>
                </Dialog.Content>
            </Dialog.Positioner>
        </Portal>
    </Dialog.Root>
);
