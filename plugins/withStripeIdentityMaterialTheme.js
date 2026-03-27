const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MATERIAL_THEME = "Theme.MaterialComponents.DayNight.NoActionBar.Bridge";

function withStripeIdentityMaterialTheme(config) {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const stylesPath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app/src/main/res/values/styles.xml"
      );

      if (!fs.existsSync(stylesPath)) {
        console.warn("[withStripeIdentityMaterialTheme] styles.xml not found, skipping");
        return modConfig;
      }

      const styles = fs.readFileSync(stylesPath, "utf8");
      const appThemeRegex = /<style\s+name="AppTheme"\s+parent="([^"]+)">/;
      const match = styles.match(appThemeRegex);

      if (!match) {
        console.warn("[withStripeIdentityMaterialTheme] AppTheme not found, skipping");
        return modConfig;
      }

      const currentParent = match[1];
      if (currentParent === MATERIAL_THEME) {
        return modConfig;
      }

      const updatedStyles = styles.replace(
        appThemeRegex,
        `<style name="AppTheme" parent="${MATERIAL_THEME}">`
      );

      fs.writeFileSync(stylesPath, updatedStyles);
      console.log(
        `[withStripeIdentityMaterialTheme] AppTheme parent updated: ${currentParent} -> ${MATERIAL_THEME}`
      );

      return modConfig;
    },
  ]);
}

module.exports = withStripeIdentityMaterialTheme;
