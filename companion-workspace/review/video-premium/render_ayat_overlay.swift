import AppKit
import Foundation

let canvasWidth = 1890
let canvasHeight = 1080
let fps = 30.0
let overlayStart = 3.80
let overlayDuration = 6.35
let frameCount = Int((overlayDuration * fps).rounded(.up))

guard CommandLine.arguments.count > 1 else {
    fputs("Usage: render_ayat_overlay.swift OUTPUT_DIR\n", stderr)
    exit(2)
}

let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

let phrases = [
    "اقْرَأْ",
    "بِاسْمِ رَبِّكَ",
    "الَّذِي خَلَقَ",
    "عَلَّمَ بِالْقَلَمِ",
    "الْإِنسَانَ"
]

let wideTargets: [CGFloat] = [570, 750, 935, 1115, 1300]
let closeTargets: [CGFloat] = [355, 680, 960, 1225, 1535]
let gold = NSColor(calibratedRed: 1.0, green: 0.72, blue: 0.20, alpha: 1.0)
let paleGold = NSColor(calibratedRed: 1.0, green: 0.90, blue: 0.58, alpha: 1.0)
let fontWide = NSFont(name: "SFArabic-Regular", size: 17) ?? NSFont.systemFont(ofSize: 17, weight: .medium)
let fontClose = NSFont(name: "SFArabic-Regular", size: 22) ?? NSFont.systemFont(ofSize: 22, weight: .semibold)

func clamp(_ value: Double, _ lower: Double = 0, _ upper: Double = 1) -> Double {
    min(max(value, lower), upper)
}

func smoothstep(_ edge0: Double, _ edge1: Double, _ value: Double) -> Double {
    let x = clamp((value - edge0) / (edge1 - edge0))
    return x * x * (3 - 2 * x)
}

func quadratic(_ p0: CGPoint, _ p1: CGPoint, _ p2: CGPoint, _ t: CGFloat) -> CGPoint {
    let oneMinusT = 1 - t
    return CGPoint(
        x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
        y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y
    )
}

func deterministicNoise(_ index: Int) -> CGFloat {
    let value = sin(Double(index) * 12.9898 + 78.233) * 43758.5453
    return CGFloat(value - floor(value))
}

func drawPhrase(
    _ phrase: String,
    center: CGPoint,
    font: NSFont,
    alpha: CGFloat,
    scaleX: CGFloat = 1.0
) {
    guard alpha > 0.01 else { return }
    let shadow = NSShadow()
    shadow.shadowColor = gold.withAlphaComponent(alpha * 0.90)
    shadow.shadowBlurRadius = font.pointSize * 0.60
    shadow.shadowOffset = .zero

    let attributes: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: paleGold.withAlphaComponent(alpha),
        .shadow: shadow,
        .ligature: 1,
        .kern: 0.2
    ]
    let attributed = NSAttributedString(string: phrase, attributes: attributes)
    let size = attributed.size()

    NSGraphicsContext.current?.cgContext.saveGState()
    NSGraphicsContext.current?.cgContext.translateBy(x: center.x, y: center.y)
    NSGraphicsContext.current?.cgContext.scaleBy(x: scaleX, y: 1)
    attributed.draw(at: CGPoint(x: -size.width / 2, y: -size.height / 2))
    NSGraphicsContext.current?.cgContext.restoreGState()
}

func drawGlowLine(from start: CGPoint, to end: CGPoint, alpha: CGFloat, width: CGFloat) {
    guard let context = NSGraphicsContext.current?.cgContext, alpha > 0.01 else { return }
    context.saveGState()
    context.setLineCap(.round)
    context.setShadow(offset: .zero, blur: width * 2.2, color: gold.withAlphaComponent(alpha * 0.90).cgColor)
    context.setStrokeColor(gold.withAlphaComponent(alpha * 0.34).cgColor)
    context.setLineWidth(width)
    context.move(to: start)
    context.addLine(to: end)
    context.strokePath()
    context.restoreGState()
}

