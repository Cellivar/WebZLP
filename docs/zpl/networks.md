# Networks of ZPL Printers

ZPL supports several networking methodologies

## Ethernet

### Config

> EPL doesn't appear to have a way to directly configure network settings, the manuals only reference SGD commands.

ZPL has several commands to set network settings, they act slightly differently depending on firmware version and hardware config.

* The `^NS` command appears to be oldest, with the first 4 parameters (a,b,c,d) seemingly being universal.
* As early as 2006 the "Wireless and Wireless Plus print servers" added parameters to the NS command, up to `^NSa,b,c,d,e,f,g,h,i`.
* The separate `^WI` command was added for configuring wireless network settings, see the wifi section below.
* Later firmware versions added the `^ND` command, which can set external wired, internal wired, or wireless settings using the same command. It'll work as an alias for `^NS` or `^ND` depending on the `a` parameter.

Example to set a static IP of `192.168.1.151`:

`^NSP,192.168.1.151,255.255.255.0,192.168.1.1`

The default IP resolution mode is `all`.

### ZebraNet PrintServer II

For a while Zebra offered an external ZebraNet PrintServer II device that plugged directly into the parallel port on most printers. On some models they also offered this as an embedded option, either as a module or directly on the same circuit board in the case of some LP-2844 series.

Newer models offer a more integrated networking stack.

Different features are supported depending on generation, though the ZebraNet PrintServer II era tend to be very similar.

Ports:

* 21 - FTP
* 23 - Telnet
* 80 - HTTP web server
* 161 - SNMP
* 162 - SNMP Trap on ZebraNet Alert
* 515 - Printer port (Line Printer Daemon)
* 631 - IPP (Limited models)
* 4201 - (UDP) Zebra network auto-discovery port
* 9100 - Raw network printing
* 20035 - (UDP) WCSO wireless auto-discovery port

ZebraNet may negotiate some dynamic ports too.

### LinkOS Printers

These are more complex and add additional ports in addition to the above. They can also be configured.

* 443 - HTTPS web GUI
* 9143, 9243 - TLSRAW connections

### Discovery Protocol

This section is copy/pasted [from JFR's blog post here](https://jfr.im/blog/2024/09/zebra-network-discovery-protocol/).

> Discovery client sends a UDP packet to port 4201 (unicast or broadcast), containing the data: `0x2e2c3a010000`, or `.,:\x01\x00\x00`.
>
> Actually, the discovery client sends 3 identical such packets (from the same socket), then waits 1 second, then repeats the process from a new source port. It sends 3 packets 3 times, for a total of 9 packets. This appears to be meant to handle UDP’s lack of reliability; the printers reply to each packet (for a total of 9 replies from each printer).
>
> The printers reply back with a (now unicast) packet beginning with `0x3a2c2e` or `:,.`. This is followed by a 0x03 byte, I’m not sure if this is part of the magic bytes or part of the data, and then the data begins with the “Product Number”.
>
> This set of information is displayed verbatim in the ZebraNet Bridge tool:

```text
0000   3a 2c 2e 03 37 39 30 37 31 00 00 00 5a 65 62 72   :,..79071...Zebr
       ^-Cmd?----^ ^-Product #--^-------?^ ^-Name-----
0010   61 4e 65 74 20 57 69 72 65 64 20 50 53 00 00 00   aNet Wired PS...
       -------------------------------------^------?^
0020   31 31 36 36 41 00 00 56 35 36 2e 31 37 2e 31 31   1166A..V56.17.11
       ^-Datecode---^----?^ ^-FW Version--------------
0030   5a 5a 42 52 00 61 00 07 4d 41 08 bd 34 32 36 32   ZZBR.a..MA..4262
       -^                                  ^-S/N------
0040   30 37 37 00 00 00 01 00 0a 01 00 9e ff ff ff 00   077.............
       -------^-------?^       ^-IP------^ ^-Netmask-^
       01 00: "Using Net Protocol: TRUE"?
0050   0a 01 00 01 5a 42 52 34 32 36 32 30 37 37 00 00   ....ZBR4262077..
       ^-Gateway-^ ^-System Name (hostname?)---^---?
```

> Unfortunately, I have no idea what the remainder of the message is:

```text
0060   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   ................
0070   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   ................
0080   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   ................
0090   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   ................
00a0   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   ................
00b0   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   ................
00c0   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   ................
00d0   00 00 00 00 7a 00 6d 14 7a 16 11 1c 2b 3a 35 30   ....z.m.z...+:50
00e0   3f 4e 59 54 53 52 5d 68 67 66 61 6c 7b 8a 85 80   ?NYTSR]hgfal{...
00f0   8f 9e a9 a4 ee 18 e1 14 ee 0e 8d 0c 8f 0a 91 08   ................
0100   93 06 95 04 97 02 99 00 9b 3e dd 7c 1f ba 21 b8   .........>.|..!.
0110   23 b6 25 b4 4e 6f 6e 65 00 0e 8d 0c 8f 0a 91 08   #.%.None........
0120   93 06 95 04 97 02 99 00 9b 3e dd 7c 1f ba 21 b8   .........>.|..!.
0130   23 b6 25 b4 00 00 00 00 00 00 00 00 00 00 00 00   #.%.............
0140   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   ................
0150   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   ................
0160   00 00 00 00 01 01 01 00 00 00 00 00 00 00 00 00   ................
0170   00 00 00 00 00 00 00                              .......
```

## Wifi

I don't have a machine with wifi! These include lots of fun commands.

## Bluetooth Serial

I don't have an older style bluetooth machine!

## Bluetooth LE

Modern LinkOS devices tend to support Bluetooth LE, especially if they have a tap-to-connect NFC tag.

## RS-485

WebZLP does not currently implement RS-485 networking. Ask if you need this, I would very much like to know more about why!

Some models of printers are designed to be connected on an RS-485 serial bus network. When connected to such a network each printer has a _Network ID_ that controls how to talk to a given printer. Each network ID is 3 digits, 000 through 999.

Several commands are used for controlling serial networks:

* `~NC` - Network Connect, used at the start of the label to wake up the printer and send subsequent commands.
* `^NI` - Assign network ID number to a given printer.
* `~NR` - Set all network printers "transparent" (disconnect)
* `~NT` - Set current printer "transparent" (disconnect)
