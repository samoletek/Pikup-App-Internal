// plugins/withMapboxNavigation.js
const {
  withDangerousMod,
  withPlugins,
  withXcodeProject,
  withProjectBuildGradle,
  withGradleProperties,
  withAppBuildGradle,
  IOSConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TOKEN_ENV_NAME = 'MAPBOX_DOWNLOAD_TOKEN'; // downloads token (private)
const MBX_MAPS_VERSION = '10.19.0';
const ANDROID_NAV_VERSION = '2.20.2';
const ANDROID_MAPS_VERSION = '10.19.0';

const iosPin = (v) => (v.startsWith('=') ? v : `= ${v}`);

function withMapboxNavigation(
  config,
  {
    mapboxDownloadToken,
    // use the constant so Android stays in sync
    androidNavVersion = ANDROID_NAV_VERSION,
    ios = true,
    android = false,
  } = {}
) {
  const plugins = [];
  if (ios) {
    // writes files + Podfile/Info.plist tweaks
    plugins.push([withMapboxNavigationIOS, { mapboxDownloadToken }]);
    // ensures PBX refs + BuildFiles + attaches to Sources (idempotent)
    plugins.push([withMapboxXcodeProjectForceSources]);
  }
  if (android) {
    plugins.push([withMapboxNavigationAndroid, { androidNavVersion }]);
  }
  return withPlugins(config, plugins);
}

function withMapboxNavigationIOS(config, { mapboxDownloadToken }) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosRoot = config.modRequest.platformProjectRoot;
      const appName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
      const appDir = path.join(iosRoot, appName);
      const bridgesDir = path.join(appDir, 'Bridges');

      console.log('[withMapboxNavigation] appName:', appName);
      console.log('[withMapboxNavigation] bridgesDir:', bridgesDir);
      if (!fs.existsSync(bridgesDir)) fs.mkdirSync(bridgesDir, { recursive: true });

      const swiftPath = path.join(bridgesDir, 'MapboxNavigationModule.swift');
      const mPath = path.join(bridgesDir, 'MapboxNavigationBridge.m');
      const hPath = path.join(bridgesDir, 'MapboxNavigationBridge.h');

      // Header
      fs.writeFileSync(
        hPath,
        `#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface MapboxNavigationBridge : RCTEventEmitter <RCTBridgeModule>
@end
`
      );
      console.log('[withMapboxNavigation] wrote:', hPath);

      // Obj-C extern
      fs.writeFileSync(
        mPath,
        `#import "MapboxNavigationBridge.h"
#import "${appName}-Swift.h"

@implementation MapboxNavigationBridge

RCT_EXPORT_MODULE(MapboxNavigation);

+ (BOOL)requiresMainQueueSetup { return YES; }
- (NSArray<NSString *> *)supportedEvents { return @[@"onRouteProgress", @"onArrival", @"onReroute", @"onCancel"]; }

RCT_EXPORT_METHOD(ping:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { resolve(@"pong"); }

@end
`
      );
      console.log('[withMapboxNavigation] wrote:', mPath);

      // Swift (note: import React for RCTEventEmitter)
      fs.writeFileSync(
        swiftPath,
        `import Foundation
import CoreLocation
import MapboxNavigation
import MapboxCoreNavigation
import MapboxDirections
import React

@objc(MapboxNavigationModule)
class MapboxNavigationModule: NSObject {
  @objc static let shared = MapboxNavigationModule()
  private var navigationViewController: NavigationViewController?
  private var eventEmitter: RCTEventEmitter?
}
`
      );
      console.log('[withMapboxNavigation] wrote:', swiftPath);

      // --- Podfile patch ---
      const podfilePath = path.join(iosRoot, 'Podfile');
      if (fs.existsSync(podfilePath)) {
        let podfile = fs.readFileSync(podfilePath, 'utf8');

        if (!podfile.includes('[MBX] MAPBOX_DOWNLOAD_TOKEN present?')) {
          podfile = podfile.replace(
            /(^platform[^\n]*\n)/m,
            `$1# BEGIN Mapbox token wiring (withMapboxNavigation)
puts "[MBX] ${TOKEN_ENV_NAME} present? #{!ENV['${TOKEN_ENV_NAME}'].to_s.empty?}"
begin
  token = ENV['${TOKEN_ENV_NAME}']
  netrc_path = File.expand_path('~/.netrc')
  if token && !token.empty?
    File.open(netrc_path, 'w') do |f|
      f.puts 'machine api.mapbox.com'
      f.puts '  login mapbox'
      f.puts "  password #{token}"
    end
    File.chmod(0600, netrc_path)
    Pod::UI.puts "[MBX] wrote ~/.netrc for Mapbox downloads at #{netrc_path}"
  else
    Pod::UI.warn "[MBX] no Mapbox token; skipping ~/.netrc"
  end
rescue => e
  Pod::UI.warn "[MBX] failed writing ~/.netrc: #{e}"
end
# END Mapbox token wiring
`
          );
        }

        // rnmapbox env + pin
        podfile = podfile.replace(
          /\$RNMapboxMapsDownloadToken\s*=\s*['"].*?['"]/,
          `$RNMapboxMapsDownloadToken = ENV['${TOKEN_ENV_NAME}']`
        );
        podfile = podfile.replace(
          /\$RNMapboxMapsVersion\s*=\s*['"].*?['"]/,
          `$RNMapboxMapsVersion = '${iosPin(MBX_MAPS_VERSION)}'`
        );

        // Ensure Navigation pod (idempotent)
        if (!podfile.includes("pod 'MapboxNavigation'")) {
          podfile = podfile.replace(
            /target\s+'([^']+)'\s+do/m,
            (m) => `${m}\n  pod 'MapboxNavigation', '~> 2.20'\n`
          );
        }

        // === BEGIN: deterministic PrivacyInfo + DEFINES_MODULE injector ===
        const appName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
        
        const privacyPrepMarker = 'withMapboxNavigation: prepare PrivacyInfo dir';
        const privacyPrepInner = `
    # --- BEGIN ${privacyPrepMarker} ---
    begin
      require 'fileutils'
      app_name = '${appName}'
      base = Pod::Config.instance.installation_root.to_s  # points to /.../ios
      nested = File.join(base, app_name, app_name)        # /ios/<App>/<App>
      FileUtils.mkdir_p(nested) unless File.directory?(nested)
    rescue => e
      Pod::UI.warn "[MBX] couldn't prepare PrivacyInfo dir: #{e}"
    end
    # --- END ${privacyPrepMarker} ---
`;
        
        const normalizerMarker = 'withMapboxNavigation: normalize DEFINES_MODULE';
        const normalizerInner = `
    # --- BEGIN ${normalizerMarker} ---
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |config|
        config.build_settings['DEFINES_MODULE'] = 'YES'
      end
    end
    # --- END ${normalizerMarker} ---
`;

        const postInstallHeaderRe = /(^|\n)[ \t]*post_install\s+do\s+\|installer\|\s*\n/;

        if (!podfile.includes(privacyPrepMarker) || !podfile.includes(normalizerMarker)) {
          let toInsert = '';
          if (!podfile.includes(privacyPrepMarker)) {
            toInsert += privacyPrepInner;
          }
          if (!podfile.includes(normalizerMarker)) {
            toInsert += normalizerInner;
          }

          if (postInstallHeaderRe.test(podfile)) {
            podfile = podfile.replace(postInstallHeaderRe, (m) => m + toInsert);
            console.log('[withMapboxNavigation] injected PrivacyInfo prep and DEFINES_MODULE normalizer inside post_install');
          } else {
            // very rare: no post_install block yet — create one at EOF
            podfile = podfile.trimEnd() + `

post_install do |installer|
${toInsert}
end
`;
            console.log('[withMapboxNavigation] added post_install with PrivacyInfo prep and DEFINES_MODULE normalizer');
          }
        }
        // === END: deterministic PrivacyInfo + DEFINES_MODULE injector ===

        fs.writeFileSync(podfilePath, podfile);
      }

      // Info.plist public token passthrough
      const infoPlistPath = path.join(appDir, 'Info.plist');
      if (fs.existsSync(infoPlistPath)) {
        let plist = fs.readFileSync(infoPlistPath, 'utf8');
        if (!plist.includes('MBXAccessToken')) {
          plist = plist.replace(
            /<\/dict>\s*<\/plist>\s*$/m,
            `  <key>MBXAccessToken</key>\n  <string>$(EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN)</string>\n</dict>\n</plist>`
          );
          fs.writeFileSync(infoPlistPath, plist);
        }
      }

      return config;
    },
  ]);
}

