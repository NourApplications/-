import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet } from "react-native";

const splashSource = require("../assets/images/splash.png");

interface Props {
  visible: boolean;
  onImageReady?: () => void;
}

export function CustomSplash({ visible, onImageReady }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="none">
      <Image
        source={splashSource}
        style={styles.image}
        resizeMode="contain"
        onLoad={onImageReady}
        fadeDuration={0}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