func drawDust(stream: Int, head: CGPoint, progress: Double, alpha: CGFloat, dense: Bool) {
    guard let context = NSGraphicsContext.current?.cgContext else { return }
    let amount = dense ? 34 : 18
    for particle in 0..<amount {
        let key = stream * 1000 + particle * 17
        let phase = CGFloat((Double(particle) / Double(amount) + progress * 1.55).truncatingRemainder(dividingBy: 1))
        let jitterX = (deterministicNoise(key) - 0.5) * (dense ? 66 : 34)
        let driftY = phase * (dense ? 115 : 64)
        let radius = 0.8 + deterministicNoise(key + 3) * (dense ? 2.7 : 1.8)
        let particleAlpha = alpha * (1 - phase) * (0.28 + deterministicNoise(key + 5) * 0.58)
        let rect = CGRect(
            x: head.x + jitterX - radius,
            y: head.y - driftY - radius,
            width: radius * 2,
            height: radius * 2
        )
        context.setFillColor(paleGold.withAlphaComponent(particleAlpha).cgColor)
        context.fillEllipse(in: rect)
    }
}

for frame in 0..<frameCount {
    autoreleasepool {
        let localTime = Double(frame) / fps
        let sourceTime = overlayStart + localTime
        let globalFadeIn = smoothstep(4.08, 4.55, sourceTime)
        let globalFadeOut = 1 - smoothstep(9.55, 10.05, sourceTime)
        let globalAlpha = CGFloat(globalFadeIn * globalFadeOut)

        guard let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: canvasWidth,
            pixelsHigh: canvasHeight,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ), let graphics = NSGraphicsContext(bitmapImageRep: bitmap) else {
            fatalError("Cannot allocate frame")
        }

        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = graphics
        let context = graphics.cgContext
        context.clear(CGRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight))
        context.setBlendMode(.screen)

        if sourceTime < 6.88 {
            // Wide shot: five streams fan evenly from the open Quran to all five stone letters.
            let travel = smoothstep(4.30, 6.55, sourceTime)
            for stream in 0..<5 {
                let start = CGPoint(x: 900 + CGFloat(stream) * 22, y: 725)
                let end = CGPoint(x: wideTargets[stream], y: 560)
                let control = CGPoint(x: (start.x + end.x) / 2, y: 640 + abs(end.x - start.x) * 0.08)
                let head = quadratic(start, control, end, CGFloat(travel))
                let streamAlpha = globalAlpha * (0.78 + CGFloat(stream == 2 ? 0.22 : 0.08))
                drawGlowLine(from: start, to: head, alpha: streamAlpha, width: stream == 2 ? 6.2 : 5.2)

                for token in 0..<5 {
                    let tokenT = max(0, CGFloat(travel) - CGFloat(token) * 0.13)
                    let point = quadratic(start, control, end, tokenT)
                    let tokenAlpha = streamAlpha * max(0.18, 1 - CGFloat(token) * 0.16)
                    drawPhrase(phrases[stream], center: point, font: fontWide, alpha: tokenAlpha, scaleX: 0.78)
                }
                drawDust(stream: stream, head: head, progress: travel, alpha: streamAlpha, dense: false)
            }
        } else {
            // Close shot: every stream remains visible and continues down through its own letter.
            let depth = smoothstep(6.88, 9.58, sourceTime)
            let topY: CGFloat = 1015
            let bottomY: CGFloat = 285
            let headY = topY + (bottomY - topY) * CGFloat(depth)

            for stream in 0..<5 {
                let x = closeTargets[stream]
                let streamAlpha = globalAlpha * (stream == 2 ? 1.0 : 0.88)
                drawGlowLine(
                    from: CGPoint(x: x, y: topY),
                    to: CGPoint(x: x, y: headY),
                    alpha: streamAlpha,
                    width: stream == 2 ? 7.2 : 6.0
                )

                let spacing: CGFloat = 82
                var y = topY - CGFloat((sourceTime * 86).truncatingRemainder(dividingBy: Double(spacing)))
                var token = 0
                while y > headY - 10 {
                    let distance = max(0, (y - headY) / max(1, topY - headY))
                    let tokenAlpha = streamAlpha * (0.38 + 0.62 * distance)
                    drawPhrase(
                        phrases[stream],
                        center: CGPoint(x: x, y: y),
                        font: fontClose,
                        alpha: tokenAlpha,
                        scaleX: stream == 2 ? 0.76 : 0.70
                    )
                    y -= spacing
                    token += 1
                    if token > 14 { break }
                }
                drawDust(stream: stream, head: CGPoint(x: x, y: headY), progress: depth, alpha: streamAlpha, dense: true)
            }
        }

        NSGraphicsContext.restoreGraphicsState()
        guard let png = bitmap.representation(using: .png, properties: [:]) else {
            fatalError("Cannot encode PNG")
        }
        let destination = outputDirectory.appendingPathComponent(String(format: "ayat-%04d.png", frame))
        try! png.write(to: destination)
    }
}

print("Rendered \(frameCount) overlay frames to \(outputDirectory.path)")
