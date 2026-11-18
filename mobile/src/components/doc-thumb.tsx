import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { RecordItem } from "@shared/tessera";
import { API_URL, authHeader } from "@/lib/api";
import { color } from "@/lib/theme";

// Like the web app's DocThumb (interpreter/src/components/DocPreview.tsx): the photo when the document is one,
// otherwise a small drawn page with a coloured heading bar for its kind.
const BAR: Record<RecordItem["kind"], string> = {
  encounter: color.okText,
  document: color.blue,
  upload: color.sectionTitle,
};

export const isPhoto = (r: RecordItem) =>
  r.hasFile && !!r.contentType?.startsWith("image/");
export const fileSource = (r: RecordItem) => ({
  uri: `${API_URL}/api/v1/records/${r.id}/file`,
  headers: authHeader(),
});

export function DocThumb({
  record,
  width = 46,
}: {
  record: RecordItem;
  width?: number;
}) {
  const [failed, setFailed] = useState(false);
  const height = Math.round(width * 1.3);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.shadow, { width, height }]}
    >
      <View style={styles.clip}>
        {isPhoto(record) && !failed ? (
          <Image
            source={fileSource(record)}
            onError={() => setFailed(true)}
            resizeMode="cover"
            style={{ width, height }}
          />
        ) : (
          <View style={styles.paper}>
            <View style={[styles.bar, { backgroundColor: BAR[record.kind] }]} />
            {[100, 100, 60, 100, 60].map((w, i) => (
              <View key={i} style={[styles.line, { width: `${w}%` }]} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The shadow sits on the outer view: iOS drops shadows on a view that clips its children.
  shadow: {
    borderRadius: 5,
    backgroundColor: "white",
    marginTop: 2,
    shadowColor: color.ink,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  clip: {
    flex: 1,
    borderRadius: 5,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  paper: { flex: 1, padding: 6, gap: 4 },
  bar: { height: 6, width: "70%", borderRadius: 1, marginBottom: 3 },
  line: {
    height: 2.5,
    borderRadius: 1,
    backgroundColor: "rgba(23,36,58,0.16)",
  },
});
