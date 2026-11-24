// Иконки PWA и apple-touch-icon из знака ME:WISH (чёрный квадрат, лаймовое сердце — как Logo.tsx).
// Запуск (macOS): swift scripts/make-icons.swift  → public/icons/*.png
import AppKit

let heart = "M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"
let black = "#17181C", lime = "#C8F56A"

/// Сердце (в рамке 14×14 из viewBox 24: x 5…19, y 6…20) шириной `w`, по центру квадрата `side`.
func heartSvg(side: Double, w: Double) -> String {
  let s = w / 14
  let tx = side / 2 - 12 * s, ty = side / 2 - 13 * s
  return "<path transform=\"translate(\(tx) \(ty)) scale(\(s))\" fill=\"\(lime)\" d=\"\(heart)\"/>"
}

/// full — квадрат без прозрачных углов (iOS и маскируемая иконка скругляют сами);
/// иначе — скруглённый квадрат 80 % по сетке значков macOS (Dock), углы прозрачные.
func svg(side: Double, full: Bool, heartShare: Double) -> String {
  var body = ""
  if full {
    body += "<rect width=\"\(side)\" height=\"\(side)\" fill=\"\(black)\"/>"
    body += heartSvg(side: side, w: side * heartShare)
  } else {
    let box = side * 0.8, off = (side - box) / 2
    body += "<rect x=\"\(off)\" y=\"\(off)\" width=\"\(box)\" height=\"\(box)\" rx=\"\(box * 0.225)\" fill=\"\(black)\"/>"
    body += heartSvg(side: side, w: box * heartShare)
  }
  return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"\(side)\" height=\"\(side)\" viewBox=\"0 0 \(side) \(side)\">\(body)</svg>"
}

func render(_ name: String, px: Int, full: Bool, heartShare: Double) {
  let data = svg(side: Double(px), full: full, heartShare: heartShare).data(using: .utf8)!
  guard let img = NSImage(data: data) else { fatalError("SVG не открылся") }
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8, samplesPerPixel: 4,
    hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  img.draw(in: NSRect(x: 0, y: 0, width: px, height: px))
  NSGraphicsContext.restoreGraphicsState()
  let png = rep.representation(using: .png, properties: [:])!
  try! png.write(to: URL(fileURLWithPath: "public/icons/\(name)"))
  print("public/icons/\(name)")
}

render("apple-touch-icon.png", px: 180, full: true, heartShare: 0.5)
render("icon-192.png", px: 192, full: false, heartShare: 0.5)
render("icon-512.png", px: 512, full: false, heartShare: 0.5)
// маскируемая: сердце внутри безопасного круга (40 % от края до края)
render("icon-maskable-512.png", px: 512, full: true, heartShare: 0.42)
