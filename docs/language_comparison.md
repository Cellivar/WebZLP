# Comparison between Zebra printer command languages

There are generally four command languages you will encounter when looking at Zebra label printer harder:

* EPL
* EPL2
* ZPL
* ZPL2

Mobile printers add some complexity

* CPCL

More modern thermal printers have more complex communication options, such as direct print of PDF files, that are far outside the scope of this library. Some of these printers have settings to emulate ZPL or EPL command sets. Setting the printer to these modes may make it work with this library.

Some printer commands are only applicable to certain models of printers, such as battery information only being relevant to mobile label printers. Generally the source docs will clarify when a command may not be applicable to all printers. This library attempts to perform analysis to prevent invalid commands being set to printers that don't support those commads.

Many LP-series printers with UPS or FedEx firmware will have different behavior when running the same commands.

## Eltron Programming Language (EPL)

Eltron is the company that originally designed the basic framework of LP-series (and later) thermal label printers. They merged with Zebra in 1998 and printers manufacturered after this date were branded as Zebra printers while still using the EPL/EPL2 command set.

### EPL1 Line Mode

EPL1 is also referred to as "Line Mode" in Zebra's documentation. This is a very old standard designed for basic barcode layout and printing. It's unlikely any newer software should be designed with EPL1 line mode in mind. WebZPL can be used to put a printer into EPL1 line mode, but any operations from there on out are not supported by the library.

Zebra maintains an EPL1 programming guide [on their website](https://support.zebra.com/cpws/docs/eltron/epl/epl1_manual.pdf).

### EPL2 Page Mode

EPL2 is referred to as "Page Mode" in Zebra's documentation. This is a somewhat raw text-based command protocol that nearly all LP and TLP series printers supported even if the firmware was customized for a third party. This command set is what WebZPL was originally designed to drive and can be sent over USB, serial, bluetooth, or over the network via printers equipped with ethernet.

EPL2 supports bitmap images, which WebZPL supports, allowing for arbitrary (if somewhat slow) label images.

Zebra maintains an EPL2 programming guide [on their website](https://support.zebra.com/cpws/docs/eltron/epl2/EPL2_Prog.pdf). They also have some [tips and tricks](https://www.zebra.com/us/en/support-downloads/knowledge-articles/ait/epl2-command-information-and-details.html) documented for some specific edge cases.

## Zebra Programming Language (ZPL)

ZPL is a totally different language from EPL. The LP- series printers had a `-Z` model number to designate them as ZPL printers that _do not_ have EPL support. Later printers such as the GC series have support for both EPL or ZPL.

### ZPL

The original ZPL command language spec was designed to overcome some of the constraints of EPL and provide a more robust experience for designing complex label layouts directly in the command language. Sticking to a command language and not falling back to full rasterized labels the system can remain very snappy while still using slower serial speeds.

Given the similarities betwen ZPL and ZPL II this library does not have official support for ZPL and may cause issues with a printer set to ZPL mode instead of ZPL II mode.

Zebra maintains a ZPL programming guide [on their website](https://support.zebra.com/cpws/docs/zpl/zpl-zbi2-pm-en.pdf). They also have some [tips and tricks](https://www.zebra.com/us/en/support-downloads/knowledge-articles/zpl-command-information-and-details.html) documented for some specific edge cases.

### ZPL II

ZPL II changed how commands are interpreted in the internal buffer, which was a breaking change in some command's structure and behavior. All data fields in ZPL II are formatted as they're received. Previously the ^XZ (end format) started the processing. This can speed up individual label printing so long as the ZPL script is well written.

ZPL II is the most-supported language that Zebra still uses. ZPL printers may support a mish-mash of the options available [in the current manual Zebra publishes](https://www.zebra.com/content/dam/zebra_new_ia/en-us/manuals/printers/common/programming/zpl-zbi2-pm-en.pdf) and you may find third-party devices (from Honeywell, for example) whcih can accept ZPL commands. Cheap no-name brand thermal label printers may also support ZPL, though their behavior should be tested and validated before being placed in production.
