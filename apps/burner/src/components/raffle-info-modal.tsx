import { Dialog, Portal } from "@chakra-ui/react";
import { RaffleInfo } from "./raffle-info";

interface RaffleInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RaffleInfoModal = ({ isOpen, onClose }: RaffleInfoModalProps) => {
    return (
        <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content
                        maxW={{ base: "90vw", md: "600px" }}
                        borderRadius="2xl"
                    >
                        <Dialog.Header>
                            <Dialog.Title fontSize="xl" fontWeight="black">
                                🔥 What are Burning Raffles?
                            </Dialog.Title>
                            <Dialog.CloseTrigger />
                        </Dialog.Header>

                        <Dialog.Body>
                            <RaffleInfo />
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};
