# Observed configuration output from EPL printers

This is a collection of real-world examples of config dumps (UQ command) from EPL printers, with some notes.

EPL printers, given the range of ages and history of customized firmware versions for white-label units, offer special challenges in dealing with the possible output.

## 4.29

42A062602247

UKQ1935HLU     V4.29    # ID code and firmware version
S/N: 42A000000000       # Serial number
Serial port:96,N,8,1    # Serial port config
Image buffer size:0245K # Image buffer size in use
Fmem:000.0K,060.9K avl  # Form storage
Gmem:000K,0037K avl     # Graphics storage
Emem:031K,0037K avl     # Soft font storage
I8,A,001 rY JF WY       # Config settings 1
S4 D08 R112,000 ZB UN   # Config settings 2
q600 Q208,25            # Form width (q) and length (Q). See those commands.
Option:D,Ff             # Config settings 3, see below
oEv,w,x,y,z             # Config settings 4, see below
06 10 14                # AutoSense settings, see below

## 4.45 LP 2844ps

Note: no serial number field! Also doesn't show on the USB connection.

UKQ1935HMU  FDX V4.45           # ID code and firmware version
HEAD    usage =     249,392"    # Odometer of the head
PRINTER usage =     249,392"    # Odometer of the printer
Serial port:96,N,8,1            # Serial port config
Image buffer size:0225K         # Image buffer size in use
Fmem used: 0 (bytes)            # Form storage
Gmem used: 0                    # Graphics storage
Emem used: 0                    # Soft font storage
Available: 130559               # Total memory for Forms, Fonts, or Graphics
I8,A,001 rY JF WY               # Config settings 1, see below
S4 D10 R000,000 ZT UN           # Config settings 2, see below
q832 Q934,24                    # Form width (q) and length (Q). See those commands.
Option:D                        # Config settings 3, see below
13 18 24                        # AutoSense settings, see below
Cover: T=118, C=129             # (T)reshold and (C)urrent Head Up (open) sensor.

## 4.70.1A

UKQ1935HLU       V4.70.1A   # ID code and firmware version
S/N: 42A000000000           # Serial number
Serial port:96,N,8,1        # Serial port config
Page Mode                   # Print mode
Image buffer size:0507K     # Image buffer size in use
Fmem used: 0 (bytes)        # Form storage
Gmem used: 0                # Graphics storage
Emem used: 151215           # Soft fonts
Available: 503632           # Total memory for Forms, Fonts, or Graphics
I8,0,001 rY JF WY           # Config settings 1, see below
S4 D10 R8,0 ZT UN           # Config settings 2, see below
q816 Q923,25                # Config settings 3, see below
Option:D,Ff                 # Config settings 3, see below
oEv,w,x,y,z                 # Config settings 4, see below
15 21 28                    # AutoSense settings, see below
Cover: T=144, C=167         # (T)reshold and (C)urrent Head Up (open) sensor.

## Config Settings Explanation

### Config settings 1

* I - Character set setting
* r - Double buffering setting. rY enabled, rN disabled
* JF WY - Unknown? Seem to always be JF and WY. JF WN observed!

### Config settings 2

* S - Speed
* D - Heat Density
* R - Reference Point (related to q and Q values)
* Z - Print Orientation
* U - Error status (UN means no error)

### Config settings 3

* q - Form width (q command)
* Q - Form height and gap length (Q command)

### Config settings 4

This will list the active hardware settings.

* d - Appears in documentation, not understood, maybe

Assuming these values correspond to the O command (hardware options). These have not been validated, observed values are noted.

* C - Cut at the end of each form
* C{num} - Cut after {num} labels
* Cp - Cut after P command
* D - Direct thermal mode explicitly enabled (Observed)
* d - Printer defautled to direct thermal mode on boot (Observed)
* P - Enable label taken sensor for printers where this is defined in software.
* L - Feed button tap-to-print in dispense mode. Prints one label then waits for tap.
* F - Form feed mode (Observed)
  * f - Tap to feed blank label (Observed)
  * r - Reprint last label (Observed)
  * i - Ignore feed button
* S - Reverse gap sensor mode (black line detect?)

### Config settings 5

Unknown! Documentation just calls them "Hardware and Software Option status".

These probably correlate to settings you can configure via various commands but I have not been able to narrow down which commands have what effect.

* oEv,w,x,y,z - Observed

### Autosense settings

These are the result of the autosense routine detecting the label gap. The
sensor values are recorded as:

1. Backing Transparent point
2. Set point
3. Label Transparent point.
