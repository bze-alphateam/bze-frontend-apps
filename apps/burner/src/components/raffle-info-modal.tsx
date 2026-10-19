import { RaffleInfo } from "./raffle-info";
import { BurnerDialog } from "@/components/ui/burner/dialog";

interface RaffleInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RaffleInfoModal = ({ isOpen, onClose }: RaffleInfoModalProps) => (
    <BurnerDialog isOpen={isOpen} onClose={onClose} title="What are Burning Raffles?" width="600px">
        <RaffleInfo />
    </BurnerDialog>
);
