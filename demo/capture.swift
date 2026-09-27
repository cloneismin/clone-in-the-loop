import AVFoundation
import AppKit
import CoreGraphics
import Foundation
import ScreenCaptureKit

final class ChromeWindowRecorder: NSObject, SCStreamOutput {
    let writer: AVAssetWriter
    let auditURL: URL
    let width: Int
    let height: Int
    let input: AVAssetWriterInput
    let adaptor: AVAssetWriterInputPixelBufferAdaptor
    let queue = DispatchQueue(label: "clone.demo.chrome-capture")
    var timer: DispatchSourceTimer?
    var latestFrame: CVPixelBuffer?
    var startedAt: Date?
    var startedUptime: TimeInterval?
    var lastTimestamp = CMTime.invalid
    var observedDimensions: [[Int]] = []
    var failure: Error?
    var frames = 0
    var dropped = 0
    var statusCounts: [Int: Int] = [:]

    init(output: URL, width: Int, height: Int) throws {
        self.width = width
        self.height = height
        auditURL = URL(fileURLWithPath: output.path + ".audit.json")
        writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
        input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 16_000_000, AVVideoMaxKeyFrameIntervalKey: 60, AVVideoAllowFrameReorderingKey: false]
        ])
        input.expectsMediaDataInRealTime = true
        adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height
        ])
        super.init()
        writer.add(input)
        writer.movieFragmentInterval = CMTime(seconds: 2, preferredTimescale: 600)
    }

    func copyFrame(_ source: CVPixelBuffer) -> CVPixelBuffer? {
        var target: CVPixelBuffer?
        let width = CVPixelBufferGetWidth(source)
        let height = CVPixelBufferGetHeight(source)
        if observedDimensions.last != [width, height] { observedDimensions.append([width, height]); writeAudit() }
        guard width == self.width, height == self.height else {
            failure = NSError(domain: "CloneCapture", code: 9, userInfo: [NSLocalizedDescriptionKey: "Capture pixels changed from \(self.width)x\(self.height) to \(width)x\(height). Reframe and start a fresh take."])
            writeAudit()
            return nil
        }
        guard CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA, [kCVPixelBufferIOSurfacePropertiesKey: [:]] as CFDictionary, &target) == kCVReturnSuccess, let target else { return nil }
        CVPixelBufferLockBaseAddress(source, .readOnly)
        CVPixelBufferLockBaseAddress(target, [])
        defer {
            CVPixelBufferUnlockBaseAddress(target, [])
            CVPixelBufferUnlockBaseAddress(source, .readOnly)
        }
        guard let from = CVPixelBufferGetBaseAddress(source), let to = CVPixelBufferGetBaseAddress(target) else { return nil }
        let sourceStride = CVPixelBufferGetBytesPerRow(source)
        let targetStride = CVPixelBufferGetBytesPerRow(target)
        for row in 0..<height {
            memcpy(to.advanced(by: row * targetStride), from.advanced(by: row * sourceStride), width * 4)
        }
        return target
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen,
              let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
              let status = attachments.first?[.status] as? Int else { return }
        statusCounts[status, default: 0] += 1
        if status == SCFrameStatus.blank.rawValue || status == SCFrameStatus.suspended.rawValue {
            failure = NSError(domain: "CloneCapture", code: 7, userInfo: [NSLocalizedDescriptionKey: "Chrome capture became blank or suspended; discard this interrupted take."])
            return
        }
        guard status == SCFrameStatus.complete.rawValue,
              let image = CMSampleBufferGetImageBuffer(sampleBuffer),
              let frame = copyFrame(image) else { return }
        latestFrame = frame
        if startedAt == nil {
            guard writer.startWriting() else { failure = writer.error; return }
            writer.startSession(atSourceTime: .zero)
            startedAt = Date()
            startedUptime = ProcessInfo.processInfo.systemUptime
            let clock = DispatchSource.makeTimerSource(queue: queue)
            clock.schedule(deadline: .now(), repeating: .nanoseconds(33_333_333), leeway: .milliseconds(1))
            clock.setEventHandler { [weak self] in self?.appendFrame() }
            timer = clock
            clock.resume()
        }
    }

    func appendFrame() {
        guard failure == nil, let image = latestFrame, let start = startedUptime else { return }
        guard input.isReadyForMoreMediaData else { dropped += 1; return }
        let timestamp = CMTime(seconds: ProcessInfo.processInfo.systemUptime - start, preferredTimescale: 60_000)
        if lastTimestamp.isValid && CMTimeCompare(timestamp, lastTimestamp) <= 0 { return }
        if adaptor.append(image, withPresentationTime: timestamp) {
            frames += 1
            lastTimestamp = timestamp
            if frames % 30 == 0 { writeAudit() }
        } else {
            failure = writer.error
            writeAudit()
        }
    }

    func writeAudit() {
        var values: [String: Any] = ["frames": frames, "droppedFrames": dropped, "configuredWidth": width, "configuredHeight": height, "observedDimensions": observedDimensions, "writerStatus": writer.status.rawValue, "lastTimestamp": lastTimestamp.isValid ? CMTimeGetSeconds(lastTimestamp) : 0, "statusCounts": statusCounts.map { ["status": $0.key, "count": $0.value] }]
        if let failure { values["error"] = failure.localizedDescription }
        if let startedAt { values["startedAt"] = ISO8601DateFormatter().string(from: startedAt) }
        if let data = try? JSONSerialization.data(withJSONObject: values, options: [.prettyPrinted, .sortedKeys]) {
            try? data.write(to: auditURL, options: .atomic)
        }
    }

    func hasFailed() -> Bool {
        queue.sync { failure != nil }
    }

    func finish() async throws {
        queue.sync {
            timer?.cancel()
            timer = nil
            appendFrame()
            input.markAsFinished()
            writeAudit()
        }
        if let failure { throw failure }
        guard frames > 1 else { throw NSError(domain: "CloneCapture", code: 8, userInfo: [NSLocalizedDescriptionKey: "No complete Chrome frames were recorded."]) }
        await writer.finishWriting()
        queue.sync { writeAudit() }
        if let error = writer.error { failure = error; writeAudit(); throw error }
    }
}

