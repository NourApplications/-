import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import ReorderableList, {
  reorderItems,
  type ReorderableListReorderEvent,
} from "react-native-reorderable-list";
import { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { exportCategoryPDF } from "@/utils/pdfExport";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ControlBar } from "@/components/ControlBar";
import { DhikrCard } from "@/components/DhikrCard";
import { EditModal } from "@/components/EditModal";
import { Icon } from "@/components/Icon";
import {
  BG_COLORS,
  TEXT_COLORS,
  useApp,
  type Dhikr,
} from "@/context/AppContext";

export default function MainScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const { adhkar, isLoaded, settings, activeCategory, setActiveCategory, categoryResetKey, reorderDhikr } = useApp();

  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<Dhikr | null>(null);
  const { theme, bgColor } = settings;
  const bgC = BG_COLORS[theme][bgColor];
  const textC = TEXT_COLORS[theme];
  const primaryC = theme === "day" ? "#2E7D32" : "#4CAF50";
  const mutedC = theme === "day" ? "#6B7280" : "#9CA3AF";
  const borderC = theme === "day" ? "#E0E0E0" : "#333333";

  const all = adhkar.filter((d) => d.category === activeCategory);

  const listRef = useRef<FlatList<Dhikr>>(null);
  // ReorderableList composes onScroll through Reanimated's useComposedEventHandler,
  // which only accepts a worklet handler — a plain JS onScroll callback is silently
  // dropped. So we track the scroll offset in a shared value (readable from JS via
  // .value) instead of a plain ref.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const itemHeightsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 0);
  }, [activeCategory]);

  useEffect(() => {
    if (categoryResetKey === 0) return;
    setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 50);
  }, [categoryResetKey]);

  const handleReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      const newOrder = reorderItems(all, from, to);
      reorderDhikr(
        activeCategory,
        newOrder.map((d) => d.id)
      );
    },
    [all, activeCategory, reorderDhikr]
  );

  const handleEdit = useCallback((item: Dhikr) => {
    setEditItem(item);
    setModalVisible(true);
  }, []);

  const handleAdd = () => {
    setEditItem(null);
    setModalVisible(true);
  };

  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [headerNaturalHeight, setHeaderNaturalHeight] = useState(120);
  const headerAnim = useRef(new Animated.Value(1)).current;

  const toggleHeader = () => {
    const toValue = headerCollapsed ? 1 : 0;
    Animated.timing(headerAnim, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setHeaderCollapsed(!headerCollapsed);
  };

  const headerHeight = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, headerNaturalHeight],
  });

  const doExport = async (category: "morning" | "evening") => {
    if (Platform.OS === "web") {
      Alert.alert("غير متاح", "مشاركة PDF تعمل على تطبيق الهاتف فقط.");
      return;
    }
    const list = adhkar.filter((d) => d.category === category);
    if (list.length === 0) {
      Alert.alert("لا توجد أذكار", "لم يتم العثور على أذكار في هذه الفئة.");
      return;
    }
    try {
      setPdfLoading(true);
      await exportCategoryPDF(list, category);
    } catch (e) {
      Alert.alert("خطأ", "تعذّر إنشاء الملف، حاول مرة أخرى.");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (pdfLoading) return;
    if (Platform.OS === "web") {
      Alert.alert("غير متاح", "مشاركة PDF تعمل على تطبيق الهاتف فقط.");
      return;
    }
    setShareSheetVisible(true);
  };

  const chooseExport = (category: "morning" | "evening") => {
    setShareSheetVisible(false);
    // Let the sheet finish dismissing before the native share dialog appears
    setTimeout(() => doExport(category), 600);
  };

  const bottomPad =
    Platform.OS === "web"
      ? Math.max(insets.bottom + 34, 80)
      : insets.bottom + 16;

  return (
    <View style={[styles.root, { backgroundColor: theme === "day" ? "#FFFFFF" : "#000000", paddingTop: insets.top }]}>
      <View style={{ overflow: "hidden" }}>
        <Animated.View style={{ height: headerHeight, overflow: "hidden" }}>
          <View
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              // Guard against re-measuring while the header is mid-collapse:
              // once collapsed, this view can get reported with a shrunk/0
              // height by the platform, which would otherwise permanently
              // zero out headerNaturalHeight and break re-expanding.
              if (h > 0) setHeaderNaturalHeight(h);
            }}
          >
            <ControlBar />
            <View style={[styles.segmentWrapper, { borderBottomColor: borderC }]}>
              <View style={[
                styles.segmentOuter,
                isTablet && { alignItems: "center" },
              ]}>
                <View style={[
                  styles.segment,
                  { backgroundColor: theme === "day" ? "#F5F5F5" : "#1A1A1A", direction: "ltr" },
                  isTablet && { width: 400 },
                ]}>
                  {(["evening", "morning"] as const).map((cat) => {
                    const isActive = activeCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setActiveCategory(cat)}
                        style={[
                          styles.segBtn,
                          isActive && {
                            backgroundColor: bgC,
                            shadowColor: "#000",
                            shadowOpacity: 0.08,
                            shadowRadius: 4,
                            shadowOffset: { width: 0, height: 1 },
                            elevation: 2,
                          },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.segBtnText,
                            { color: isActive ? primaryC : mutedC },
                            isActive && styles.segBtnTextActive,
                          ]}
                        >
                          {cat === "morning" ? "أذكار الصباح" : "أذكار المساء"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Pin button: stays in normal document flow at a fixed position right
          below the collapsible header block. It never moves or animates
          itself, so it can never end up overlapping/merging with the top
          edge regardless of collapse state.
          Both states now use a single full-width button:
          - Expanded: one centered up-chevron.
          - Collapsed: two down-chevrons, one at each edge of the button. */}
      <View style={styles.pinBtnRow} pointerEvents="box-none">
        {headerCollapsed ? (
          <TouchableOpacity
            onPress={toggleHeader}
            style={[styles.pinBtnWide, styles.pinBtnWideRow, { backgroundColor: theme === "day" ? "#F5F5F5" : "#1A1A1A", borderColor: borderC }]}
            activeOpacity={0.7}
          >
            <Icon name="chevron-down" size={14} color={mutedC} />
            <Icon name="chevron-down" size={14} color={mutedC} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={toggleHeader}
            style={[styles.pinBtnWide, { backgroundColor: theme === "day" ? "#F5F5F5" : "#1A1A1A", borderColor: borderC }]}
            activeOpacity={0.7}
          >
            <Icon name="chevron-up" size={14} color={mutedC} />
          </TouchableOpacity>
        )}
      </View>

      {!isLoaded ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={primaryC} />
        </View>
      ) : all.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="book-open" size={48} color={mutedC} />
          <Text style={[styles.emptyTitle, { color: textC }]}>
            لا توجد أذكار
          </Text>
          <Text style={[styles.emptySubtitle, { color: mutedC }]}>
            اضغط + لإضافة ذكر جديد
          </Text>
        </View>
      ) : (
        <ReorderableList
          ref={listRef}
          style={styles.listFlex}
          data={all}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomPad },
            isTablet && { alignItems: "center" },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={all.some((d) => d.currentCount > 0)}
          onScroll={scrollHandler}
          onReorder={handleReorder}
          renderItem={({ item }) => (
            <View
              onLayout={(e) => { itemHeightsRef.current[item.id] = e.nativeEvent.layout.height; }}
              style={isTablet ? { width: Math.min(width * 0.72, 680) } : { width: "100%" }}
            >
              <DhikrCard
                item={item}
                onEdit={handleEdit}
                onComplete={() => {
                  // Calculate this card's top offset in the list (hidden items contribute 0).
                  const idx = all.findIndex((d) => d.id === item.id);
                  const cardTop = all
                    .slice(0, idx)
                    .reduce((sum, d) => sum + (itemHeightsRef.current[d.id] ?? 0), 0);
                  // Only scroll if the user has scrolled past the card's top by more than
                  // a small threshold — i.e. they're reading the bottom of a tall card.
                  // scrollY is kept current by the Reanimated scroll handler above.
                  if (scrollY.value > cardTop + 40) {
                    listRef.current?.scrollToOffset({ offset: cardTop, animated: false });
                  }
                }}
              />
            </View>
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: primaryC, bottom: insets.bottom + 20 }]}
        onPress={handleAdd}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={20} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.pdfFab, { backgroundColor: theme === "day" ? "#8B6914" : "#C9A84C", bottom: insets.bottom + 20 }]}
        onPress={handleExportPDF}
        activeOpacity={0.85}
        disabled={pdfLoading}
      >
        {pdfLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Icon name="book-open" size={18} color="#fff" />
        )}
      </TouchableOpacity>

      <Modal
        visible={shareSheetVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setShareSheetVisible(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setShareSheetVisible(false)}>
          <Pressable
            style={styles.sheetWrap}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.sheetGroup, { backgroundColor: bgC }]}>
              <View style={styles.sheetTitleWrap}>
                <Text style={[styles.sheetTitle, { color: mutedC }]}>مشاركة الأذكار PDF</Text>
              </View>
              <View style={[styles.sheetDivider, { backgroundColor: borderC }]} />
              <TouchableOpacity style={styles.sheetBtn} onPress={() => chooseExport("morning")}>
                <Text style={[styles.sheetBtnText, { color: primaryC }]}>أذكار الصباح</Text>
              </TouchableOpacity>
              <View style={[styles.sheetDivider, { backgroundColor: borderC }]} />
              <TouchableOpacity style={styles.sheetBtn} onPress={() => chooseExport("evening")}>
                <Text style={[styles.sheetBtnText, { color: primaryC }]}>أذكار المساء</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.sheetGroup, styles.sheetCancel, { backgroundColor: bgC }]}
              onPress={() => setShareSheetVisible(false)}
            >
              <Text style={[styles.sheetCancelText, { color: textC }]}>إلغاء</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <EditModal
        visible={modalVisible}
        editItem={editItem}
        defaultCategory={activeCategory}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  segmentWrapper: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  segmentOuter: {
    width: "100%",
  },
  segment: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 8,
  },
  segBtnText: {
    fontSize: 15,
    fontWeight: "500" as const,
  },
  segBtnTextActive: {
    fontWeight: "700" as const,
  },
  listFlex: {
    flex: 1,
  },
  pinBtnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 0,
    marginBottom: 6,
  },
  pinBtnWide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 10,
  },
  pinBtnWideRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  list: {
    padding: 16,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  emptySubtitle: {
    fontSize: 14,
  },
  fab: {
    position: "absolute",
    bottom: 36,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  pdfFab: {
    position: "absolute",
    bottom: 36,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  sheetWrap: {
    width: "100%",
  },
  sheetGroup: {
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  sheetTitleWrap: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    textAlign: "center",
  },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
  sheetBtn: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBtnText: {
    fontSize: 22,
    fontWeight: "700" as const,
    textAlign: "center",
  },
  sheetCancel: {
    marginTop: 12,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  sheetCancelText: {
    fontSize: 20,
    fontWeight: "700" as const,
    textAlign: "center",
  },
});
