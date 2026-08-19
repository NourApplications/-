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
    margin: 28px 0 56px;
    @bottom-center {
      content: "— " counter(page) " —";
      font-size: 14px;
      color: #8B6914;
      font-family: "Noto Naskh Arabic", "Traditional Arabic", Georgia, serif;
    }
  }

  body {
    /* Android system Arabic fonts, no CDN needed */
    font-family: "Noto Naskh Arabic", "Scheherazade New", "Traditional Arabic",
                 "Arabic Typesetting", Georgia, serif;
    background: #ffffff;
    direction: rtl;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 100%;
    padding: 32px 40px 56px;
    background: #ffffff;
  }

  /* Outer gold border — clone on every page break */
  .frame {
    border: 4px double #8B6914;
    padding: 4px;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }
  /* Inner thin border — clone on every page break */
  .frame-inner {
    border: 1px solid #C9A84C;
    padding: 24px 30px 30px;
    position: relative;
    background: #FFFEF8;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }

  /* Corner stars */
  .corner {
    position: absolute;
    font-size: 18px;
    color: #8B6914;
    line-height: 1;
  }
  .corner.tr { top:6px; right:8px; }
  .corner.tl { top:6px; left:8px; }
  .corner.br { bottom:6px; right:8px; }
  .corner.bl { bottom:6px; left:8px; }

  /* Header */
  .header { text-align:center; margin-bottom:20px; }

  .bismillah {
    font-size:34px;
    color:#8B6914;
    margin-bottom:10px;
    line-height:1.4;
  }
  .title {
    font-size:38px;
    font-weight:bold;
    color:#1a1a1a;
    margin-bottom:4px;
  }
  .subtitle {
    font-size:19px;
    color:#6B5000;
    margin-bottom:4px;
  }
  .date { font-size:16px; color:#888; }

  .rule {
    border:none;
    border-top:1px solid #C9A84C;
    margin:14px 0;
  }

  /* Dhikr card */
  .dhikr-item {
    display:table;
    width:100%;
    margin-bottom:6px;
    background:rgba(201,168,76,0.07);
    border-right:3px solid #C9A84C;
    border-radius:4px;
    padding:10px 12px;
  }
  .dhikr-num {
    display:table-cell;
    width:36px;
    vertical-align:top;
    text-align:center;
    padding-top:3px;
  }
  .num-circle {
    display:inline-block;
    width:28px;
    height:28px;
    background:#8B6914;
    color:#fff;
    border-radius:50%;
    text-align:center;
    line-height:28px;
    font-size:14px;
    font-weight:bold;
  }
  .dhikr-body { display:table-cell; vertical-align:top; padding-right:10px; }
  .dhikr-text { font-size:22px; line-height:1.9; color:#1a1a1a; }
  .count {
    display:inline-block;
    font-size:15px;
    color:#8B6914;
    background:rgba(139,105,20,0.1);
    padding:2px 10px;
    border-radius:10px;
    margin-top:5px;
  }

  .sep { text-align:center; color:#C9A84C; font-size:17px; margin:4px 0 8px; opacity:0.7; }

  /* Footer */
  .footer {
    text-align:center;
    margin-top:20px;
    padding-top:12px;
    border-top:1px solid #C9A84C;
    font-size:15px;
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

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `مشاركة ${title}`,
    UTI: "com.adobe.pdf",
  });
}
