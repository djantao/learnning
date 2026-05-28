export async function buildPptxBlob(
  slides: { title: string; bullets: string[] }[],
  courseTitle?: string,
): Promise<Blob> {
  const PptxGenJS = (await import("pptxgenjs")).default
  const pptx = new PptxGenJS()

  pptx.defineLayout({ name: "CUSTOM", width: 1366 / 96, height: 768 / 96 })
  pptx.layout = "CUSTOM"

  for (const slide of slides) {
    const s = pptx.addSlide()

    s.addText(slide.title, {
      x: 0.8,
      y: 0.4,
      w: "85%",
      fontSize: 22,
      bold: true,
      color: "1a1a2e",
      fontFace: "Microsoft YaHei",
    })

    s.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 1.05,
      w: 3,
      h: 0.04,
      fill: { color: "6366f1" },
    })

    if (slide.bullets.length > 0) {
      const bullets = slide.bullets.map((b) => ({
        text: b,
        options: {
          bullet: { code: "2022" },
          fontSize: 14,
          color: "333333",
          fontFace: "Microsoft YaHei",
          paraSpaceAfter: 8,
        },
      }))

      s.addText(bullets as any, {
        x: 0.8,
        y: 1.4,
        w: "85%",
        h: 5.5,
        valign: "top",
      } as any)
    }

    if (courseTitle) {
      s.addText(courseTitle, {
        x: 0.8,
        y: "94%",
        w: "85%",
        fontSize: 8,
        color: "999999",
        fontFace: "Microsoft YaHei",
      })
    }
  }

  return (await pptx.write({ outputType: "blob" })) as Blob
}
