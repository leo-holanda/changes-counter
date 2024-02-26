# Change Log

All notable changes to the "changes-counter" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Waiting for users feedback so I can improve the extesion.

## [1.5.5] - 2024-02-26

### Changed

- Improve styles for insertions and deletions data on status bar item

## [1.5.4] - 2024-02-23

### Added

- Add number sign control and spacing between data in status bar item

## [1.5.3] - 2024-02-22

### Added

- Toggable insertions and deletions data on status bar item

## [1.5.2] - 2023-11-29

### Changed

- Replace image with demo video in readme
- Add "Built with" section in readme

## [1.5.1] - 2023-11-13

### Changed

- Add chunk accumulators in all functions from git service
- Improve code consistency

### Fixed

- Fix some log messages

## [1.5.0] - 2023-11-08

### Added

- Add default comparison branch which is the current branch
- Add default changes threshold which is 400

### Fixed

- Fix bug where the set comparison branch quickpick wouldn't show all branches

### Changed

- Switched the project programming approach to OOP
- Added a new Usage section to README

## [1.4.0] - 2023-05-12

### Added

- Add ignore file

## [1.3.0] - 2023-05-11

### Changed

- Improve output channel messages

## [1.2.2] - 2023-05-10

### Fixed

- Fix spawn child process bug when OS is Windows

## [1.2.1] - 2023-05-09

### Fixed

- Fix 0 changes bug when changes actually exist

## [1.2.0] - 2023-04-26

### Added

- Add error messages in output channel

## [1.1.0] - 2023-04-11

### Added

- Extension logo in VS Code Marketplace

## [1.0.0] - 2023-03-30

### Added

- A status bar item that shows the changes count
- A color change behavior for the status bar item that triggers when the changes quantity exceed the defined changes threshold
- A tooltip to the status bar item that shows more data about the changes, the current comparison branch and the changes threshold as well as links to change both of it
- Warning notifications when the changes quantity exceed the defined changes threshold
