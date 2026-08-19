import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  text: string;
}

const GOLD_DARK = "#9C7A2D";
const GOLD_MID = "#C8A84B";
const BG = "#FBF0DC";
const TEXT_COLOR = "#3D2B1F";

export const DhikrShareImage = React.forwardRef<View, Props>(
  ({ text }, ref) => {
    return (
      <View ref={ref} collapsable={false} style={styles.background}>
        <View style={styles.outerBorder}>
          <Text style={[styles.corner, styles.cornerTL]}>✦</Text>
          <Text style={[styles.corner, styles.cornerTR]}>✦</Text>
          <Text style={[styles.corner, styles.cornerBL]}>✦</Text>
          <Text style={[styles.corner, styles.cornerBR]}>✦</Text>

          <View style={styles.innerBorder}>
            <Text style={[styles.corner, styles.cornerTL]}>❧</Text>
            <Text style={[styles.corner, { top: -8, right: -8, transform: [{ scaleX: -1 }] }]}>❧</Text>
            <Text style={[styles.corner, { bottom: -8, left: -8 }]}>❧</Text>
            <Text style={[styles.corner, { bottom: -8, right: -8, transform: [{ scaleX: -1 }] }]}>❧</Text>

            <View style={styles.content}>
              <Text style={styles.ornLine}>─── ✦ ──── ✦ ──── ✦ ───</Text>
              <Text style={styles.dhikrText}>{text}</Text>
              <Text style={styles.ornLine}>─── ✦ ──── ✦ ──── ✦ ───</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }
);

DhikrShareImage.displayName = "DhikrShareImage";

const styles = StyleSheet.create({
  background: {
    width: 380,
    backgroundColor: BG,
    padding: 14,
  },
  outerBorder: {
    borderWidth: 3,
    borderColor: GOLD_DARK,
    padding: 7,
    position: "relative",
  },
  innerBorder: {
    borderWidth: 1,
    borderColor: GOLD_MID,
    position: "relative",
  },
  corner: {
    position: "absolute",
    fontSize: 14,
    color: GOLD_DARK,
    backgroundColor: BG,
    paddingHorizontal: 2,
    lineHeight: 16,
    zIndex: 2,
    top: -8,
    left: -8,
  },
  cornerTL: { top: -8, left: -8 },
  cornerTR: { top: -8, right: -8 },
  cornerBL: { bottom: -8, left: -8 },
  cornerBR: { bottom: -8, right: -8 },
  content: {
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 6,
  },
  ornLine: {
    fontSize: 12,
    color: GOLD_MID,
    textAlign: "center",
    letterSpacing: 1.5,
    marginVertical: 10,
  },
  dhikrText: {
    fontSize: 19,
    color: TEXT_COLOR,
    textAlign: "center",
    writingDirection: "rtl",
    lineHeight: 32,
    fontWeight: "500",
    marginVertical: 4,
  },
});
