// plugins/withMapboxNavigation.js
const {
  withDangerousMod,
  withInfoPlist,
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
// NOTE: These versions are intentionally pinned as a compatibility set for the current RN/Mapbox stack.
// Do not bump them independently. Re-validate both iOS and Android navigation flows before changing.
const MBX_MAPS_VERSION = '10.19.0';
const IOS_NAV_POD_VERSION = '~> 2.20.3';
const ANDROID_NAV_VERSION = '3.9.0';
const ANDROID_MAPS_VERSION = '11.12.0';

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
    // Mapbox Navigation RouteVoiceController asserts in Debug if background audio mode is missing.
    plugins.push(withMapboxNavigationIOSBackgroundModes);
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

function withMapboxNavigationIOSBackgroundModes(config) {
  return withInfoPlist(config, (mod) => {
    const existingModes = Array.isArray(mod.modResults.UIBackgroundModes)
      ? mod.modResults.UIBackgroundModes.filter((mode) => typeof mode === 'string')
      : [];

    mod.modResults.UIBackgroundModes = [...new Set([...existingModes, 'audio'])];
    return mod;
  });
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
- (NSArray<NSString *> *)supportedEvents { return @[@"onRouteProgress", @"onArrival", @"onReroute", @"onCancel", @"onPrimaryAction", @"onSecondaryAction"]; }

RCT_EXPORT_METHOD(startNavigation:(NSDictionary *)origin
                  destination:(NSDictionary *)destination
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [MapboxNavigationModule.shared setEventEmitter:self];
  [MapboxNavigationModule.shared startNavigationWithOrigin:origin destination:destination options:@{} resolver:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(startNavigationWithOptions:(NSDictionary *)origin
                  destination:(NSDictionary *)destination
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [MapboxNavigationModule.shared setEventEmitter:self];
  [MapboxNavigationModule.shared startNavigationWithOrigin:origin destination:destination options:options resolver:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(stopNavigation:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [MapboxNavigationModule.shared setEventEmitter:self];
  [MapboxNavigationModule.shared stopNavigationWithResolver:resolve rejecter:reject];
}

@end
`
      );
      console.log('[withMapboxNavigation] wrote:', mPath);

      // Swift (note: import React for RCTEventEmitter)
      fs.writeFileSync(
        swiftPath,
        `import Foundation
import CoreLocation
import MapboxCoreNavigation
import MapboxNavigation
import MapboxDirections
import MapboxMaps
import UIKit
import React

private enum PikupNavigationPalette {
  static let accent = UIColor(red: 167/255, green: 123/255, blue: 1.0, alpha: 1.0)
  static let accentMuted = UIColor(red: 125/255, green: 96/255, blue: 230/255, alpha: 1.0)
  static let header = UIColor(red: 112/255, green: 86/255, blue: 244/255, alpha: 1.0)
  static let surface = UIColor(red: 10/255, green: 10/255, blue: 31/255, alpha: 1.0)
  static let textPrimary = UIColor.white
  static let textSecondary = UIColor(white: 1.0, alpha: 0.78)
}

final class PikupNavigationStyle: NightStyle {
  required init() {
    super.init()
    mapStyleURL = URL(string: StyleURI.navigationNight.rawValue)!
    previewMapStyleURL = mapStyleURL
    styleType = .night
    statusBarStyle = .lightContent
  }

  override func apply() {
    super.apply()

    let traitCollections = [
      UITraitCollection(userInterfaceIdiom: .phone),
      UITraitCollection(userInterfaceIdiom: .pad),
    ]

    for traitCollection in traitCollections {
      NavigationView.appearance(for: traitCollection).backgroundColor = PikupNavigationPalette.surface
      TopBannerView.appearance(for: traitCollection).backgroundColor = PikupNavigationPalette.header
      BottomBannerView.appearance(for: traitCollection).backgroundColor = PikupNavigationPalette.surface
      BottomPaddingView.appearance(for: traitCollection).backgroundColor = PikupNavigationPalette.surface
      InstructionsBannerView.appearance(for: traitCollection).backgroundColor = PikupNavigationPalette.header
      FloatingButton.appearance(for: traitCollection).backgroundColor = PikupNavigationPalette.header.withAlphaComponent(0.94)
      FloatingButton.appearance(for: traitCollection).tintColor = PikupNavigationPalette.textPrimary
      FloatingButton.appearance(for: traitCollection).borderColor = PikupNavigationPalette.accent.withAlphaComponent(0.65)

      NavigationMapView.appearance(for: traitCollection).trafficUnknownColor = PikupNavigationPalette.accent
      NavigationMapView.appearance(for: traitCollection).routeCasingColor = PikupNavigationPalette.accentMuted
      NavigationMapView.appearance(for: traitCollection).traversedRouteColor = UIColor(red: 78/255, green: 57/255, blue: 130/255, alpha: 1.0)
      NavigationMapView.appearance(for: traitCollection).routeAlternateColor = UIColor(red: 97/255, green: 89/255, blue: 145/255, alpha: 1.0)
      NavigationMapView.appearance(for: traitCollection).routeAlternateCasingColor = UIColor(red: 57/255, green: 53/255, blue: 93/255, alpha: 1.0)
      NavigationMapView.appearance(for: traitCollection).maneuverArrowColor = PikupNavigationPalette.accent
      NavigationMapView.appearance(for: traitCollection).maneuverArrowStrokeColor = PikupNavigationPalette.accentMuted
      NavigationMapView.appearance(for: traitCollection).trafficLowColor = PikupNavigationPalette.accent
      NavigationMapView.appearance(for: traitCollection).trafficModerateColor = UIColor(red: 185/255, green: 140/255, blue: 1.0, alpha: 1.0)
      NavigationMapView.appearance(for: traitCollection).trafficHeavyColor = UIColor(red: 1.0, green: 176/255, blue: 0.0, alpha: 1.0)
      NavigationMapView.appearance(for: traitCollection).trafficSevereColor = UIColor(red: 1.0, green: 95/255, blue: 95/255, alpha: 1.0)
      NavigationMapView.appearance(for: traitCollection).alternativeTrafficUnknownColor = UIColor(red: 85/255, green: 88/255, blue: 122/255, alpha: 1.0)
      NavigationMapView.appearance(for: traitCollection).alternativeTrafficLowColor = UIColor(red: 118/255, green: 96/255, blue: 186/255, alpha: 1.0)
      NavigationMapView.appearance(for: traitCollection).alternativeTrafficModerateColor = UIColor(red: 170/255, green: 130/255, blue: 220/255, alpha: 1.0)
      NavigationMapView.appearance(for: traitCollection).buildingDefaultColor = UIColor(red: 49/255, green: 53/255, blue: 75/255, alpha: 1.0)

      PrimaryLabel.appearance(for: traitCollection, whenContainedInInstancesOf: [InstructionsBannerView.self]).normalTextColor = PikupNavigationPalette.textPrimary
      SecondaryLabel.appearance(for: traitCollection, whenContainedInInstancesOf: [InstructionsBannerView.self]).normalTextColor = PikupNavigationPalette.textSecondary
      DistanceLabel.appearance(for: traitCollection, whenContainedInInstancesOf: [InstructionsBannerView.self]).valueTextColor = PikupNavigationPalette.textPrimary
      DistanceLabel.appearance(for: traitCollection, whenContainedInInstancesOf: [InstructionsBannerView.self]).unitTextColor = PikupNavigationPalette.textSecondary
      TimeRemainingLabel.appearance(for: traitCollection).normalTextColor = PikupNavigationPalette.textPrimary
      TimeRemainingLabel.appearance(for: traitCollection).trafficUnknownColor = PikupNavigationPalette.textPrimary
    }
  }
}

final class PikupBottomBannerViewController: BottomBannerViewController {
  override func viewDidLoad() {
    super.viewDidLoad()

    cancelButton.isHidden = true
    cancelButton.isEnabled = false
    cancelButton.isUserInteractionEnabled = false
    cancelButton.alpha = 0
    cancelButton.setImage(nil, for: .normal)
    verticalDividerView.isHidden = true

    for constraint in bottomBannerView.constraints where
      (constraint.firstItem as? UIView) == cancelButton && constraint.firstAttribute == .width {
      constraint.constant = 0
    }
  }
}

@objc(MapboxNavigationModule)
class MapboxNavigationModule: NSObject, NavigationViewControllerDelegate {
  @objc static let shared = MapboxNavigationModule()
  private let queue = DispatchQueue.main
  private let custom3DBuildingsLayerId = "pikup_3d_buildings"
  private var navigationViewController: NavigationViewController?
  private var actionCardView: UIView?
  private var styleLoadedCancelable: Cancelable?
  private weak var primaryActionButton: UIButton?
  private var actionPayload: [String: Any] = [:]
  private var primaryActionUnlockDistanceMeters: CLLocationDistance?
  private var destinationCoordinate: CLLocationCoordinate2D?
  private var allowSystemCancelForCurrentSession = false
  private weak var eventEmitter: RCTEventEmitter?

  @objc func setEventEmitter(_ emitter: RCTEventEmitter) {
    eventEmitter = emitter
  }

  @objc(startNavigationWithOrigin:destination:options:resolver:rejecter:)
  func startNavigation(
    origin: NSDictionary,
    destination: NSDictionary,
    options: NSDictionary?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    queue.async {
      guard self.navigationViewController == nil else {
        resolve(["started": false, "alreadyActive": true])
        return
      }

      guard
        let originCoordinate = self.coordinate(from: origin),
        let destinationCoordinate = self.coordinate(from: destination)
      else {
        reject("invalid_coordinates", "Origin and destination coordinates are invalid.", nil)
        return
      }

      let shouldSimulate = ((options?["simulate"] as? NSNumber)?.boolValue) ?? false
      let allowSystemCancel = ((options?["allowSystemCancel"] as? NSNumber)?.boolValue) ?? false
      let actionCardOptions = options?["actionCard"] as? NSDictionary
      let simulationMode: SimulationMode = shouldSimulate ? .always : .inTunnels
      self.destinationCoordinate = destinationCoordinate
      self.allowSystemCancelForCurrentSession = allowSystemCancel

      let routeOptions = NavigationRouteOptions(
        coordinates: [originCoordinate, destinationCoordinate],
        profileIdentifier: .automobileAvoidingTraffic
      )
      Directions.shared.calculate(routeOptions) { (_, result) in
        switch result {
        case .failure(let error):
          reject("route_calculation_failed", error.localizedDescription, error as NSError)
        case .success(let response):
          let indexedRouteResponse = IndexedRouteResponse(routeResponse: response, routeIndex: 0)

          guard let presenter = self.topViewController() else {
            reject("presenter_not_found", "Unable to find a presenter view controller.", nil)
            return
          }

          let navigationService = MapboxNavigationService(
            routeResponse: response,
            routeIndex: 0,
            routeOptions: routeOptions,
            simulating: simulationMode
          )
          let navigationOptions = NavigationOptions(navigationService: navigationService)
          navigationOptions.styles = [PikupNavigationStyle()]
          if !allowSystemCancel {
            navigationOptions.bottomBanner = PikupBottomBannerViewController()
          }
          let controller = NavigationViewController(
            for: indexedRouteResponse,
            navigationOptions: navigationOptions
          )
          controller.delegate = self
          controller.modalPresentationStyle = .fullScreen
          self.applyBranding(to: controller)
          self.enforceBrandStyle(on: controller)
          self.updateBottomBannerVisibility(on: controller)

          presenter.present(controller, animated: true) {
            self.enforceBrandStyle(on: controller)
            self.updateBottomBannerVisibility(on: controller)
            self.enable3DBuildings(on: controller)
            self.styleLoadedCancelable?.cancel()
            self.styleLoadedCancelable = controller.navigationMapView?.mapView.mapboxMap.onEvery(event: .styleLoaded) { [weak self, weak controller] _ in
              guard let self, let controller else { return }
              self.updateBottomBannerVisibility(on: controller)
              self.enable3DBuildings(on: controller)
              self.bringActionCardToFront(on: controller)
            }
            self.navigationViewController = controller
            self.installActionCardIfNeeded(on: controller, options: actionCardOptions)
            resolve(["started": true])
          }
        }
      }
    }
  }

  @objc(stopNavigationWithResolver:rejecter:)
  func stopNavigation(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    queue.async {
      guard let controller = self.navigationViewController else {
        resolve(["stopped": true, "active": false])
        return
      }

      controller.dismiss(animated: true) {
        self.cleanupNavigationSession()
        resolve(["stopped": true, "active": false])
      }
    }
  }

  func navigationViewController(
    _ navigationViewController: NavigationViewController,
    didUpdate progress: RouteProgress,
    with location: CLLocation,
    rawLocation: CLLocation
  ) {
    emitEvent(
      name: "onRouteProgress",
      payload: [
        "distanceRemaining": progress.distanceRemaining,
        "durationRemaining": progress.durationRemaining,
        "fractionTraveled": progress.fractionTraveled,
        "distanceTraveled": progress.distanceTraveled,
        "location": [
          "latitude": location.coordinate.latitude,
          "longitude": location.coordinate.longitude
        ],
        "rawLocation": [
          "latitude": rawLocation.coordinate.latitude,
          "longitude": rawLocation.coordinate.longitude
        ]
      ]
    )

    updatePrimaryActionAvailability(with: location)
  }

  func navigationViewController(_ navigationViewController: NavigationViewController, didArriveAt waypoint: Waypoint) -> Bool {
    emitEvent(
      name: "onArrival",
      payload: [
        "latitude": waypoint.coordinate.latitude,
        "longitude": waypoint.coordinate.longitude,
        "name": waypoint.name ?? ""
      ]
    )
    return true
  }

  func navigationViewControllerDidDismiss(
    _ navigationViewController: NavigationViewController,
    byCanceling canceled: Bool
  ) {
    if canceled {
      emitEvent(name: "onCancel", payload: ["cancelled": true])
    }
    cleanupNavigationSession()
  }

  func navigationViewController(_ navigationViewController: NavigationViewController, didRerouteAlong route: Route) {
    emitEvent(
      name: "onReroute",
      payload: [
        "distance": route.distance,
        "duration": route.expectedTravelTime
      ]
    )
  }

  private func emitEvent(name: String, payload: [String: Any]) {
    queue.async {
      self.eventEmitter?.sendEvent(withName: name, body: payload)
    }
  }

  @objc private func handlePrimaryActionTap() {
    emitActionEvent(eventName: "onPrimaryAction", fallbackAction: "primary")
  }

  @objc private func handleSecondaryActionTap() {
    emitActionEvent(eventName: "onSecondaryAction", fallbackAction: "secondary")
  }

  private func emitActionEvent(eventName: String, fallbackAction: String) {
    var payload = actionPayload
    if payload["action"] == nil {
      payload["action"] = fallbackAction
    }
    emitEvent(name: eventName, payload: payload)
  }

  private func installActionCardIfNeeded(on controller: NavigationViewController, options: NSDictionary?) {
    removeActionCard()

    guard let options else { return }
    let isEnabled = ((options["enabled"] as? NSNumber)?.boolValue) ?? true
    guard isEnabled else { return }

    if let payload = options["payload"] as? [String: Any] {
      actionPayload = payload
    } else if let payload = options["payload"] as? NSDictionary {
      actionPayload = payload.reduce(into: [String: Any]()) { partialResult, item in
        if let key = item.key as? String {
          partialResult[key] = item.value
        }
      }
    } else {
      actionPayload = [:]
    }

    let title = (options["title"] as? String) ?? "Current Stop"
    let subtitle = (options["subtitle"] as? String) ?? ""
    let primaryActionLabel = (options["primaryActionLabel"] as? String) ?? "Confirm"
    let secondaryActionLabel = options["secondaryActionLabel"] as? String
    let unlockDistanceMeters = (options["unlockDistanceMeters"] as? NSNumber)?.doubleValue
    primaryActionUnlockDistanceMeters = unlockDistanceMeters

    let card = UIView()
    card.translatesAutoresizingMaskIntoConstraints = false
    card.backgroundColor = UIColor(red: 10/255, green: 10/255, blue: 31/255, alpha: 1.0)
    card.layer.cornerRadius = 20
    card.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
    card.layer.borderWidth = 0
    card.layer.borderColor = UIColor.clear.cgColor
    card.clipsToBounds = true

    let titleLabel = UILabel()
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    titleLabel.text = title
    titleLabel.font = UIFont.systemFont(ofSize: 24, weight: .bold)
    titleLabel.textColor = .white
    titleLabel.numberOfLines = 1

    let subtitleLabel = UILabel()
    subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
    subtitleLabel.text = subtitle
    subtitleLabel.font = UIFont.systemFont(ofSize: 15, weight: .regular)
    subtitleLabel.textColor = UIColor(white: 1.0, alpha: 0.72)
    subtitleLabel.numberOfLines = 2

    let primaryButton = UIButton(type: .system)
    primaryButton.translatesAutoresizingMaskIntoConstraints = false
    primaryButton.setTitle(primaryActionLabel, for: .normal)
    primaryButton.setTitleColor(.white, for: .normal)
    primaryButton.titleLabel?.font = UIFont.systemFont(ofSize: 19, weight: .semibold)
    primaryButton.backgroundColor = UIColor(red: 167/255, green: 123/255, blue: 1.0, alpha: 1.0)
    primaryButton.layer.cornerRadius = 24
    primaryButton.layer.masksToBounds = true
    primaryButton.contentEdgeInsets = UIEdgeInsets(top: 13, left: 20, bottom: 13, right: 20)
    primaryButton.addTarget(self, action: #selector(handlePrimaryActionTap), for: .touchUpInside)
    primaryActionButton = primaryButton
    setPrimaryActionEnabled(unlockDistanceMeters == nil)

    let contentStack = UIStackView()
    contentStack.translatesAutoresizingMaskIntoConstraints = false
    contentStack.axis = .vertical
    contentStack.spacing = 12
    contentStack.alignment = .fill

    contentStack.addArrangedSubview(titleLabel)
    if !subtitle.isEmpty {
      contentStack.addArrangedSubview(subtitleLabel)
    }
    contentStack.addArrangedSubview(primaryButton)

    if let secondaryLabel = secondaryActionLabel, !secondaryLabel.isEmpty {
      let secondaryButton = UIButton(type: .system)
      secondaryButton.translatesAutoresizingMaskIntoConstraints = false
      secondaryButton.setTitle(secondaryLabel, for: .normal)
      secondaryButton.setTitleColor(.white, for: .normal)
      secondaryButton.titleLabel?.font = UIFont.systemFont(ofSize: 15, weight: .semibold)
      secondaryButton.backgroundColor = UIColor(red: 1.0, green: 68/255, blue: 68/255, alpha: 0.92)
      secondaryButton.layer.cornerRadius = 18
      secondaryButton.layer.masksToBounds = true
      secondaryButton.contentEdgeInsets = UIEdgeInsets(top: 9, left: 16, bottom: 9, right: 16)
      secondaryButton.addTarget(self, action: #selector(handleSecondaryActionTap), for: .touchUpInside)
      contentStack.addArrangedSubview(secondaryButton)
    }

    card.addSubview(contentStack)
    controller.view.addSubview(card)

    NSLayoutConstraint.activate([
      contentStack.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
      contentStack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
      contentStack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
      contentStack.bottomAnchor.constraint(equalTo: card.safeAreaLayoutGuide.bottomAnchor, constant: -16),

      card.leadingAnchor.constraint(equalTo: controller.view.leadingAnchor),
      card.trailingAnchor.constraint(equalTo: controller.view.trailingAnchor),
      card.bottomAnchor.constraint(equalTo: controller.view.bottomAnchor),
    ])

    controller.view.bringSubviewToFront(card)
    actionCardView = card
  }

  private func removeActionCard() {
    actionCardView?.removeFromSuperview()
    actionCardView = nil
    primaryActionButton = nil
    actionPayload = [:]
    primaryActionUnlockDistanceMeters = nil
  }

  private func applyBranding(to controller: NavigationViewController) {
    controller.navigationView.tintColor = PikupNavigationPalette.accent
    controller.navigationView.topBannerContainerView.backgroundColor = PikupNavigationPalette.header
    controller.navigationView.bottomBannerContainerView.backgroundColor = PikupNavigationPalette.surface
  }

  private func updateBottomBannerVisibility(on controller: NavigationViewController) {
    let shouldHideBottomBanner = !allowSystemCancelForCurrentSession
    let bottomBannerContainer = controller.navigationView.bottomBannerContainerView
    bottomBannerContainer.isHidden = shouldHideBottomBanner
    bottomBannerContainer.alpha = shouldHideBottomBanner ? 0 : 1
    bottomBannerContainer.isUserInteractionEnabled = !shouldHideBottomBanner

    let wayNameView = controller.navigationView.wayNameView
    wayNameView.isHidden = shouldHideBottomBanner
    wayNameView.alpha = shouldHideBottomBanner ? 0 : 1
    wayNameView.isUserInteractionEnabled = !shouldHideBottomBanner
  }

  private func enforceBrandStyle(on controller: NavigationViewController) {
    controller.styleManager.applyStyle(type: .night)

    guard let navigationMapView = controller.navigationMapView else { return }
    navigationMapView.trafficUnknownColor = PikupNavigationPalette.accent
    navigationMapView.trafficLowColor = PikupNavigationPalette.accent
    navigationMapView.trafficModerateColor = UIColor(red: 185/255, green: 140/255, blue: 1.0, alpha: 1.0)
    navigationMapView.trafficHeavyColor = UIColor(red: 1.0, green: 176/255, blue: 0.0, alpha: 1.0)
    navigationMapView.trafficSevereColor = UIColor(red: 1.0, green: 95/255, blue: 95/255, alpha: 1.0)
    navigationMapView.routeCasingColor = PikupNavigationPalette.accentMuted
    navigationMapView.traversedRouteColor = UIColor(red: 78/255, green: 57/255, blue: 130/255, alpha: 1.0)
    navigationMapView.routeAlternateColor = UIColor(red: 97/255, green: 89/255, blue: 145/255, alpha: 1.0)
    navigationMapView.routeAlternateCasingColor = UIColor(red: 57/255, green: 53/255, blue: 93/255, alpha: 1.0)
    navigationMapView.maneuverArrowColor = PikupNavigationPalette.accent
    navigationMapView.maneuverArrowStrokeColor = PikupNavigationPalette.accentMuted
    navigationMapView.buildingDefaultColor = UIColor(red: 49/255, green: 53/255, blue: 75/255, alpha: 1.0)
    controller.floatingButtons?.forEach { button in
      button.backgroundColor = PikupNavigationPalette.header.withAlphaComponent(0.94)
      button.tintColor = PikupNavigationPalette.textPrimary
      button.layer.borderColor = PikupNavigationPalette.accent.withAlphaComponent(0.65).cgColor
      button.layer.borderWidth = 1
    }
    if let route = controller.route {
      navigationMapView.show([route], legIndex: controller.navigationService.routeProgress.legIndex)
    }
  }

  private func enable3DBuildings(on controller: NavigationViewController) {
    guard let mapView = controller.navigationMapView?.mapView else { return }
    let style = mapView.mapboxMap.style
    guard style.sourceExists(withId: "composite") else { return }

    var buildingsLayer = FillExtrusionLayer(id: custom3DBuildingsLayerId)
    buildingsLayer.source = "composite"
    buildingsLayer.sourceLayer = "building"
    buildingsLayer.minZoom = 13
    buildingsLayer.filter = Exp(.eq) {
      Exp(.get) { "extrude" }
      "true"
    }
    buildingsLayer.fillExtrusionColor = .constant(.init(UIColor(red: 49/255, green: 53/255, blue: 75/255, alpha: 1.0)))
    buildingsLayer.fillExtrusionOpacity = .constant(0.82)
    buildingsLayer.fillExtrusionHeight = .expression(
      Exp(.interpolate) {
        Exp(.linear)
        Exp(.zoom)
        13
        0
        13.25
        Exp(.coalesce) {
          Exp(.get) { "height" }
          0
        }
      }
    )
    buildingsLayer.fillExtrusionBase = .expression(
      Exp(.interpolate) {
        Exp(.linear)
        Exp(.zoom)
        13
        0
        13.25
        Exp(.coalesce) {
          Exp(.get) { "min_height" }
          0
        }
      }
    )

    do {
      if style.layerExists(withId: custom3DBuildingsLayerId) {
        try style.updateLayer(withId: custom3DBuildingsLayerId, type: FillExtrusionLayer.self) { currentLayer in
          currentLayer = buildingsLayer
        }
      } else {
        let allLayerIds = style.allLayerIdentifiers.map(\\.id)
        let firstRouteLikeLayer = allLayerIds.first(where: { $0.contains("route") || $0.contains("arrow") || $0.contains("waypoint") })
        let layerPosition = firstRouteLikeLayer.map { LayerPosition.below($0) }
        try style.addPersistentLayer(buildingsLayer, layerPosition: layerPosition)
      }
    } catch {
      NSLog("[MapboxNavigationModule] Failed enabling 3D buildings: \\(error.localizedDescription)")
    }
  }

  private func bringActionCardToFront(on controller: NavigationViewController) {
    guard let actionCardView else { return }
    controller.view.bringSubviewToFront(actionCardView)
  }

  private func updatePrimaryActionAvailability(with location: CLLocation) {
    guard
      let unlockDistanceMeters = primaryActionUnlockDistanceMeters,
      let destinationCoordinate
    else {
      setPrimaryActionEnabled(true)
      return
    }

    let destination = CLLocation(latitude: destinationCoordinate.latitude, longitude: destinationCoordinate.longitude)
    let currentDistance = location.distance(from: destination)
    setPrimaryActionEnabled(currentDistance <= unlockDistanceMeters)
  }

  private func setPrimaryActionEnabled(_ enabled: Bool) {
    guard let primaryActionButton else { return }
    primaryActionButton.isEnabled = enabled
    primaryActionButton.alpha = enabled ? 1.0 : 0.55
  }

  private func cleanupNavigationSession() {
    removeActionCard()
    styleLoadedCancelable?.cancel()
    styleLoadedCancelable = nil
    destinationCoordinate = nil
    allowSystemCancelForCurrentSession = false
    navigationViewController = nil
  }

  private func coordinate(from payload: NSDictionary?) -> CLLocationCoordinate2D? {
    guard let payload else { return nil }

    let latitudeNumber =
      (payload["latitude"] as? NSNumber) ??
      (payload["lat"] as? NSNumber)
    let longitudeNumber =
      (payload["longitude"] as? NSNumber) ??
      (payload["lng"] as? NSNumber) ??
      (payload["lon"] as? NSNumber)

    guard
      let latitude = latitudeNumber?.doubleValue,
      let longitude = longitudeNumber?.doubleValue
    else {
      return nil
    }

    let coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    return CLLocationCoordinate2DIsValid(coordinate) ? coordinate : nil
  }

  private func topViewController() -> UIViewController? {
    let windowScene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first(where: { $0.activationState == .foregroundActive })
    let rootViewController = windowScene?
      .windows
      .first(where: { $0.isKeyWindow })?
      .rootViewController
    return MapboxNavigationModule.resolveTopViewController(from: rootViewController)
  }

  private static func resolveTopViewController(from root: UIViewController?) -> UIViewController? {
    if let navigationController = root as? UINavigationController {
      return resolveTopViewController(from: navigationController.visibleViewController)
    }

    if let tabBarController = root as? UITabBarController {
      return resolveTopViewController(from: tabBarController.selectedViewController)
    }

    if let presented = root?.presentedViewController {
      return resolveTopViewController(from: presented)
    }

    return root
  }
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

        // Ensure Navigation pod pin (idempotent, and upgrades old injected versions)
        const navPodPattern = /pod\s+'MapboxNavigation'\s*,\s*'[^']*'/;
        if (navPodPattern.test(podfile)) {
          podfile = podfile.replace(
            navPodPattern,
            `pod 'MapboxNavigation', '${IOS_NAV_POD_VERSION}'`
          );
        } else {
          podfile = podfile.replace(
            /target\s+'([^']+)'\s+do/m,
            (m) => `${m}\n  pod 'MapboxNavigation', '${IOS_NAV_POD_VERSION}'\n`
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
    let bridgesGroupKey = (project.getPBXGroupByKey(appGroupKey).children || [])
      .map((c) => c.value)
      .find((key) => project.getPBXGroupByKey(key)?.name === 'Bridges');
    if (!bridgesGroupKey) {
      const g = project.addPbxGroup([], 'Bridges', 'Bridges');
      (project.getPBXGroupByKey(appGroupKey).children ||= []).push({ value: g.uuid, comment: 'Bridges' });
      bridgesGroupKey = g.uuid;
    }
    const bridgesGroup = project.getPBXGroupByKey(bridgesGroupKey);
    // app group in Expo projects often has no `path`, so plain "Bridges"
    // resolves to ios/Bridges. Point explicitly to ios/<ProjectName>/Bridges.
    bridgesGroup.path = `${projectName}/Bridges`;
    bridgesGroup.name = 'Bridges';
    bridgesGroup.sourceTree = '"<group>"';

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

    // Remove orphan file UUIDs (stale references left in Sources list without BuildFile rows).
    const appSources = project.pbxSourcesBuildPhaseObj(appTargetUuid);
    if (appSources?.files?.length) {
      appSources.files = appSources.files.filter((f) => !!buildFiles[f.value]);
    }

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
    if (c.includes('com.mapbox.navigation:android')) {
      c = c.replace(/\n\s*implementation\("com\.mapbox\.navigation:android:[^"]+"\)\s*/g, '\n');
    }
    if (!c.includes('com.mapbox.navigationcore:android')) {
      c = c.replace(
        /dependencies\s*{/,
        (m) =>
          `${m}
    implementation("com.mapbox.navigationcore:android:${androidNavVersion}") {
        exclude group: "com.mapbox.maps"
        exclude group: "com.mapbox.module"
        exclude group: "com.mapbox.common", module: "common"
    }
    implementation("com.mapbox.navigationcore:ui-components:${androidNavVersion}") {
        exclude group: "com.mapbox.maps"
        exclude group: "com.mapbox.module"
        exclude group: "com.mapbox.common", module: "common"
    }
    implementation("com.mapbox.maps:android-ndk27:${ANDROID_MAPS_VERSION}")
    implementation("com.mapbox.common:common-ndk27:24.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
`
      );
    }
    mod.modResults.contents = c;
    return mod;
  });

  return config;
}

module.exports = withMapboxNavigation;
