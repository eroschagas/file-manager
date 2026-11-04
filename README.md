# File Manager

A local desktop app built with Vue 3, TypeScript, and Electron to find duplicate or visually similar photos and videos, including versions with different resolutions and compression levels.

## Development

Requires Node.js 22.12 or later (Node 22 LTS recommended) and npm.

```sh
npm install
npm run dev
```

This starts Vite and opens the Electron window. Vue changes appear through hot reload. Press **Ctrl + Shift + I** to open DevTools during development. Opening the Vite URL in a regular browser does not provide access to desktop file operations.

1. Enter a folder path or use **Browse folders** to select multiple folders. Use **Add folder** to add paths manually and the remove button to remove an entry.
2. Choose **Similarity**: Strict, Balanced (default), or Flexible. Flexible finds more candidates and requires careful review. Click **Scan files** to compare files across all selected folders and their subfolders. Symbolic links and junctions are skipped. Repeated or overlapping folders are scanned once. Empty fields are ignored; invalid paths prevent the scan from starting.
3. Select a group to compare versions, resolutions, and sizes. Cards use independent thumbnails. Click an image to enlarge it or a video thumbnail to play it when Chromium supports the codec. Selecting a file for the Recycle Bin does not open the original.
4. Files appear from largest to smallest in bytes, with the smallest file in each group selected initially. Each checkbox is independent, and every file in a group may be selected. Review the selection before confirming; the confirmation identifies groups where all files will be moved. Each group in the left panel shows a pill with its current selection count.

The header stays visible. The group list and file comparison have independent scroll areas, and the selection bar remains available at the bottom.

During the current app session, the folder picker remembers the parent of the last selected folder. For multiple folders, it opens their nearest common ancestor; across different drives, it uses the parent of the last folder. Returning from results clears the inputs and leaves one empty field while preserving the picker location.

Scanning does not modify files. Unreadable, damaged, or unsupported files are reported at the end. A failed Recycle Bin operation never falls back to permanent deletion.

## How comparison works

- SHA-256 detects byte-identical copies among successfully decoded media files.
- Photos are normalized for orientation, converted to grayscale, and compared using a 63-bit DCT perceptual hash. Maximum distance is four bits in Strict mode, seven in Balanced, and twelve in Flexible. Aspect ratios must also match within tolerance. The same thresholds apply to video frames.
- FFprobe reads video metadata. FFmpeg extracts frames at 10%, 30%, 50%, 70%, and 90% of the duration. Matching requires similar durations, at least four similar frames, and an average distance within the threshold.
- A hash segment index reduces unnecessary comparisons. Each group compares its members directly against a reference to avoid chaining progressively different files.
- Nearly uniform images and frames participate only in exact matching to reduce false positives.

Similarity is a suggestion for review, not proof of equivalence. Burst photos may be grouped together. Significant crops, mirroring, heavy edits, or trimmed videos may not match. Video analysis compares visual content, **not audio**. Higher resolution does not guarantee higher quality.

Candidate image extensions: JPG, JPEG, PNG, WebP, AVIF, TIFF, GIF, HEIC, and HEIF. HEIC/HEIF and some codecs depend on the installed Sharp/FFmpeg distribution; decoding failures are reported. GIFs are compared by their first frame. Video extensions: MP4, MOV, MKV, AVI, WebM, M4V, MTS, and M2TS. Playback support is more limited than analysis support; use **Show in folder** when needed.

Scans are not persisted: each run recalculates signatures. Temporary thumbnails are created outside the scanned folders. Scanning runs in a separate worker thread and can be canceled. Media files are processed one at a time to control memory use and load.

Images are read into buffers and closed before Sharp processes them, preventing the native image cache from retaining original file handles. Enlarged images are also served from completed reads rather than persistent JPEG streams. Video streams are released before moving files to the Recycle Bin.

## Commands

```sh
npm run typecheck
npm test
npm run test:desktop
npm run build
npm run pack
npm run dist:win
```

`pack` generates the application directory in `release/`; `dist:win` generates the Windows installer. Node and the FFmpeg/FFprobe binaries are included. Build on the target operating system and architecture to include the corresponding binaries. The initial installer has no signing certificate.

`test:desktop` opens a real Electron window and tests the complete workflow with temporary generated files. It checks Recycle Bin cancellation, simulates a Windows failure followed by a retry, and moves a temporary image and a playing video to the Recycle Bin. It does not use personal folders. Screenshots are saved in `.test-output/`.

## Structure

- `src/main`: window, local operations, scanning, and comparison.
- `src/preload`: bridge exposing specific operations to the interface.
- `src/renderer/src/App.vue`: application shell, screen composition, and lifecycle wiring.
- `src/renderer/src/views`: folder selection, scan progress, and review screens.
- `src/renderer/src/components`: reusable SFCs organized into `layout`, `setup`, `review`, and `ui`; `MediaCard.vue` owns media playback and its preview lifecycle.
- `src/renderer/src/models`: `FolderSelection`, `ScanSession`, and `ReviewSession` classes own reactive state and domain operations.
- `src/renderer/src/controllers`: `FileManagerController` coordinates the models, navigation, messages, and the injected desktop API.
- `src/renderer/src/styles`: global tokens and reset only; each component owns its scoped SCSS, including its responsive rules.
- `src/shared`: TypeScript contracts between processes.
- `tests`: perceptual comparison and real scanning with generated photos and videos.

The renderer uses context isolation and sandboxing without direct Node access. Preview and Recycle Bin operations are restricted to files from the current scan. File size and modification time are checked before moving files, and a native confirmation dialog is required.

The front end uses composition between TypeScript classes and Vue's Composition API. Models keep reactive state internally so class methods remain reactive without proxying the class instances. Views render models and emit user actions; only the controller calls the desktop bridge. Its subscription is disposed when the app component unmounts. DOM-specific behavior, such as dialogs and video cleanup, stays inside the owning SFC.

## Distribution and licenses

There is no per-file analysis fee. Before public distribution, include third-party notices and licenses and check the obligations of the included FFmpeg/FFprobe binaries. The `ffmpeg-static` distribution may include GPL components; do not assume every FFmpeg build is LGPL. See [FFmpeg](https://ffmpeg.org/legal.html), [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static), and [ffprobe-static](https://github.com/joshwnj/ffprobe-static).
