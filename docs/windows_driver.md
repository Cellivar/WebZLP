# Windows Printer Driver Conflicts

The Windows driver model [works differently from other operating systems](https://web.dev/build-for-webusb/#windows) and will, by default, use a printer driver for USB printer devices.

While this is useful for most users, WebUSB relies on the browser being able to communicate direcly to a USB endpoint. The default driver Windows will assign to a printer prevents this.

A full explanation of how WebUSB, the browser, and the operating system communicate are out of scope for this library. The [Build for WebUSB](https://web.dev/build-for-webusb) article goes into more depth.

## Workarounds

### Different operating system

The simplest workaround is to use a different operating system. ChromeOS, Linux, macOS, and Android can all make use of WebUSB without needing to deal with driver issues.

If you are making an equipment purchase decision _strongly_ consider using something other than Windows devices for this application. For example, ChromeOS devices make for good 'check-in kiosk' devices for checking attendees into an event that requires label printing.

### Replace the driver

You can use a debug tool to replace the driver with a different version. This is a summary [of this guide](https://github.com/pbatard/libwdi/wiki/Zadig).

1. Plug in your printer and connect it to your Windows machine, letting it automatically install the driver.
1. Download the [latest verison of Zadig](https://zadig.akeo.ie/) (or from [GitHub](https://github.com/pbatard/libwdi/releases)).
1. Run the Zadig executable.
1. Select Options -> List All Devices.
1. Select your printer in the device list.
    * Your printer may not be named what you expect. I have an LP2844 that calls itself a TLP2844 in this list.
    * You may have a Windows Notification that shows the name of the device if it was the first time being installed.
1. Confirm the interface indicates you're replacing the `usbprint` driver with the `WinUSB` driver.
1. Click `Replace Driver`.
    * You may be prompted with a bright red warning that the driver isn't trusted. This is because Zadig generates a new self-signed driver on the fly. [You may need to change your Windows settings to make this work](https://support.viewsonic.com/en/support/solutions/articles/33000252416-how-to-install-unsigned-drivers-in-windows-10) if you don't even see a prompt and just get an error.
    * Click 'Install this anyway' to proceed.
1. Wait, the process is not immediate.

Once complete the printer should be able to be paired in your browser.
