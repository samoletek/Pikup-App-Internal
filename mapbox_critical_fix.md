# Mapbox SDK Patch Documentation

This document describes the patches applied to `@rnmapbox/maps` to make it compatible with Mapbox SDK 11.12.0.

## Version Matrix

| Package | Version | Notes |
|---------|---------|-------|
| `@rnmapbox/maps` | `10.2.10` | React Native Mapbox wrapper |
| Mapbox Maps iOS SDK | `11.12.0` | Set via `app.json` plugin config |
| Mapbox Maps Android SDK | `11.12.0` | Auto-matched from app.json |

## Why This Patch Exists

`@rnmapbox/maps` version 10.2.10 was built against a newer version of Mapbox SDK (11.13+) that includes properties not available in 11.12.0. When building against 11.12.0, compilation fails with "value of type 'X' has no member 'Y'" errors.

## Patched Files

### iOS: `RNMBXStyle.swift`
Path: `node_modules/@rnmapbox/maps/ios/RNMBX/RNMBXStyle.swift`

**9 properties commented out:**
1. Line ~1163: `layer.fillPatternCrossFade`
2. Line ~1398: `layer.lineElevationReference`
3. Line ~1409: `layer.lineCrossSlope`
4. Line ~1420: `layer.linePatternCrossFade`
5. Line ~2347: `layer.circleElevationReference`
6. Line ~2597: `layer.fillExtrusionPatternCrossFade`
7. Line ~2608: `layer.fillExtrusionHeightAlignment`
8. Line ~2619: `layer.fillExtrusionBaseAlignment`
9. Line ~3483: `layer.backgroundPitchAlignment`

### Android: `RNMBXStyleFactory.kt`
Path: `node_modules/@rnmapbox/maps/android/src/main/java/com/rnmapbox/rnmbx/components/styles/RNMBXStyleFactory.kt`

**4 functions emptied:**
1. `setFillPatternCrossFade` - line ~1223
2. `setLinePatternCrossFade` - line ~1671
3. `setCircleElevationReference` - line ~3285
4. `setFillExtrusionPatternCrossFade` - line ~3717

## How to Apply Patch

The patch is automatically applied via `postinstall` script in `package.json`:

```json
"scripts": {
  "postinstall": "patch-package"
}
```

After `npm install`, the patch from `patches/@rnmapbox+maps+10.2.10.patch` is applied.

## Manual Re-Application (If Patch Fails)

If the patch fails to apply (common after npm version updates):

### Step 1: Delete old patch
```bash
rm patches/@rnmapbox+maps+10.2.10.patch
```

### Step 2: Apply iOS patches manually
In `node_modules/@rnmapbox/maps/ios/RNMBX/RNMBXStyle.swift`, comment out these lines:

```swift
// Line ~1163 (inside setFillPatternCrossFade)
// layer.fillPatternCrossFade = styleValue.mglStyleValueNumber();

// Line ~1398 (inside setLineElevationReference)
// layer.lineElevationReference = styleValue.mglStyleValueEnum();

// Line ~1409 (inside setLineCrossSlope)
// layer.lineCrossSlope = styleValue.mglStyleValueNumber();

// Line ~1420 (inside setLinePatternCrossFade)
// layer.linePatternCrossFade = styleValue.mglStyleValueNumber();

// Line ~2347 (inside setCircleElevationReference)
// layer.circleElevationReference = styleValue.mglStyleValueEnum();

// Line ~2597 (inside setFillExtrusionPatternCrossFade)
// layer.fillExtrusionPatternCrossFade = styleValue.mglStyleValueNumber();

// Line ~2608 (inside setFillExtrusionHeightAlignment)
// layer.fillExtrusionHeightAlignment = styleValue.mglStyleValueEnum();

// Line ~2619 (inside setFillExtrusionBaseAlignment)
// layer.fillExtrusionBaseAlignment = styleValue.mglStyleValueEnum();

// Line ~3483 (inside setBackgroundPitchAlignment)
// layer.backgroundPitchAlignment = styleValue.mglStyleValueEnum();
```

### Step 3: Apply Android patches manually
In `node_modules/@rnmapbox/maps/android/src/main/java/com/rnmapbox/rnmbx/components/styles/RNMBXStyleFactory.kt`, replace function bodies with comments:

```kotlin
// ~Line 1223
fun setFillPatternCrossFade(layer: FillLayer, styleValue: RNMBXStyleValue ) {
  // patched: property not available in Mapbox SDK 11.12.0
}

// ~Line 1671
fun setLinePatternCrossFade(layer: LineLayer, styleValue: RNMBXStyleValue ) {
  // patched: property not available in Mapbox SDK 11.12.0
}

// ~Line 3285
fun setCircleElevationReference(layer: CircleLayer, styleValue: RNMBXStyleValue ) {
  // patched: property not available in Mapbox SDK 11.12.0
}

// ~Line 3717
fun setFillExtrusionPatternCrossFade(layer: FillExtrusionLayer, styleValue: RNMBXStyleValue ) {
  // patched: property not available in Mapbox SDK 11.12.0
}
```

### Step 4: Create new patch
```bash
npx patch-package @rnmapbox/maps --exclude 'build|\.project|\.classpath|\.settings'
```

## Updating to New Versions

If upgrading `@rnmapbox/maps`:
1. Check if new version supports Mapbox SDK 11.12.0 natively
2. If not, re-apply patches using manual steps above
3. Update line numbers in this document if they changed

## app.json Configuration

```json
{
  "plugins": [
    [
      "@rnmapbox/maps",
      {
        "RNMapboxMapsVersion": "11.12.0"
      }
    ]
  ]
}
```
