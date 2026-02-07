import React from "react";
import RoleTabNavigator from "./RoleTabNavigator";
import { driverTabs } from "./tabRoutes";

export default function DriverTabNavigator() {
  return <RoleTabNavigator tabs={driverTabs} />;
}
