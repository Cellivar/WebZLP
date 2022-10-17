# Shipping company (UPS, FedEx) Printers

Zebra apparently made custom firmware packages for their LP2844 printer series. Both UPS and FedEx took advantage of this to have their own printers created that can only communicate with their own software drivers.

These units have special considerations for operating with EPL2, and while they're _mostly_ compatible with EPL2 there are some quirks associated with them

Zebra [has a support document about these printers](https://support.zebra.com/cpws/docs/eltron/2844/lp2844_120nums.htm) and most of this information comes from there.

## General rules

**Do not attempt a firmware update for these types of printers**. It will fail and you will brick your printer.

For running on Windows machines Seagull Scientific / BarTender software has a driver they've built to Just Make It Work :tm:. It can be [downloaded from their website](https://www.seagullscientific.com/support/downloads/drivers/zebra/). WebZLP does not need this drive to function (and in fact it will interfere), this is only documented here so there's less stuff scattered to the four winds on the internet.

Generally the custom firmware of these printers only extended to the driver communication, the actual EPL command set is intact and can be used as-is. WebZLP attempts to stick to just this command set to avoid compatibility issues.

## UPS printers

UPS printers can be identified usually by a UPS logo on the front of the device. That's not a guarantee though, so check the rear label:

* The model number will be UPS LP2844/
* The part number starts with 120625, 120725, 120765, or possibly other 120xxx- prefixes/

The proper Windows Zebra driver will not communicate with these printers properly, prints will end up being blurry or scaled wrong. You may also encounter calibration problems as the firmware is designed to work with nonstandard label sizes.

These appear to be pretty common in general so there's information floating around the internet on dealing with them.

Some INSANE PERSON figured out how to pull the chips off UPS model boards, put them in a programmer, write a regular firmware on top of the UPS firmware, write it back to the chips, and wind up with a standard LP2844 printer. They've [provided their code and written up the process](https://github.com/DCHHV/patch2844) and it's crazy. Again this is NOT NECESSARY for WebZLP to communicate with these printers and I would _not_ recommend doing this unless you are okay with the possibility of having a very 90s styled paperweight.

## FedEx Printers

FedEx printers are more tricky. If they don't have a clear FedEx sticker on them:

* The firmware will have FDX next to the version number/
* The Part Number starts with 120598, 120599, 120717, or possibly other 120xxx- prefixes.

These appear to fly under the radar more often than not so less information is known about them on the open internet.
