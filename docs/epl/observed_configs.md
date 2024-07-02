# Observed configuration output from EPL printers

This is a collection of real-world examples of config dumps (UQ command) from EPL printers, with some notes.

EPL printers, given the range of ages and history of customized firmware versions for white-label units, offer special challenges in dealing with the possible output.

WebZLP attempts to abstract these details away and assume sane defaults if the printer doesn't expose certain information.

If you have a printer that acts differently from this information or sends more config lines that WebZLP doesn't handle I would love to hear from you! [Open an issue to get started](https://github.com/Cellivar/WebZLP/issues/new/choose).

## Config Settings Explanation

Some of the EPL config lines are straightforward and are documented in examples below.

Some of the config lines are densely packed, broken out here for ease of reading. The numbers of sections come from page 36 of the EPL programming manual from 12/12/2013.

### Config settings J

`I8,A,001 rY JF WY`

* I - Character set settings
* r - Double buffering setting. `rY` enabled, `rN` disabled
* JF - Maybe top of form backup? Maybe related to `JC` and `JF` commands?
* WY - Windows mode? Maybe related to `W` command? `WY` and `WN` observed.

### Config settings K

`S4 D08 R112,000 ZB UN`

* S - Speed (Lookup table is in EPL manual, value is printer specific)
* D - Heat Density (00-15)
* R - Reference Point (offset from q and Q values)
* Z - Print Orientation
* U - Error status (UN means no error)

### Config settings L (Form buffer dimensions)

`q600 Q208,25`

* q - Form width (q command)
* Q - Form height and gap length (Q command)

### Config settings M1 (Hardware options)

`Option:D,Ff`

This will list the active hardware settings.

Assuming these values correspond to the O command (hardware options). These have not all been validated, observed values are noted.

* C - Cut at the end of each form (Observed)
* C{num} - Cut after {num} labels
* Cp - Cut after P command
* D - Direct thermal mode explicitly enabled (Observed)
* d - Printer defaulted to direct thermal mode on boot (Observed)
* P - Enable label taken sensor, for printers where this is defined in software.
* L - Feed button tap-to-print in dispense mode. Prints one label then waits for tap.
* F - Form feed mode (Observed)
  * f - Tap to feed blank label (Observed)
  * r - Tap to reprint last label (Observed)
  * i - Ignore feed button
* S - Reverse gap sensor mode (black line detect?)

### Config settings M2 (Line mode font settings)

`oEv,w,x,y,z`

This _seems_ to be related to the `oE` command's Line Mode Font Substitution for EPL1 font configuration. EPL1 had a configured list of 5 fonts, the `oE` command lets you modify which soft fonts are used in that list.

Since WebZLP doesn't support EPL1 emulation this is ignored.

### Config setting N (Autosense settings)

These are the result of the autosense routine detecting the label gap. The
sensor values are recorded as:

1. Backing Transparent point
2. Set point
3. Label Transparent point.

These can't be set directly, the printer determines them from the `xa` command.

### Config Settings O (Cover open sensor)

Later series printers added another IR proximity sensor to detect the head open state. If this is exposed in the firmware it wil show up here.

`Cover: T=143, C=166`

* T = Threshold of sensor open/closed state
* C = Current sensor value

### Config Settings P (Date and Time)

An onboard RTC with a battery was an upgrade option for some models. If equipped the current configured date and time will be displayed.

These battery-backed modules can fail and must be replaced.

`Date: 10-05-94`  
`Time:01:00:00`

## Example complete config

This config has not been observed in the wild, it's an example of all possible config lines from different printers I have seen. Some lines may be repeated. The WebZLP regex tests for EPL are based on this.

