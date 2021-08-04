import React from "react";
import { StabilityDepositManager } from "./StabilityDepositManager";
import { ActiveDeposit } from "./ActiveDeposit";
import { NoDeposit } from "./NoDeposit";
import { useStabilityView } from "./context/StabilityViewContext";

export type StabilityProps = {
  justSP?: boolean,
};

export const justSpStyle = {
  position: "fixed",
  margin: [0, 0, 0],
  display: "block",
  top: "0",
  left: "0",
  width: "100%",
  height: "100%",
  zIndex: "1"
}

export const Stability: React.FC<StabilityProps> = props => {
  const { view } = useStabilityView();

  switch (view) {
    case "NONE": {
      return <NoDeposit {...props} />;
    }
    case "DEPOSITING": {
      return <StabilityDepositManager {...props} />;
    }
    case "ADJUSTING": {
      return <StabilityDepositManager {...props} />;
    }
    case "ACTIVE": {
      return <ActiveDeposit {...props} />;
    }
  }
};
