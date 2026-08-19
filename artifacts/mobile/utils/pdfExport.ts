import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { Dhikr } from "@/context/AppContext";

function toArabicNumerals(n: number): string {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
}

function todayArabic(): string {
  const d = new Date();
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const months = [
    "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];
  return `${days[d.getDay()]} ${toArabicNumerals(d.getDate())} ${months[d.getMonth()]} ${toArabicNumerals(d.getFullYear())}`;
}

function buildHTML(adhkar: Dhikr[], category: "morning" | "evening"): string {
  const title = category === "morning" ? "أذكار الصباح" : "أذكار المساء";
  const subtitle = category === "morning"
    ? "اللهم بك أصبحنا وبك أمسينا"
    : "اللهم بك أمسينا وبك أصبحنا";
  const date = todayArabic();

  const rows = adhkar
    .map((d, i) => {
      const countLabel = d.maxCount > 1
        ? `<div class="count">تُقال: ${toArabicNumerals(d.maxCount)} مرات</div>`
        : "";
      return `
        <div class="dhikr-item">
          <div class="dhikr-num">${toArabicNumerals(i + 1)}</div>
          <div class="dhikr-body">
            <div class="dhikr-text">${d.text.replace(/\n/g, "<br/>")}</div>
            ${countLabel}
          </div>
        </div>
        <div class="sep">&#10022;</div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }

  @page {
    size: A4;
    margin: 20mm 15mm 22mm;
    @bottom-center {
      content: "— " counter(page) " —";
      font-size: 12px;
      color: #8B6914;
      font-family: "Noto Naskh Arabic", "Traditional Arabic", Georgia, serif;
    }
  }

  body {
    font-family: "Noto Naskh Arabic", "Scheherazade New", "Traditional Arabic",
                 "Arabic Typesetting", Georgia, serif;
    background: #ffffff;
    direction: rtl;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-size: 14px;
  }

  .page {
    width: 100%;
    background: #ffffff;
  }

  /* Outer gold border */
  .frame {
    border: 3px double #8B6914;
    padding: 3px;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }

  /* Inner thin border */
  .frame-inner {
    border: 1px solid #C9A84C;
    padding: 16px 20px 18px;
    position: relative;
    background: #ffffff;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }

  /* Corner stars */
  .corner {
    position: absolute;
    font-size: 14px;
    color: #8B6914;
    line-height: 1;
  }
  .corner.tr { top:4px; right:6px; }
  .corner.tl { top:4px; left:6px; }
  .corner.br { bottom:4px; right:6px; }
  .corner.bl { bottom:4px; left:6px; }

  /* Header */
  .header { text-align:center; margin-bottom:12px; }

  .bismillah {
    font-size:32px;
    color:#8B6914;
    margin-bottom:6px;
    line-height:1.3;
  }
  .title {
    font-size:34px;
    font-weight:bold;
    color:#1a1a1a;
    margin-bottom:4px;
  }
  .subtitle {
    font-size:18px;
    color:#6B5000;
    margin-bottom:3px;
  }
  .date { font-size:15px; color:#888; }

  .rule {
    border:none;
    border-top:1px solid #C9A84C;
    margin:10px 0;
  }

  /* Dhikr item — no background shading */
  .dhikr-item {
    display:block;
    width:100%;
    margin-bottom:4px;
    background: transparent;
    border-top: 1px solid rgba(201,168,76,0.35);
    padding:8px 10px 6px;
    text-align:center;
  }
  .dhikr-item:first-of-type {
    border-top: none;
  }
  .dhikr-num {
    display:block;
    text-align:center;
    margin-bottom:3px;
  }
  .num-circle {
    display:inline-block;
    width:22px;
    height:22px;
    background:#8B6914;
    color:#fff;
    border-radius:50%;
    text-align:center;
    line-height:22px;
    font-size:11px;
    font-weight:bold;
  }
  .dhikr-body { display:block; text-align:center; }
  .dhikr-text {
    font-size:22px;
    line-height:1.7;
    color:#1a1a1a;
    text-align:center;
  }
  .count {
    display:inline-block;
    font-size:14px;
    color:#8B6914;
    border: 1px solid rgba(139,105,20,0.3);
    padding:1px 8px;
    border-radius:8px;
    margin-top:3px;
  }

  .sep {
    text-align:center;
    color:#C9A84C;
    font-size:13px;
    margin:2px 0 4px;
    opacity:0.6;
  }

  /* Footer */
  .footer {
    text-align:center;
    margin-top:12px;
    padding-top:8px;
    border-top:1px solid #C9A84C;
    font-size:13px;
    color:#aaa;
  }
</style>
</head>
<body>
<div class="page">
  <div class="frame">
    <div class="frame-inner">
      <span class="corner tr">&#10022;</span>
      <span class="corner tl">&#10022;</span>
      <span class="corner br">&#10022;</span>
      <span class="corner bl">&#10022;</span>

      <div class="header">
        <div class="bismillah">&#65021;</div>
        <div class="title">${title}</div>
        <div class="subtitle">${subtitle}</div>
        <div class="date">${date}</div>
      </div>
      <hr class="rule"/>

      ${rows}

      <div class="footer">&#10022; &nbsp; &#10022; &nbsp; &#10022;<br/>أذكار الصباح والمساء</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

export async function exportCategoryPDF(
  adhkar: Dhikr[],
  category: "morning" | "evening"
): Promise<void> {
  const title = category === "morning" ? "أذكار الصباح" : "أذكار المساء";
  const html = buildHTML(adhkar, category);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("المشاركة غير متاحة على هذا الجهاز");
  }

  // A4: 595 × 842 points
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
    width: 595,
    height: 842,
  });

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `مشاركة ${title}`,
    UTI: "com.adobe.pdf",
  });
}
