const {
  getManeuverIcon,
  normalizeManeuverType,
} = require("../../../screens/driver/navigationMath.utils");

describe("navigationMath.utils", () => {
  test("normalizes Mapbox maneuver types with spaces and underscores", () => {
    expect(normalizeManeuverType("off ramp")).toBe("off-ramp");
    expect(normalizeManeuverType("roundabout_turn")).toBe("roundabout-turn");
    expect(normalizeManeuverType(" New Name ")).toBe("new-name");
  });

  test("maps ramp and merge maneuvers to directional turn icons", () => {
    expect(getManeuverIcon("off ramp", "right")).toBe("arrow-forward");
    expect(getManeuverIcon("on_ramp", "left")).toBe("arrow-back");
    expect(getManeuverIcon("merge", "left")).toBe("arrow-back");
  });

  test("keeps roundabout and arrival maneuvers readable for the banner", () => {
    expect(getManeuverIcon("roundabout", "")).toBe("refresh");
    expect(getManeuverIcon("arrive", "")).toBe("flag");
  });
});