UKQ1935HLU     V4.29    # ID code and firmware version
S/N: 42A000000000       # Serial number
Page Mode               # EPL2 mode
Line Mode               # EPL1 mode
HEAD    usage =     249,392"    # Odometer of the head
PRINTER usage =     249,392"    # Odometer of the printer
Serial port:96,N,8,1    # Serial port config
Image buffer size:0245K # Image buffer size in use
Fmem:000.0K,060.9K avl  # Form storage
Gmem:000K,0037K avl     # Graphics storage
Emem:031K,0037K avl     # Soft font storage
Fmem used: 0 (bytes)    # Form storage (different format!)
Gmem used: 0            # Graphics storage (different format!)
Emem used: 0            # Soft font storage (different format!)
Available: 130559       # Total memory for Forms, Fonts, or Graphics
I8,A,001 rY JF WY       # Config settings J
S4 D08 R112,000 ZB UN   # Config settings K
q600 Q208,25            # Config settings L
Option:D,Ff             # Config settings M1
oEv,w,x,y,z             # Config settings M2
06 10 14                # Config settings N
Cover: T=118, C=129     # (T)reshold and (C)urrent Head Up (open) sensor.

## Observed configs

### 4.29

42A062602247

UKQ1935HLU     V4.29    # ID code and firmware version
S/N: 42A000000000       # Serial number
Serial port:96,N,8,1    # Serial port config
Image buffer size:0245K # Image buffer size in use
Fmem:000.0K,060.9K avl  # Form storage
Gmem:000K,0037K avl     # Graphics storage
Emem:031K,0037K avl     # Soft font storage
I8,A,001 rY JF WY       # Config settings J
S4 D08 R112,000 ZB UN   # Config settings K
q600 Q208,25            # Config settings L
Option:D,Ff             # Config settings M1
oEv,w,x,y,z             # Config settings M2
06 10 14                # Config settings N

### 4.45 LP2844ps

Note: no serial number field! Also doesn't show on the USB connection metadata, indicating there are printers out there where the software serial number is just _missing entirely_. WebZLP handles this by setting the serial number to `no_serial_nm` and your code must be able to handle this.

UKQ1935HMU  FDX V4.45           # ID code and firmware version
HEAD    usage =     249,392"    # Odometer of the head
PRINTER usage =     249,392"    # Odometer of the printer
Serial port:96,N,8,1            # Serial port config
Image buffer size:0225K         # Image buffer size in use
Fmem used: 0 (bytes)            # Form storage
Gmem used: 0                    # Graphics storage
Emem used: 0                    # Soft font storage
Available: 130559               # Total memory for Forms, Fonts, or Graphics
I8,A,001 rY JF WY               # Config settings J
S4 D10 R000,000 ZT UN           # Config settings K
q832 Q934,24                    # Config settings L
Option:D                        # Config settings M1
13 18 24                        # Config settings N
Cover: T=118, C=129             # (T)reshold and (C)urrent Head Up (open) sensor.

### 4.70.1A

UKQ1935HLU       V4.70.1A   # ID code and firmware version
S/N: 42A000000000           # Serial number
Serial port:96,N,8,1        # Serial port config
Page Mode                   # Print mode
Image buffer size:0507K     # Image buffer size in use
Fmem used: 0 (bytes)        # Form storage
Gmem used: 0                # Graphics storage
Emem used: 151215           # Soft fonts
Available: 503632           # Total memory for Forms, Fonts, or Graphics
I8,0,001 rY JF WY           # Config settings J
S4 D10 R8,0 ZT UN           # Config settings K
q816 Q923,25                # Config settings L
Option:D,Ff                 # Config settings M1
oEv,w,x,y,z                 # Config settings M2
15 21 28                    # Config settings N
Cover: T=144, C=167         # (T)reshold and (C)urrent Head Up (open) sensor.

### Others

UKQ1935HLU V4.59
S/N: 42A000000000
Serial port:96,N,8,1
Page mode
Image buffer size:0245K
Fmem used: 25 (bytes)
Gmem used: 0
Emem used: 29600
Available: 100934
I8,10,001 rN JF WY
S2 D06 R248 , 0 ZT UN
q328 Q163,0 Ymax:5992
Option: D,Ff
oEv,w,x,y,z
00 04 08
Cover: T=137, C=147
