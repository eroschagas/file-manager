# Installers

This directory stores generated distribution files locally. Installers are uploaded to GitHub Releases for direct downloads from the [main README](../README.md#download). The binary files are excluded from Git because they exceed GitHub's normal repository file limit.

| System          | Generated file                       | Build command        |
| --------------- | ------------------------------------ | -------------------- |
| Windows x64     | `File-Manager-Windows-x64-Setup.exe` | `npm run dist:win`   |
| macOS Intel x64 | `File-Manager-macOS-x64.dmg`         | `npm run dist:mac`   |
| Linux x64       | `File-Manager-Linux-x64.AppImage`    | `npm run dist:linux` |

Each command also creates a matching `.sha256` checksum file here. Intermediate application bundles remain in `release/`. Build each package on its matching x64 operating system so the bundled FFmpeg, FFprobe, and Sharp match the target.

The [release workflow](../.github/workflows/release.yml) builds all three systems on native GitHub runners. A manual workflow run stores downloadable build artifacts without publishing a release. A pushed `v*` tag publishes a release only after every installer has been built, tested, and verified.

Local builds do not upload anything. The macOS and Linux files appear here only when built on their platforms or downloaded from a completed workflow.
