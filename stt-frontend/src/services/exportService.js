import { jsPDF } from "jspdf";
import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel
} from "docx";

export const exportTranscriptAsPdf = (title, transcript) => {
  const pdf = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: "a4"
  });

  const marginX = 40;
  let y = 50;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginX * 2;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(title, marginX, y);

  y += 30;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);

  const lines = pdf.splitTextToSize(transcript || "No transcript available.", maxWidth);

  lines.forEach((line) => {
    if (y > 780) {
      pdf.addPage();
      y = 50;
    }
    pdf.text(line, marginX, y);
    y += 18;
  });

  pdf.save(`${title.replace(/\s+/g, "_")}.pdf`);
};

export const exportTranscriptAsDocx = async (title, transcript) => {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 32
              })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: transcript || "No transcript available.",
                size: 24
              })
            ]
          })
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${title.replace(/\s+/g, "_")}.docx`);
};