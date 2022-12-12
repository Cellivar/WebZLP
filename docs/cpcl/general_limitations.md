# General CPCL limitations

## Bluetooth is not supported

Comtec printers appear to have been early adopters of Bluetooth technology. Unfortunately this also means the BT tech stack they use is difficult to work with.

Web Bluetooth was not designed with 'Bluetooth Classic' devices in mind, which all CPCL printers are. From my research no CPCL printers make use of Bluetooth LE (and documentation hints towards older BT printers that worked with iOS having gone through the full mfi program) and cannot be supported by this library until Web Bluetooth can support BT Classic protocols.

## CPCL support is limited to Link-OS devices

I can't find the programming manual for the original CPCL language. The end of the Zebra Link-OS programming guide lists a long number of commands that it doesn't support with no further information about them. I don't know how to make them work and thus they are not supported by this library.

The commands are:

```text
ANNOUNCE
ANNOUNCE-CODES
BARCODE-EGP BEGP
BLIT
BMP, BMP90, BMP180, BMP270
BOARDING-PASS
CASE-SENSITIVE CS
COLOR
COLOR-TONE
CUT
CUT-AT
CUTTER
E
EMULATE
ENCRYPTED_DATA ED
ENHANCE-VBARCODE EVB
EPL
ESCAPE-Y-ADJUST
FILE-TRANSFER
FLASH-FILE-DEBUG
IN-CINCHES
INPUT
LAN
LH
LINE-MODE
MCE
MOTOR
NO-CUTTER
PAGE-MODE
PARTIAL-CUT
PECTAB
POST-TENSION
POWER-MODE
PRE-TENSTION
PRINT-DENSITY
REWIND-OFF
REWIND-ON
S-CARD
SRF-ACCESS
SRF-OFF
SRF-ON
TCP-ACCESS
T-DIRECT
T-TRANSFER
WAIT-STATES
X-PRINT-SHIFT
ZB

<ESC><SO>
<ESC><SI>
<ESC>(
<ESC>L
<ESC>O
<ESC>T
<ESC>U
<ESC>W
<ESC>X
<ESC>Y
<ESC>Z
<ESC>a
<ESC>b
<ESC>c
<ESC>d
<ESC>k
<ESC>m
<ESC>o
<ESC>q
<ESC>r
<ESC>t
<ESC>z
```

I am _intensely_ curious about what the BOARDING-PASS command did, so if anyone can provide me the programming manual and/or a printer that supports older CPCL commands I would be more than happy to investigate supporting them.
