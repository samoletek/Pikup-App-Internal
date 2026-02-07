import React from "react";
import RoleTabNavigator from "./RoleTabNavigator";
import { customerTabs } from "./tabRoutes";

export default function CustomerTabNavigator() {
  return <RoleTabNavigator tabs={customerTabs} />;
}
