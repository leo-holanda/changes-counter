# Changes Counter

![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/LeonardoHolanda.changes-counter?color=%230066b8&label=VS%20Code%20Marketplace&style=flat-square)
![GitHub](https://img.shields.io/github/license/leo-holanda/changes-counter?color=%230066b8&style=flat-square)

> A VS Code extension that counts the number of changes between your git working tree and a comparison branch. Also, it warns you when you exceed a changes quantity threshold, helping you control the size of your pull requests and making them more easy to review.

![Changes Counter screenshot](https://i.imgur.com/NQHj04x.png)

**For the extension to work, you must open a folder in your workspace that have git initialized.**

If the extension isn't working, check the Changes Counter output channel in the panel for more info.

## Contents

- [Features](#features)
- [Installation](#installation)
- [Extension Settings](#extension-settings)
- [Contributing](#contributing)
- [License](#license)

## Features

- Show the changes count in a VS Code status bar item to help you track the changes quantity
- Changes count is updated everytime you save a file
- When you exceed a changes quantity threshold:
  - The status bar item color changes
  - A notification is sent to warn you

## Installation

Open VS Code, press Ctrl + P and enter this command

`ext install LeonardoHolanda.changes-counter`

You can also search for "Changes Counter" in the Extensions Tab search, find the extension and install it there.

## Extension Settings

This extension contributes the following settings:

- `changesCounter.disableStatusBarIconColorChange`: Enable/disable the status bar item color change when you exceed the changes quantity threshold.

- `changesCounter.disableNotifications`: Enable/disable the notification when you exceed the changes quantity threshold.

## Contributing

Feel free to submit any issues or enhancement requests! I will do my best to fix or implement it. Already have a solution? Pull requests are also welcome!

## License

[MIT](https://choosealicense.com/licenses/mit/)
