# File Manager

A local desktop app built with Vue 3, TypeScript, and Electron to find duplicate or visually similar photos and videos and organize files into date folders.

## Download

| Operating system | Architecture | Direct download                                                                                                                               |
| ---------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows          | x64          | [Download Windows installer (.exe)](https://github.com/eroschagas/file-manager/releases/latest/download/File-Manager-Windows-x64-Setup.exe)   |
| macOS            | Intel x64    | [Download macOS disk image (.dmg)](https://github.com/eroschagas/file-manager/releases/latest/download/File-Manager-macOS-x64.dmg)            |
| Linux            | x64          | [Download Linux application (.AppImage)](https://github.com/eroschagas/file-manager/releases/latest/download/File-Manager-Linux-x64.AppImage) |

[All versions and SHA-256 checksums](https://github.com/eroschagas/file-manager/releases).

These direct links serve assets from the latest published GitHub release. They become available after the release workflow successfully builds and publishes all three packages. Generating installers locally does not publish the downloads.

The macOS package is an Intel build; Apple Silicon Macs require [Rosetta 2](https://support.apple.com/en-us/102527). Native ARM64 packages are not provided by this release configuration. The initial Windows and macOS packages are unsigned, and the macOS package is not notarized.

### Install

- **Windows:** open the `.exe`, follow the setup wizard, and choose the installation directory. The app includes its runtime; Node.js is not required.
- **macOS:** open the `.dmg` and drag **File Manager** into **Applications**. The unsigned app may be blocked by macOS security settings.
- **Linux:** download the AppImage, make it executable, and launch it in a desktop Linux environment with AppImage/FUSE support. AppImage is a standalone application rather than a `.deb` or `.rpm` installer:

  ```sh
  chmod +x File-Manager-Linux-x64.AppImage
  ./File-Manager-Linux-x64.AppImage
  ```

Generated installers and matching `.sha256` files are collected locally in [installers/](installers/README.md). Large binaries are distributed as GitHub Release assets rather than committed into the repository. See [Building and publishing releases](#building-and-publishing-releases).

## Features

- **Duplicates:** recursively compare photos and videos across multiple folders, including resized/recompressed versions; review match groups and move chosen files to the system Recycle Bin/Trash.
- **File organizer:** preview and move files into numbered year/month folders using capture metadata, with file modification dates as the fallback.
- **Local processing:** no file upload, cloud account, or per-file analysis charge. Both tools provide progress, cancellation, confirmations before moving files, and error reporting.
- **Review controls:** filter by media type, navigate with Prev/Next, select full groups, preview originals independently of selection, and reveal files in their folders.

## Duplicates

The header offers **Duplicates** and **File organizer** tabs. In **Duplicates**:

1. Enter a folder path or use **Browse folders** to select multiple folders. Use **Add folder** to add paths manually and the remove button to remove an entry.
2. Choose **Similarity**: Strict, Balanced (default), Flexible, or Broad. Broad allows larger visual and framing differences than Flexible for photos and videos, but can miss angle changes, group unrelated files, and take longer to scan. Review every file before deleting. Click **Scan files** to compare files across all selected folders and their subfolders. Symbolic links and junctions are skipped. Repeated or overlapping folders are scanned once. Empty fields are ignored; invalid paths prevent the scan from starting.
3. Select a group to compare versions, resolutions, and sizes. Cards use independent thumbnails. Click anywhere on a card, including its thumbnail, to toggle its Recycle Bin selection. Use the magnifier button to enlarge an image or the play button to play a video when Chromium supports the codec. Preview buttons, video controls, and **Show in folder** do not change the selection. The checkbox remains available for keyboard selection. Selecting a file for the Recycle Bin does not open the original.
4. Files appear from largest to smallest in bytes. Every file is selected initially except the one with the highest resolution; ties keep the largest file in bytes. This estimates which version to keep, so review its actual quality. Each checkbox is independent, and every file in a group may be selected. The group button shows **Deselect all** while any file in that group is selected and **Select all** when none are selected; other groups retain their selections. Review the selection before confirming; the confirmation identifies groups where all files will be moved. Each group in the left panel shows a pill with its current selection count.

The header stays visible. The group list and file comparison have independent scroll areas, and the selection bar remains available at the bottom.

The overview shows scanned files, similar groups, and estimated space used by extra copies if one version is kept per group. Use **All**, **Photos**, and **Videos** to filter groups. **Prev** and **Next** navigate the filtered groups while preserving selections; the counter shows the current position. These controls stay visible during comparison scrolling and are disabled at the first/last group and during deletion.

Cards show filenames, paths, dimensions, file sizes, and video duration when available. The highest-resolution version receives a badge for non-exact matches. The bottom bar shows the selected count and total size. **Clear selection** resets selections across all groups; **Deselect all**/**Select all** affect only the open group. Checkboxes remain accessible for keyboard selection.

Click **Move to Recycle Bin** to review a native confirmation before removing files. A partial failure reports paths and retains failed selections so you can review or retry them. Successful moves update groups and counts. Original paths, sizes, and modification times are checked again before moving files.

During the current app session, the folder picker remembers the parent of the last selected folder. For multiple folders, it opens their nearest common ancestor; across different drives, it uses the parent of the last folder. Returning from results clears the inputs and leaves one empty field while preserving the picker location.

Scanning does not modify files. Unreadable, damaged, or unsupported files are reported at the end. A failed Recycle Bin operation never falls back to permanent deletion.

## File organizer

1. Open **File organizer**, enter a folder path or click **Browse**. The picker remembers the parent of its previous selection during the session.
2. Click **Preview organization**. The app reads all regular files recursively, including non-media files, and displays their destination folders without modifying the folder.
3. Click **Organize files** and confirm the native dialog. Files move into `YYYY/MM - Mon` folders inside the selected folder, for example `2026/11 - Nov/photo.jpg`. Months use `01 - Jan` through `12 - Dec`. A new preview of the original root also migrates files from older month folders into this format; pre-existing empty folders remain untouched.

Photos use capture metadata (EXIF/XMP, prioritizing `DateTimeOriginal`); videos use recording metadata from the container or video track, prioritizing camera-specific recording dates over generic `creation_time`. The year and month recorded in the metadata are preserved without shifting them to the computer's timezone. Missing, invalid, unsupported, or unreadable metadata falls back to the file's modification timestamp (`mtimeMs`), interpreted in the computer's local timezone. Other files also use their modification date. File-system creation time is never used to choose the destination. If neither date is valid, files go into **Unknown Date**.

Only destination folders needed for files are created. Newly created folders that remain empty after a failure or cancellation are removed; pre-existing folders, including emptied source folders, are left untouched. Already organized files stay in place. Repeated names receive suffixes such as `photo (2).jpg`; existing files are never overwritten, including conflicts that appear after the preview.

Source identity, size, creation time, and modification time are checked again before moving. Junctions and symbolic links are skipped. Failures are reported with their file paths and other files continue. Cancellation stops between files and retains completed moves. Moves preserve file timestamps and embedded metadata. Selecting the original root again also corrects files organized into the wrong date folders by an earlier version. A successful move clears the previous duplicate scan because its paths may have changed.

Tabs are disabled during active operations. All operations run locally; no upload or external service is involved.

## How comparison works

- SHA-256 detects byte-identical copies among successfully decoded media files.
- Photos are normalized for orientation, converted to grayscale, and compared using a 63-bit DCT perceptual hash. Maximum distance is four bits in Strict mode, seven in Balanced, twelve in Flexible, and fourteen in Broad. Relative aspect-ratio tolerance is 8% for the first three modes and 10% for Broad. The same thresholds apply to video frames. Broad retains duration checks, the four-frame requirement, anchor-based grouping, and uniform-frame safeguards.
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
npm run dist:mac
npm run dist:linux
npm run verify:media
npm run verify:release
```

`pack` generates the unpacked application directory in `release/`. The three `dist:*` commands build x64 distribution packages on their matching operating systems and copy the final package/checksum into `installers/`. Windows uses an NSIS setup executable; macOS uses a DMG; Linux uses an AppImage. Node and the FFmpeg/FFprobe binaries are included. `verify:media` checks that those binaries execute on the current platform; `verify:release` checks all three collected packages against their SHA-256 checksums.

`test:desktop` opens a real Electron window and tests the complete workflow with temporary generated files. It checks Recycle Bin cancellation, simulates a Windows failure followed by a retry, and moves a temporary image and a playing video to the Recycle Bin. It does not use personal folders. Screenshots are saved in `.test-output/`.

## Development

Requires Node.js 22.12 or later and npm. Node 22 is used by the release workflow.

```sh
npm ci
npm run dev
```

This starts Vite and opens the Electron window. Vue changes appear through hot reload. Press **Ctrl + Shift + I** to open DevTools during development. Opening the Vite URL in a regular browser does not provide the Electron bridge for local file operations.

## Building and publishing releases

The build configuration is in [electron-builder.yml](electron-builder.yml). Build each target on its matching x64 operating system so Sharp, FFmpeg, and FFprobe match that target. Intermediate application bundles stay in `release/`; final packages and `.sha256` files are collected in [installers/](installers/README.md).

Installer binaries are ignored by Git. [GitHub limits ordinary repository files to 100 MiB](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github); the Windows package is larger, so downloads are attached to **Releases**, rather than stored as repository blobs.

The [Build installers workflow](.github/workflows/release.yml) runs on native Windows, Intel macOS, and Linux runners:

1. Install dependencies with `npm ci`, run unit tests, and check that a release tag matches `package.json`.
2. Type-check/build the app, execute the native media binaries, and package each target.
3. Upload installers/checksums as workflow artifacts, retained for 14 days.
4. For a pushed `v*` tag, collect and verify all three packages, create a draft release, upload all assets, and publish it as the latest release. If any platform fails, publication does not run.

**To test without publishing:** push the workflow changes, open **Actions → Build installers → Run workflow**, and download the resulting artifacts. Manual runs do not publish a release.

**To publish:** commit and push the intended source/configuration first, ensure `package.json` and `package-lock.json` contain the same version, and create/push the matching tag. For the current version:

```sh
git tag v0.1.0
git push origin v0.1.0
```

For later releases, update the version and use a new matching tag. Existing releases are not overwritten. Publication uses the workflow's built-in GitHub token with `contents: write`; no personal token is stored in the repository. Stable asset filenames keep the README's `/releases/latest/download/...` links pointing to the latest published version.

The Windows installer can be generated in this Windows workspace. macOS/Linux installers and public download links require their native workflow builds and release publication; a Windows-only local build does not produce them.

## Structure

- `src/main`: window, local operations, scanning, and comparison; `organizer` contains `FileOrganizer`, `MediaDateReader`, `SafeFileMover`, and `OrganizerIpc`.
- `src/preload`: bridge exposing specific operations to the interface.
- `src/renderer/src/App.vue`: application shell, screen composition, and lifecycle wiring.
- `src/renderer/src/views`: folder selection, scan progress, review, and organizer screens.
- `src/renderer/src/components`: reusable SFCs organized into `layout`, `setup`, `review`, `organizer`, and `ui`; `MediaCard.vue` owns media playback and its preview lifecycle.
- `src/renderer/src/models`: `FolderSelection`, `ScanSession`, `ReviewSession`, and `OrganizerSession` classes own reactive state and domain operations.
- `src/renderer/src/controllers`: `FileManagerController` and `OrganizerController` coordinate models, navigation, messages, and the injected desktop API.
- `src/renderer/src/styles`: global tokens and reset only; each component owns its scoped SCSS, including its responsive rules.
- `src/shared`: TypeScript contracts between processes.
- `tests`: perceptual comparison and real scanning with generated photos and videos.
- `scripts`: native media checks, installer collection, and release checksum verification.
- `installers`: generated distribution packages locally; only its documentation is tracked in Git.
- `.github/workflows/release.yml`: native builds and GitHub Release publication.

The renderer uses context isolation and sandboxing without direct Node access. Preview and Recycle Bin operations are restricted to files from the current scan. File size and modification time are checked before moving files, and a native confirmation dialog is required.

The front end uses composition between TypeScript classes and Vue's Composition API. Models keep reactive state internally so class methods remain reactive without proxying the class instances. Views render models and emit user actions; only the controller calls the desktop bridge. Its subscription is disposed when the app component unmounts. DOM-specific behavior, such as dialogs and video cleanup, stays inside the owning SFC.

## Distribution and licenses

There is no per-file analysis fee. Before public distribution, include third-party notices and licenses and check the obligations of the included FFmpeg/FFprobe binaries. The `ffmpeg-static` distribution may include GPL components; do not assume every FFmpeg build is LGPL. See [FFmpeg](https://ffmpeg.org/legal.html), [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static), and [ffprobe-static](https://github.com/joshwnj/ffprobe-static).