@main
struct Capture {
    @MainActor
    static func main() async throws {
        _ = NSApplication.shared
        let arguments = Array(CommandLine.arguments.dropFirst())
        func value(_ flag: String) -> String? {
            guard let index = arguments.firstIndex(of: flag), index + 1 < arguments.count else { return nil }
            return arguments[index + 1]
        }
        guard arguments.contains("--list") || (value("--window") != nil && value("--output") != nil) else {
            print("Requires explicit user authorization for Chrome-window-only ScreenCaptureKit capture.")
            print("Usage after authorization: capture --list | --window WINDOW_ID --output PATH --seconds 600")
            return
        }
        guard CGPreflightScreenCaptureAccess() else {
            throw NSError(domain: "CloneCapture", code: 2, userInfo: [NSLocalizedDescriptionKey: "Screen Recording permission is not available for this terminal."])
        }
        let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: false)
        let chromeWindows = content.windows.filter { $0.owningApplication?.bundleIdentifier == "com.google.Chrome" }
        if arguments.contains("--list") {
            let windows = chromeWindows.map { window -> [String: Any] in
                ["windowId": window.windowID, "app": "Google Chrome", "title": window.title ?? "", "width": window.frame.width, "height": window.frame.height]
            }
            print(String(data: try JSONSerialization.data(withJSONObject: windows, options: [.prettyPrinted, .sortedKeys]), encoding: .utf8)!)
            return
        }
        guard let id = UInt32(value("--window")!), let window = chromeWindows.first(where: { $0.windowID == id }) else {
            throw NSError(domain: "CloneCapture", code: 3, userInfo: [NSLocalizedDescriptionKey: "The selected window is not an available Google Chrome window."])
        }
        let output = URL(fileURLWithPath: value("--output")!).standardizedFileURL
        guard !FileManager.default.fileExists(atPath: output.path) else {
            throw NSError(domain: "CloneCapture", code: 4, userInfo: [NSLocalizedDescriptionKey: "Output already exists. Choose a fresh capture filename."])
        }
        try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
        let filter = SCContentFilter(desktopIndependentWindow: window)
        let config = SCStreamConfiguration()
        config.width = Int(window.frame.width * Double(filter.pointPixelScale)) / 2 * 2
        config.height = Int(window.frame.height * Double(filter.pointPixelScale)) / 2 * 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: 30)
        config.queueDepth = 6
        config.showsCursor = true
        config.scalesToFit = true
        config.preservesAspectRatio = true
        config.ignoreShadowsSingleWindow = true
        config.ignoreGlobalClipSingleWindow = true
        config.capturesAudio = false
        config.pixelFormat = kCVPixelFormatType_32BGRA
        let recorder = try ChromeWindowRecorder(output: output, width: config.width, height: config.height)
        let stream = SCStream(filter: filter, configuration: config, delegate: nil)
        try stream.addStreamOutput(recorder, type: .screen, sampleHandlerQueue: recorder.queue)
        let startedAt = Date()
        try await stream.startCapture()
        print("Recording only the selected Chrome window. Create \(output.path).stop to finish.")
        fflush(stdout)
        let duration = min(3600, max(1, Double(value("--seconds") ?? "600") ?? 600))
        while Date().timeIntervalSince(startedAt) < duration && !FileManager.default.fileExists(atPath: output.path + ".stop") && !recorder.hasFailed() {
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        try await stream.stopCapture()
        try await recorder.finish()
        let asset = AVURLAsset(url: output)
        let mediaDuration = CMTimeGetSeconds(try await asset.load(.duration))
        let wallDuration = Date().timeIntervalSince(startedAt)
        guard mediaDuration >= max(1, wallDuration - 1) else {
            throw NSError(domain: "CloneCapture", code: 6, userInfo: [NSLocalizedDescriptionKey: "Recorded media is shorter than capture time; do not use the incomplete take."])
        }
        let metadata: [String: Any] = ["method": "ScreenCaptureKit selected Chrome window only", "startedAt": ISO8601DateFormatter().string(from: startedAt), "windowId": id, "bundleIdentifier": "com.google.Chrome", "width": config.width, "height": config.height, "maximumFPS": 30, "frames": recorder.frames, "droppedFrames": recorder.dropped, "statusCounts": recorder.statusCounts.map { ["status": $0.key, "count": $0.value] }, "idleFrames": "last observed Chrome pixels retained at 30 fps while ScreenCaptureKit reports unchanged content", "durationWallSeconds": wallDuration, "mediaDuration": mediaDuration, "finalized": true]
        try JSONSerialization.data(withJSONObject: metadata, options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output.path + ".capture.json"))
        print("Capture finalized: \(output.path)")
    }
}
