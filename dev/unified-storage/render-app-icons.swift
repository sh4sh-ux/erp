// Deterministic export of the original NARO mark, without altering its geometry/colors.
// Run: swift dev/unified-storage/render-app-icons.swift (from repository root).
// Always use the immutable original so repeated builds never enlarge cumulatively.
import Foundation
import CoreGraphics
import ImageIO

let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
let input = root.appendingPathComponent("naro-icon-source.png")
guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
      let original = CGImageSourceCreateImageAtIndex(source, 0, nil),
      let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else { fatalError("Missing original icon") }
let symbolScale: CGFloat = 1.2
for size in [180, 192, 512] {
    guard let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                                  bytesPerRow: size * 4, space: colorSpace,
                                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { fatalError("Icon context") }
    let edge = CGFloat(size), expanded = edge * symbolScale
    context.setFillColor(CGColor(gray: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: edge, height: edge))
    context.interpolationQuality = .high
    context.draw(original, in: CGRect(x: (edge-expanded)/2, y: (edge-expanded)/2, width: expanded, height: expanded))
    let target = root.appendingPathComponent("naro-icons/icon-\(size).png")
    guard let image = context.makeImage(),
          let destination = CGImageDestinationCreateWithURL(target as CFURL, "public.png" as CFString, 1, nil) else { fatalError("Icon export") }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("Icon write failed") }
    print("Exported \(size)px, original symbol scale \(symbolScale)")
}
