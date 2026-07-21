import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors, fonts } from "@/theme";

/**
 * Checkmark drawn in a 0–100 viewBox. `CHECK_LENGTH` is the traced path length
 * (√481 + √1741 ≈ 63.7, rounded up) — used as both dash array and the starting
 * dash offset so the stroke can "draw on" from nothing to full.
 */
const CHECK_PATH = "M28 51 L44 66 L73 36";
const CHECK_LENGTH = 66;

/** Timing constants (ms) for the one-shot reveal — kept named per coding-style. */
const SCRIM_IN = 180;
const TRACE_DELAY = 180;
const TRACE_DURATION = 400;
const LABEL_DELAY = 340;
const LABEL_DURATION = 220;
const EXIT_DURATION = 240;
const DEFAULT_HOLD_MS = 2000;

export interface SuccessCheckProps {
  /** When true, plays the reveal; keep true until `onDone` fires. */
  readonly visible: boolean;
  /** Caption under the badge, e.g. "Account created". */
  readonly message: string;
  /** How long the badge stays fully visible before it exits. Min 3000 for
   *  account creation per product spec; defaults to a shorter celebratory beat. */
  readonly holdMs?: number;
  /** Fires after the exit animation completes — navigate or hide here. */
  readonly onDone: () => void;
}

/**
 * Full-screen success overlay: a green circle scales in and a white checkmark
 * traces on, mirroring the Lottie source. Built on the RN `Animated` API +
 * `react-native-svg` so it needs no Reanimated/worklets babel setup.
 */
export function SuccessCheck({ visible, message, holdMs = DEFAULT_HOLD_MS, onDone }: SuccessCheckProps) {
  const scrim = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;
  const dash = useRef(new Animated.Value(CHECK_LENGTH)).current;
  const label = useRef(new Animated.Value(0)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  // Mirror the dash Animated.Value into state and feed it to a plain <Path>.
  // Wrapping Path in Animated.createAnimatedComponent injects collapsable={false},
  // which react-native-svg's web shim forwards to the DOM and React rejects.
  const [dashOffset, setDashOffset] = useState(CHECK_LENGTH);

  useEffect(() => {
    if (!visible) {
      return;
    }

    // Reset so a re-show replays cleanly.
    scrim.setValue(0);
    scale.setValue(0);
    dash.setValue(CHECK_LENGTH);
    label.setValue(0);
    setDashOffset(CHECK_LENGTH);

    const dashSub = dash.addListener(({ value }) => setDashOffset(value));

    AccessibilityInfo.announceForAccessibility(message);

    Animated.parallel([
      Animated.timing(scrim, {
        toValue: 1,
        duration: SCRIM_IN,
        useNativeDriver: true,
      }),
      // Spring gives the badge a subtle overshoot as it pops in.
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(dash, {
      toValue: 0,
      delay: TRACE_DELAY,
      duration: TRACE_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // strokeDashoffset is not transform/opacity
    }).start();

    Animated.timing(label, {
      toValue: 1,
      delay: LABEL_DELAY,
      duration: LABEL_DURATION,
      useNativeDriver: true,
    }).start();

    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(scrim, {
          toValue: 0,
          duration: EXIT_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.8,
          duration: EXIT_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(label, {
          toValue: 0,
          duration: EXIT_DURATION - 60,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onDoneRef.current();
        }
      });
    }, holdMs);

    return () => {
      clearTimeout(exitTimer);
      dash.removeListener(dashSub);
    };
    // Replay only when `visible` toggles on; other deps are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.overlay, { opacity: scrim }]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Animated.View style={[styles.badge, { transform: [{ scale }] }]}>
        <Svg width={104} height={104} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={46} fill={colors.green} />
          <Path
            d={CHECK_PATH}
            stroke={colors.white}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={CHECK_LENGTH}
            strokeDashoffset={dashOffset}
          />
        </Svg>
      </Animated.View>
      <Animated.Text style={[styles.message, { opacity: label }]}>{message}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17, 33, 28, 0.34)",
  },
  badge: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    // Soft lift so the green disc reads above the blurred screen behind it.
    shadowColor: colors.navy,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  message: {
    marginTop: 20,
    fontSize: 16,
    fontFamily: fonts.sans700,
    letterSpacing: -0.2,
    color: colors.white,
  },
});