/**
 * Idempotent Xcode mod — always ensures file refs (filename-only), build files,
 * and attaches them to the target's PBXSourcesBuildPhase. Never throws.
 */
function withMapboxXcodeProjectForceSources(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);

    // Find the app target
    const nativeTargets = project.pbxNativeTargetSection();
    const appTargetUuid = Object.keys(nativeTargets).find((k) => {
      const t = nativeTargets[k];
      return (
        !k.endsWith('_comment') &&
        t.name === projectName &&
        t.productType === '"com.apple.product-type.application"'
      );
    });
    if (!appTargetUuid) {
      console.warn('[withMapboxNavigation] app target not found; skipping');
      return mod;
    }

    // Sources phase
    const sourcesPhase = project.pbxSourcesBuildPhaseObj(appTargetUuid);
    if (!sourcesPhase) {
      console.warn('[withMapboxNavigation] Sources build phase not found; skipping');
      return mod;
    }
    sourcesPhase.files ||= [];

    // Ensure <AppName>/Bridges group exists
    const mainGroupKey = project.getFirstProject().firstProject.mainGroup;
    const mainGroup = project.getPBXGroupByKey(mainGroupKey);
    let appGroupKey = (mainGroup.children || []).map((c) => c.value).find((key) => {
      const g = project.getPBXGroupByKey(key);
      return g && (g.name === projectName || g.path === projectName);
    });
    if (!appGroupKey) {
      const g = project.addPbxGroup([], projectName, projectName);
      (mainGroup.children ||= []).push({ value: g.uuid, comment: projectName });
      appGroupKey = g.uuid;
    }
    const appGroup = project.getPBXGroupByKey(appGroupKey);
    let bridgesGroupKey = (project.getPBXGroupByKey(appGroupKey).children || [])
      .map((c) => c.value)
      .find((key) => project.getPBXGroupByKey(key)?.name === 'Bridges');
    if (!bridgesGroupKey) {
      const g = project.addPbxGroup([], 'Bridges', 'Bridges');
      (project.getPBXGroupByKey(appGroupKey).children ||= []).push({ value: g.uuid, comment: 'Bridges' });
      bridgesGroupKey = g.uuid;
    }
    const bridgesGroup = project.getPBXGroupByKey(bridgesGroupKey);
    // ensure the Bridges group points to ios/<ProjectName>/Bridges
    bridgesGroup.path = 'Bridges';        // <--- ADD
    bridgesGroup.name = 'Bridges';        // <--- ADD
    bridgesGroup.sourceTree = '"<group>"';// <--- ADD

    // sections we need
    const fileRefs   = project.pbxFileReferenceSection();
    const buildFiles = project.pbxBuildFileSection();

    // Collect ALL PBXSourcesBuildPhase objects from all native targets
    const getAllSourcesPhases = () => {
      const phases = [];
      const nativeTargets = project.pbxNativeTargetSection();
      Object.values(nativeTargets).forEach((t) => {
        if (!t || !t.buildPhases) return;
        t.buildPhases.forEach((bp) => {
          // bp.value is the key of the phase
          const phaseObj = project.getPBXObject(bp.value);
          if (phaseObj && phaseObj.isa === 'PBXSourcesBuildPhase') {
            phases.push(phaseObj);
          }
        });
      });
      return phases;
    };

    const sourcesPhases = getAllSourcesPhases();
    console.log('[withMapboxNavigation] sources phases found:', sourcesPhases.length);

    // --- GLOBAL SCRUB: nuke any stale Compile Sources entries & file refs ---
    const STALE_COMMENTS = [
      'MapboxNavigationModule.swift in Sources',
      'MapboxNavigationBridge.m in Sources',
    ];

    function scrubBuildFileEverywhere(comment) {
      // collect all PBXBuildFile uuids with this comment
      const stale = Object.entries(buildFiles)
        .filter(([k]) => !k.endsWith('_comment'))
        .filter(([k]) => buildFiles[`${k}_comment`] === comment)
        .map(([k]) => k);

      if (!stale.length) return;

      // detach from ALL Sources phases in ALL targets
      sourcesPhases.forEach((phase) => {
        if (!phase || !phase.files) return;
        phase.files = phase.files.filter((f) => !stale.includes(f.value));
      });

      // delete the PBXBuildFile rows
      for (const uuid of stale) {
        delete buildFiles[uuid];
        delete buildFiles[`${uuid}_comment`];
        console.log('[withMapboxNavigation] scrubbed global PBXBuildFile', comment, uuid);
      }
    }

    function scrubFileRefsGlobal(filename) {
      for (const [k, v] of Object.entries(fileRefs)) {
        if (k.endsWith('_comment') || !v) continue;
        const name = v.name || '';
        const p    = v.path || '';
        const tree = v.sourceTree || '';

        const sameFile =
          name === filename ||
          p === filename ||
          p.endsWith(`/Bridges/${filename}`) ||
          p.endsWith(`Bridges\\${filename}`);

        // keep only filename-only under "<group>"
        const isStale = sameFile && (tree !== '"<group>"' || p !== filename);

        if (isStale) {
          delete fileRefs[k];
          delete fileRefs[`${k}_comment`];
          console.log('[withMapboxNavigation] scrubbed global PBXFileReference', filename, { p, tree, key: k });
        }
      }
    }

    // run the scrub BEFORE adding your good refs
    STALE_COMMENTS.forEach(scrubBuildFileEverywhere);
    scrubFileRefsGlobal('MapboxNavigationModule.swift');
    scrubFileRefsGlobal('MapboxNavigationBridge.m');

    // Filenames only (so Xcode doesn't duplicate path segments)
    const swiftName = 'MapboxNavigationModule.swift';
    const mName = 'MapboxNavigationBridge.m';
    const hName = 'MapboxNavigationBridge.h';

    // Ensure file refs exist (filename-only paths inside Bridges group)
    const ensureRef = (filename, lastKnownFileType) => {
      // 1) existing ref?
      let existingKey = null;
      for (const [key, val] of Object.entries(fileRefs)) {
        if (key.endsWith('_comment')) continue;
        if (!val) continue;
        const name = val.name || '';
        const p = val.path || '';
        if (name === filename || p === filename) {
          existingKey = key;
          break;
        }
      }

      if (existingKey) {
        // Force correct group-relative settings
        const fileRefEntry = fileRefs[existingKey];
        fileRefEntry.name = filename;
        fileRefEntry.path = filename;            // filename only
        fileRefEntry.sourceTree = '"<group>"';   // critical
        console.log('[withMapboxNavigation] fixed existing PBXFileReference for', filename, existingKey);
        return { key: existingKey, val: fileRefEntry };
      }

      // 2) try helper (filename relative to Bridges group)
      const added = project.addFile(filename, bridgesGroupKey, { lastKnownFileType });
      if (added && added.fileRef && fileRefs[added.fileRef]) {
        const fileRefEntry = fileRefs[added.fileRef];
        // Force correct group-relative settings
        fileRefEntry.name = filename;
        fileRefEntry.path = filename;            // filename only
        fileRefEntry.sourceTree = '"<group>"';   // critical
        console.log('[withMapboxNavigation] fixed addFile PBXFileReference for', filename, added.fileRef);
        return { key: added.fileRef, val: fileRefEntry };
      }

      // 3) manual PBXFileReference fallback
      const gen = () =>
        (typeof project.generateUuid === 'function'
          ? project.generateUuid()
          : Array.from({ length: 24 }, () =>
              '0123456789ABCDEF'[Math.floor(Math.random() * 16)]
            ).join(''));

      const uuid = gen();
      fileRefs[uuid] = {
        isa: 'PBXFileReference',
        lastKnownFileType,
        name: filename,
        path: filename,            // filename only; relative to Bridges group
        sourceTree: '"<group>"',
        fileEncoding: 4,
        includeInIndex: 0,
      };
      fileRefs[`${uuid}_comment`] = filename;

      const bridgesGroup = project.getPBXGroupByKey(bridgesGroupKey);
      bridgesGroup.children ||= [];
      if (!bridgesGroup.children.some(c => c.value === uuid)) {
        bridgesGroup.children.push({ value: uuid, comment: filename });
      }

      console.log('[withMapboxNavigation] manually added PBXFileReference for', filename, uuid);
      return { key: uuid, val: fileRefs[uuid] };
    };

    const swiftRef = ensureRef(swiftName, 'sourcecode.swift');
    const objcRef  = ensureRef(mName,     'sourcecode.c.objc');
    // header: reference only (not compiled)
    ensureRef(hName, 'sourcecode.c.h');

    // Ensure PBXBuildFile nodes + attach to Sources
    const gen = () =>
      (typeof project.generateUuid === 'function'
        ? project.generateUuid()
        : Array.from({ length: 24 }, () =>
            '0123456789ABCDEF'[Math.floor(Math.random() * 16)]
          ).join(''));

    const ensureBuildFile = (fileRefKey, comment) => {
      if (!fileRefKey) return null;
      
      const filename = comment.replace(' in Sources', '');
      
      // find any existing build-file row for that comment
      let uuid = Object.entries(buildFiles).find(([k, v]) => {
        if (k.endsWith('_comment')) return false;
        if (!v || !v.fileRef) return false;
        const ref = fileRefs[v.fileRef];
        return ref && ref.name === filename;
      })?.[0];

      if (!uuid) {
        // create new build file
        uuid = gen();
        buildFiles[uuid] = {
          isa: 'PBXBuildFile',
          fileRef: fileRefKey,
          fileRef_comment: filename,
        };
        buildFiles[`${uuid}_comment`] = comment;
        console.log('[withMapboxNavigation] added PBXBuildFile:', comment, uuid);
      } else {
        // make sure it points to the correct fileRef (ours)
        buildFiles[uuid].fileRef = fileRefKey;
        buildFiles[uuid].fileRef_comment = filename;
        console.log('[withMapboxNavigation] retargeted PBXBuildFile to our fileRef for', comment, uuid);
      }
      
      // Get the app target's Sources phase specifically for attaching
      const appSources = project.pbxSourcesBuildPhaseObj(appTargetUuid);
      if (appSources && !appSources.files.some((f) => f.value === uuid)) {
        appSources.files ||= [];
        appSources.files.push({ value: uuid, comment });
        console.log('[withMapboxNavigation] attached to app Sources:', comment);
      }
      return uuid;
    };

    ensureBuildFile(swiftRef?.key, `${swiftName} in Sources`);
    ensureBuildFile(objcRef?.key,  `${mName} in Sources`);

    // Swift build settings (safe to re-apply)
    const buildConfigurations = project.pbxXCBuildConfigurationSection();
    for (const key in buildConfigurations) {
      const cfg = buildConfigurations[key];
      if (!cfg || !cfg.buildSettings) continue;
      cfg.buildSettings.SWIFT_VERSION = '5.0';
      cfg.buildSettings.CLANG_ENABLE_MODULES = 'YES';
      cfg.buildSettings.SWIFT_OBJC_BRIDGING_HEADER =
        '"$(PROJECT_DIR)/$(PROJECT_NAME)/Bridges/MapboxNavigationBridge.h"';
      cfg.buildSettings.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = '"$(inherited)"';
    }

    return mod;
  });
}

