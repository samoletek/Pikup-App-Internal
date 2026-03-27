// Trip Hero Card component: renders the top card on the Trip Details screen.
import React from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '../../styles/theme';

const STATUS_ICON_SIZE = typography.fontSize.sm + 2;
const ROUTE_ICON_SIZE = typography.fontSize.md;
const RATING_STAR_SIZE = typography.fontSize.xs + 2;

export default function TripHeroCard({
  displayTrip,
  ui,
  onOpenChat = null,
  hasUnreadChat = false,
  isOpeningChat = false,
}) {
  const hasDriver = Boolean(displayTrip.driverId);
  const hasDriverPlate = typeof displayTrip.driverPlateLabel === "string"
    && displayTrip.driverPlateLabel.trim().length > 0;
  const hasDriverRating =
    Number.isFinite(displayTrip.driverRatingValue) && displayTrip.driverRatingValue > 0;
  const driverRatingStars = Number.isFinite(displayTrip.driverRatingStars)
    ? displayTrip.driverRatingStars
    : 0;

  return (
    <LinearGradient
      colors={[colors.background.panel, colors.background.tertiary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={ui.heroCard}
    >
      {/* --- Row 1: Status chip + Price --- */}
      <View style={ui.heroTopRow}>
        <View
          style={[
            ui.statusChip,
            { backgroundColor: displayTrip.statusChipBackground },
          ]}
        >
          <Ionicons
            name={displayTrip.statusIcon}
            size={STATUS_ICON_SIZE}
            color={displayTrip.statusTextColor}
          />
          <Text style={[ui.statusChipText, { color: displayTrip.statusTextColor }]}>
            {displayTrip.statusLabel}
          </Text>
        </View>

        <Text style={ui.amountText}>{displayTrip.amountLabel}</Text>
      </View>

      {/* --- Route block (pickup -> dropoff) --- */}
      <View style={ui.heroRouteBlock}>
        {/* Pickup */}
        <View style={ui.heroRouteRow}>
          <View style={ui.heroRouteTimeline}>
            <View style={[ui.heroRouteDot, ui.heroRouteDotPickup]} />
            <View style={ui.heroRouteConnector} />
          </View>
          <Text style={ui.heroRouteText} numberOfLines={2}>
            {displayTrip.pickupAddress}
          </Text>
        </View>

        {/* Dropoff */}
        <View style={ui.heroRouteRow}>
          <View style={ui.heroRouteTimeline}>
            <View style={[ui.heroRouteDot, ui.heroRouteDotDropoff]} />
          </View>
          <Text style={ui.heroRouteText} numberOfLines={2}>
            {displayTrip.dropoffAddress}
          </Text>
        </View>
      </View>

      {/* --- Driver row --- */}
      <View style={ui.heroDriverRow}>
        <View style={ui.heroParticipantAvatar}>
          {displayTrip.driverAvatarUrl ? (
            <Image
              source={{ uri: displayTrip.driverAvatarUrl }}
              style={ui.heroParticipantAvatarImage}
            />
          ) : (
            <Ionicons name="person" size={18} color={colors.text.muted} />
          )}
        </View>

        <View style={ui.heroDriverInfo}>
          <Text style={ui.heroDriverName} numberOfLines={1}>
            {displayTrip.driverName}
          </Text>
          {hasDriverRating ? (
            <View style={ui.heroDriverRatingRow}>
              {[...Array(5)].map((_, index) => (
                <Ionicons
                  key={`driver-rating-star-${index}`}
                  name="star"
                  size={RATING_STAR_SIZE}
                  color={index < driverRatingStars ? colors.gold : colors.border.default}
                />
              ))}
              <Text style={ui.heroDriverRatingText}>
                {displayTrip.driverRatingLabel}
              </Text>
            </View>
          ) : null}
          <View style={ui.heroVehicleRow}>
            <Ionicons name="car-sport-outline" size={ROUTE_ICON_SIZE - 2} color={colors.text.tertiary} />
            <Text style={ui.heroVehicleText} numberOfLines={1}>
              {displayTrip.driverVehicleLabel}
            </Text>
          </View>
          <Text style={ui.heroMeta}>
            {displayTrip.createdLabel}  ·  {displayTrip.idShort}
          </Text>
        </View>

        {hasDriverPlate ? (
          <View style={ui.heroPlatePill}>
            <Text style={ui.heroPlateText} numberOfLines={1}>
              {displayTrip.driverPlateLabel}
            </Text>
          </View>
        ) : null}

        {typeof onOpenChat === 'function' && hasDriver ? (
          <View style={ui.heroChatButtonWrap}>
            <TouchableOpacity
              onPress={onOpenChat}
              activeOpacity={0.85}
              disabled={isOpeningChat}
              style={[
                ui.heroChatButton,
                isOpeningChat ? ui.heroChatButtonDisabled : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Chat with driver"
            >
              {isOpeningChat ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="chatbubble-ellipses" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
            {hasUnreadChat ? <View style={ui.heroChatUnreadDot} /> : null}
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}
