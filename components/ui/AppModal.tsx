// App modal component: wraps BaseModal with consistent modal defaults for app flows.
import React, { ReactNode } from "react";
import { Dimensions } from "react-native";
import BaseModal from "../BaseModal";
import { colors } from "../../styles/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const BaseModalComponent = BaseModal as any;

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  height?: number;
  renderHeader?: () => ReactNode;
  avoidKeyboard?: boolean;
};

export default function AppModal({
  visible,
  onClose,
  children,
  height = SCREEN_HEIGHT * 0.9,
  renderHeader,
  avoidKeyboard = true,
}: Props) {
  return (
    <BaseModalComponent
      visible={visible}
      onClose={onClose}
      onBackdropPress={onClose}
      height={height}
      backgroundColor={colors.background.secondary}
      avoidKeyboard={avoidKeyboard}
      renderHeader={renderHeader}
    >
      {children}
    </BaseModalComponent>
  );
}