function withMapboxNavigationAndroid(config, { androidNavVersion = ANDROID_NAV_VERSION } = {}) {
  // Gradle properties: set versions + token
  config = withGradleProperties(config, (props) => {
    const token = process.env[TOKEN_ENV_NAME] || '';
    const setProp = (key, value) => {
      const existing = props.modResults.find((p) => p.key === key);
      if (existing) existing.value = value;
      else props.modResults.push({ type: 'property', key, value });
    };
    setProp('RNMapboxMapsVersion', ANDROID_MAPS_VERSION);
    setProp(TOKEN_ENV_NAME, token);
    return props;
  });

  const repoBlock = `
        maven {
          url 'https://api.mapbox.com/downloads/v2/releases/maven'
          authentication { basic(BasicAuthentication) }
          credentials {
            username = 'mapbox'
            password = project.findProperty('${TOKEN_ENV_NAME}') ?: System.getenv('${TOKEN_ENV_NAME}') ?: ""
          }
        }`;

  // Root build.gradle
  config = withProjectBuildGradle(config, (mod) => {
    let c = mod.modResults.contents;
    if (!c.includes('ext.compileSdkVersion')) {
      c = c.replace(
        /(^|\n)buildscript\s*{/,
        `$1ext {\n    compileSdkVersion = 35\n    targetSdkVersion = 35\n    minSdkVersion = 24\n}\n\nbuildscript {`
      );
    }
    if (!c.includes('api.mapbox.com/downloads')) {
      c = c.replace(/allprojects\s*{\s*repositories\s*{/, (m) => `${m}\n${repoBlock}\n`);
      c = c.replace(/buildscript\s*{\s*repositories\s*{/, (m) => `${m}\n${repoBlock}\n`);
      mod.modResults.contents = c;
    }
    return mod;
  });

  // app/build.gradle
  config = withAppBuildGradle(config, (mod) => {
    let c = mod.modResults.contents;
    if (!c.includes('api.mapbox.com/downloads')) {
      const inject = `
    maven {
      url 'https://api.mapbox.com/downloads/v2/releases/maven'
      authentication { basic(BasicAuthentication) }
      credentials {
        username = 'mapbox'
        password = project.findProperty('${TOKEN_ENV_NAME}') ?: System.getenv('${TOKEN_ENV_NAME}') ?: ""
      }
    }`;
      if (c.match(/\n\s*repositories\s*{/)) {
        c = c.replace(/\n\s*repositories\s*{/, (match) => `${match}\n${inject}\n`);
      } else {
        c = `repositories {\n${inject}\n}\n` + c;
      }
    }
    if (!c.includes('com.mapbox.navigation:android')) {
      c = c.replace(/dependencies\s*{/, (m) => `${m}\n    implementation("com.mapbox.navigation:android:${androidNavVersion}")\n`);
    }
    mod.modResults.contents = c;
    return mod;
  });

  return config;
}

module.exports = withMapboxNavigation;
