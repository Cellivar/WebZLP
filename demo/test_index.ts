import * as WebLabel from '../src/index.js';
import * as WebDevices from 'web-device-mux';
import bootstrap from 'bootstrap';
// This file exists to test the index.html's typescript. Unfortunately there isn't
// a good way to configure Visual Studio Code to, well, treat it as typescript.
////////////////////////////////////////////////////////////////////////////////

// First import the lib!
//import * as WebLabel from 'web-receiptline-printer';

// For this demo we're going to make use of the USB printer manager
// so it can take care of concerns like the USB connect and disconnect events.

// We'll set a type alias so it's easier to read our code
type PrinterManager = WebDevices.UsbDeviceManager<WebLabel.LabelPrinterUsb>;
// Then we'll construct one to use
const printerMgr: PrinterManager = new WebDevices.UsbDeviceManager(
  window.navigator.usb,
  WebLabel.LabelPrinter.fromUSBDevice,
  {
    // Enable debugging, so the dev console can fill up with interesting messages!
    debug: true,
    requestOptions: {
      // Limit the USB devices we try to connect to.
      filters: [
        {
          vendorId: 0x0A5F // Zebra
        }
      ]
    }
  }
)

// We'll wire up some basic event listeners to the printer manager.
// First, a button to prompt a user to add a printer.
const addPrinterBtn = document.getElementById('addprinter')!;
addPrinterBtn.addEventListener('click', async () => printerMgr.promptForNewDevice());

// Next a button to manually refresh all printers, just in case.
const refreshPrinterBtn = document.getElementById('refreshPrinters')!;
refreshPrinterBtn.addEventListener('click', async () => printerMgr.forceReconnect());

// Next we wire up some events on the UsbDeviceManager itself.
printerMgr.addEventListener('connectedDevice', ({ detail }) => {
    const printer = detail.device;
    console.log('New printer is a', printer.printerModel);
    const config = printer.printerOptions;
    console.log('Printer darkness is', config.darknessPercent, 'percent');
    console.log('Printer speed is', WebLabel.PrintSpeed[config.speed.printSpeed]);
    console.log(
        'Label is',
        config.mediaWidthInches,
        'in wide and',
        config.mediaLengthInches,
        'in long');
    console.log('Printer media mode is', WebLabel.MediaMediaGapDetectionMode[config.mediaGapDetectMode]);
});

// There's also an event that will tell you when a printer disconnects.
printerMgr.addEventListener('disconnectedDevice', ({ detail }) => {
    const printer = detail.device;
    console.log('Lost printer', printer.printerModel, 'serial', printer.printerOptions.serialNumber);
});

// When the browser first loaded the page any previously connected printers would have caused
// a connection event. Our listener wasn't listening yet so missed it.
// It's good practice to force a reconnect once your event handlers are ready.
// We're going to skip this for now though, because we want it to happen after the app is ready.
//await printerMgr.reconnectAllPrinters();

// And that's all there is to setup! The page can now talk to printers.
// If you're using a chromebook this should just work. If you're on Windows
// you might need to do some driver setup, see the repo README for more details.

// The rest of this demo is an example of a basic label generator app.

// First we create an interface to describe our settings form.
interface ConfigModalForm extends HTMLCollection {
    modalCancel         : HTMLButtonElement
    modalDarkness       : HTMLSelectElement
    modalLabelHeight    : HTMLInputElement
    modalLabelOffsetLeft: HTMLInputElement
    modalLabelOffsetTop : HTMLInputElement
    modalLabelWidth     : HTMLInputElement
    modalMediaType      : HTMLSelectElement
    modalSpeed          : HTMLSelectElement
    modalSubmit         : HTMLButtonElement
    modalWithAutosense  : HTMLInputElement
}

// The app's logic is wrapped in a class just for ease of reading.
class BasicLabelDesignerApp {
    constructor(
        private manager: PrinterManager,
        private btnContainer: HTMLElement,
        private labelForm: HTMLElement,
        private labelFormInstructions: HTMLElement,
        private configModal: HTMLElement
    ) {
        // Based on the containers, map the various listeners.
        this.configModalHandle = new bootstrap.Modal(this.configModal);
        this.configModal
            .querySelector('form')!
            .addEventListener('submit', this.updatePrinterConfig.bind(this));
        this.labelForm.addEventListener('blur', this.renderTextForm.bind(this));
        this.labelForm.addEventListener('keyup', this.renderTextForm.bind(this));

        // Add a second set of event listeners for printer connect and disconnect to redraw
        // the printer list when it changes.
        this.manager.addEventListener('connectedDevice', () => {
            this.activePrinterIndex = -1;
            this.redrawPrinterButtons();
        });
        this.manager.addEventListener('disconnectedDevice', () => {
            this.activePrinterIndex = -1;
            this.redrawPrinterButtons();
        });

        // Here's a nice font with a great set of emoji that work well for monochrome printing.
        // The text font is fairly basic though, so we would like to use only the emoji out
        // of this font and use a basic sans-serif font for regular text.
        // https://fonts.google.com/noto/specimen/Noto+Emoji
        const emojiFontName = 'noto-emoji';

        // We can accomplish this with the unicodeRange property of our FontFace. We just
        // need to list EVERY SINGLE EMOJI UNICODE RANGE to make it work. Fortunately someone
        // has done this already: https://github.com/fraction/emoji-unicode-range
        const emojiUnicodeRange = 'U+00A9,U+00AE,U+203C,U+2049,U+2122,U+2139,U+2194-2199,U+21A9-21AA,U+231A-231B,U+2328,U+23CF,U+23E9-23F3,U+23F8-23FA,U+24C2,U+25AA-25AB,U+25B6,U+25C0,U+25FB-25FE,U+2600-2604,U+260E,U+2611,U+2614-2615,U+2618,U+261D,U+2620,U+2622-2623,U+2626,U+262A,U+262E-262F,U+2638-263A,U+2640,U+2642,U+2648-2653,U+265F-2660,U+2663,U+2665-2666,U+2668,U+267B,U+267E-267F,U+2692-2697,U+2699,U+269B-269C,U+26A0-26A1,U+26AA-26AB,U+26B0-26B1,U+26BD-26BE,U+26C4-26C5,U+26C8,U+26CE,U+26CF,U+26D1,U+26D3-26D4,U+26E9-26EA,U+26F0-26F5,U+26F7-26FA,U+26FD,U+2702,U+2705,U+2708-2709,U+270A-270B,U+270C-270D,U+270F,U+2712,U+2714,U+2716,U+271D,U+2721,U+2728,U+2733-2734,U+2744,U+2747,U+274C,U+274E,U+2753-2755,U+2757,U+2763-2764,U+2795-2797,U+27A1,U+27B0,U+27BF,U+2934-2935,U+2B05-2B07,U+2B1B-2B1C,U+2B50,U+2B55,U+3030,U+303D,U+3297,U+3299,U+1F004,U+1F0CF,U+1F170-1F171,U+1F17E,U+1F17F,U+1F18E,U+1F191-1F19A,U+1F1E6-1F1FF,U+1F201-1F202,U+1F21A,U+1F22F,U+1F232-1F23A,U+1F250-1F251,U+1F300-1F320,U+1F321,U+1F324-1F32C,U+1F32D-1F32F,U+1F330-1F335,U+1F336,U+1F337-1F37C,U+1F37D,U+1F37E-1F37F,U+1F380-1F393,U+1F396-1F397,U+1F399-1F39B,U+1F39E-1F39F,U+1F3A0-1F3C4,U+1F3C5,U+1F3C6-1F3CA,U+1F3CB-1F3CE,U+1F3CF-1F3D3,U+1F3D4-1F3DF,U+1F3E0-1F3F0,U+1F3F3-1F3F5,U+1F3F7,U+1F3F8-1F3FF,U+1F400-1F43E,U+1F43F,U+1F440,U+1F441,U+1F442-1F4F7,U+1F4F8,U+1F4F9-1F4FC,U+1F4FD,U+1F4FF,U+1F500-1F53D,U+1F549-1F54A,U+1F54B-1F54E,U+1F550-1F567,U+1F56F-1F570,U+1F573-1F579,U+1F57A,U+1F587,U+1F58A-1F58D,U+1F590,U+1F595-1F596,U+1F5A4,U+1F5A5,U+1F5A8,U+1F5B1-1F5B2,U+1F5BC,U+1F5C2-1F5C4,U+1F5D1-1F5D3,U+1F5DC-1F5DE,U+1F5E1,U+1F5E3,U+1F5E8,U+1F5EF,U+1F5F3,U+1F5FA,U+1F5FB-1F5FF,U+1F600,U+1F601-1F610,U+1F611,U+1F612-1F614,U+1F615,U+1F616,U+1F617,U+1F618,U+1F619,U+1F61A,U+1F61B,U+1F61C-1F61E,U+1F61F,U+1F620-1F625,U+1F626-1F627,U+1F628-1F62B,U+1F62C,U+1F62D,U+1F62E-1F62F,U+1F630-1F633,U+1F634,U+1F635-1F640,U+1F641-1F642,U+1F643-1F644,U+1F645-1F64F,U+1F680-1F6C5,U+1F6CB-1F6CF,U+1F6D0,U+1F6D1-1F6D2,U+1F6D5,U+1F6E0-1F6E5,U+1F6E9,U+1F6EB-1F6EC,U+1F6F0,U+1F6F3,U+1F6F4-1F6F6,U+1F6F7-1F6F8,U+1F6F9,U+1F6FA,U+1F7E0-1F7EB,U+1F90D-1F90F,U+1F910-1F918,U+1F919-1F91E,U+1F91F,U+1F920-1F927,U+1F928-1F92F,U+1F930,U+1F931-1F932,U+1F933-1F93A,U+1F93C-1F93E,U+1F93F,U+1F940-1F945,U+1F947-1F94B,U+1F94C,U+1F94D-1F94F,U+1F950-1F95E,U+1F95F-1F96B,U+1F96C-1F970,U+1F971,U+1F973-1F976,U+1F97A,U+1F97B,U+1F97C-1F97F,U+1F980-1F984,U+1F985-1F991,U+1F992-1F997,U+1F998-1F9A2,U+1F9A5-1F9AA,U+1F9AE-1F9AF,U+1F9B0-1F9B9,U+1F9BA-1F9BF,U+1F9C0,U+1F9C1-1F9C2,U+1F9C3-1F9CA,U+1F9CD-1F9CF,U+1F9D0-1F9E6,U+1F9E7-1F9FF,U+1FA70-1FA73,U+1FA78-1FA7A,U+1FA80-1FA82,U+1FA90-1FA95,U+231A-231B,U+23E9-23EC,U+23F0,U+23F3,U+25FD-25FE,U+2614-2615,U+2648-2653,U+267F,U+2693,U+26A1,U+26AA-26AB,U+26BD-26BE,U+26C4-26C5,U+26CE,U+26D4,U+26EA,U+26F2-26F3,U+26F5,U+26FA,U+26FD,U+2705,U+270A-270B,U+2728,U+274C,U+274E,U+2753-2755,U+2757,U+2795-2797,U+27B0,U+27BF,U+2B1B-2B1C,U+2B50,U+2B55,U+1F004,U+1F0CF,U+1F18E,U+1F191-1F19A,U+1F1E6-1F1FF,U+1F201,U+1F21A,U+1F22F,U+1F232-1F236,U+1F238-1F23A,U+1F250-1F251,U+1F300-1F320,U+1F32D-1F32F,U+1F330-1F335,U+1F337-1F37C,U+1F37E-1F37F,U+1F380-1F393,U+1F3A0-1F3C4,U+1F3C5,U+1F3C6-1F3CA,U+1F3CF-1F3D3,U+1F3E0-1F3F0,U+1F3F4,U+1F3F8-1F3FF,U+1F400-1F43E,U+1F440,U+1F442-1F4F7,U+1F4F8,U+1F4F9-1F4FC,U+1F4FF,U+1F500-1F53D,U+1F54B-1F54E,U+1F550-1F567,U+1F57A,U+1F595-1F596,U+1F5A4,U+1F5FB-1F5FF,U+1F600,U+1F601-1F610,U+1F611,U+1F612-1F614,U+1F615,U+1F616,U+1F617,U+1F618,U+1F619,U+1F61A,U+1F61B,U+1F61C-1F61E,U+1F61F,U+1F620-1F625,U+1F626-1F627,U+1F628-1F62B,U+1F62C,U+1F62D,U+1F62E-1F62F,U+1F630-1F633,U+1F634,U+1F635-1F640,U+1F641-1F642,U+1F643-1F644,U+1F645-1F64F,U+1F680-1F6C5,U+1F6CC,U+1F6D0,U+1F6D1-1F6D2,U+1F6D5,U+1F6EB-1F6EC,U+1F6F4-1F6F6,U+1F6F7-1F6F8,U+1F6F9,U+1F6FA,U+1F7E0-1F7EB,U+1F90D-1F90F,U+1F910-1F918,U+1F919-1F91E,U+1F91F,U+1F920-1F927,U+1F928-1F92F,U+1F930,U+1F931-1F932,U+1F933-1F93A,U+1F93C-1F93E,U+1F93F,U+1F940-1F945,U+1F947-1F94B,U+1F94C,U+1F94D-1F94F,U+1F950-1F95E,U+1F95F-1F96B,U+1F96C-1F970,U+1F971,U+1F973-1F976,U+1F97A,U+1F97B,U+1F97C-1F97F,U+1F980-1F984,U+1F985-1F991,U+1F992-1F997,U+1F998-1F9A2,U+1F9A5-1F9AA,U+1F9AE-1F9AF,U+1F9B0-1F9B9,U+1F9BA-1F9BF,U+1F9C0,U+1F9C1-1F9C2,U+1F9C3-1F9CA,U+1F9CD-1F9CF,U+1F9D0-1F9E6,U+1F9E7-1F9FF,U+1FA70-1FA73,U+1FA78-1FA7A,U+1FA80-1FA82,U+1FA90-1FA95,U+1F3FB-1F3FF,U+261D,U+26F9,U+270A-270B,U+270C-270D,U+1F385,U+1F3C2-1F3C4,U+1F3C7,U+1F3CA,U+1F3CB-1F3CC,U+1F442-1F443,U+1F446-1F450,U+1F466-1F478,U+1F47C,U+1F481-1F483,U+1F485-1F487,U+1F48F,U+1F491,U+1F4AA,U+1F574-1F575,U+1F57A,U+1F590,U+1F595-1F596,U+1F645-1F647,U+1F64B-1F64F,U+1F6A3,U+1F6B4-1F6B6,U+1F6C0,U+1F6CC,U+1F90F,U+1F918,U+1F919-1F91E,U+1F91F,U+1F926,U+1F930,U+1F931-1F932,U+1F933-1F939,U+1F93C-1F93E,U+1F9B5-1F9B6,U+1F9B8-1F9B9,U+1F9BB,U+1F9CD-1F9CF,U+1F9D1-1F9DD,U+0023,U+002A,U+0030-0039,U+200D,U+20E3,U+FE0F,U+1F1E6-1F1FF,U+1F3FB-1F3FF,U+1F9B0-1F9B3,U+E0020-E007F,U+00A9,U+00AE,U+203C,U+2049,U+2122,U+2139,U+2194-2199,U+21A9-21AA,U+231A-231B,U+2328,U+2388,U+23CF,U+23E9-23F3,U+23F8-23FA,U+24C2,U+25AA-25AB,U+25B6,U+25C0,U+25FB-25FE,U+2600-2605,U+2607-2612,U+2614-2615,U+2616-2617,U+2618,U+2619,U+261A-266F,U+2670-2671,U+2672-267D,U+267E-267F,U+2680-2685,U+2690-2691,U+2692-269C,U+269D,U+269E-269F,U+26A0-26A1,U+26A2-26B1,U+26B2,U+26B3-26BC,U+26BD-26BF,U+26C0-26C3,U+26C4-26CD,U+26CE,U+26CF-26E1,U+26E2,U+26E3,U+26E4-26E7,U+26E8-26FF,U+2700,U+2701-2704,U+2705,U+2708-2709,U+270A-270B,U+270C-2712,U+2714,U+2716,U+271D,U+2721,U+2728,U+2733-2734,U+2744,U+2747,U+274C,U+274E,U+2753-2755,U+2757,U+2763-2767,U+2795-2797,U+27A1,U+27B0,U+27BF,U+2934-2935,U+2B05-2B07,U+2B1B-2B1C,U+2B50,U+2B55,U+3030,U+303D,U+3297,U+3299,U+1F000-1F02B,U+1F02C-1F02F,U+1F030-1F093,U+1F094-1F09F,U+1F0A0-1F0AE,U+1F0AF-1F0B0,U+1F0B1-1F0BE,U+1F0BF,U+1F0C0,U+1F0C1-1F0CF,U+1F0D0,U+1F0D1-1F0DF,U+1F0E0-1F0F5,U+1F0F6-1F0FF,U+1F10D-1F10F,U+1F12F,U+1F16C,U+1F16D-1F16F,U+1F170-1F171,U+1F17E,U+1F17F,U+1F18E,U+1F191-1F19A,U+1F1AD-1F1E5,U+1F201-1F202,U+1F203-1F20F,U+1F21A,U+1F22F,U+1F232-1F23A,U+1F23C-1F23F,U+1F249-1F24F,U+1F250-1F251,U+1F252-1F25F,U+1F260-1F265,U+1F266-1F2FF,U+1F300-1F320,U+1F321-1F32C,U+1F32D-1F32F,U+1F330-1F335,U+1F336,U+1F337-1F37C,U+1F37D,U+1F37E-1F37F,U+1F380-1F393,U+1F394-1F39F,U+1F3A0-1F3C4,U+1F3C5,U+1F3C6-1F3CA,U+1F3CB-1F3CE,U+1F3CF-1F3D3,U+1F3D4-1F3DF,U+1F3E0-1F3F0,U+1F3F1-1F3F7,U+1F3F8-1F3FA,U+1F400-1F43E,U+1F43F,U+1F440,U+1F441,U+1F442-1F4F7,U+1F4F8,U+1F4F9-1F4FC,U+1F4FD-1F4FE,U+1F4FF,U+1F500-1F53D,U+1F546-1F54A,U+1F54B-1F54F,U+1F550-1F567,U+1F568-1F579,U+1F57A,U+1F57B-1F5A3,U+1F5A4,U+1F5A5-1F5FA,U+1F5FB-1F5FF,U+1F600,U+1F601-1F610,U+1F611,U+1F612-1F614,U+1F615,U+1F616,U+1F617,U+1F618,U+1F619,U+1F61A,U+1F61B,U+1F61C-1F61E,U+1F61F,U+1F620-1F625,U+1F626-1F627,U+1F628-1F62B,U+1F62C,U+1F62D,U+1F62E-1F62F,U+1F630-1F633,U+1F634,U+1F635-1F640,U+1F641-1F642,U+1F643-1F644,U+1F645-1F64F,U+1F680-1F6C5,U+1F6C6-1F6CF,U+1F6D0,U+1F6D1-1F6D2,U+1F6D3-1F6D4,U+1F6D5,U+1F6D6-1F6DF,U+1F6E0-1F6EC,U+1F6ED-1F6EF,U+1F6F0-1F6F3,U+1F6F4-1F6F6,U+1F6F7-1F6F8,U+1F6F9,U+1F6FA,U+1F6FB-1F6FF,U+1F774-1F77F,U+1F7D5-1F7D8,U+1F7D9-1F7DF,U+1F7E0-1F7EB,U+1F7EC-1F7FF,U+1F80C-1F80F,U+1F848-1F84F,U+1F85A-1F85F,U+1F888-1F88F,U+1F8AE-1F8FF,U+1F90C,U+1F90D-1F90F,U+1F910-1F918,U+1F919-1F91E,U+1F91F,U+1F920-1F927,U+1F928-1F92F,U+1F930,U+1F931-1F932,U+1F933-1F93A,U+1F93C-1F93E,U+1F93F,U+1F940-1F945,U+1F947-1F94B,U+1F94C,U+1F94D-1F94F,U+1F950-1F95E,U+1F95F-1F96B,U+1F96C-1F970,U+1F971,U+1F972,U+1F973-1F976,U+1F977-1F979,U+1F97A,U+1F97B,U+1F97C-1F97F,U+1F980-1F984,U+1F985-1F991,U+1F992-1F997,U+1F998-1F9A2,U+1F9A3-1F9A4,U+1F9A5-1F9AA,U+1F9AB-1F9AD,U+1F9AE-1F9AF,U+1F9B0-1F9B9,U+1F9BA-1F9BF,U+1F9C0,U+1F9C1-1F9C2,U+1F9C3-1F9CA,U+1F9CB-1F9CC,U+1F9CD-1F9CF,U+1F9D0-1F9E6,U+1F9E7-1F9FF,U+1FA00-1FA53,U+1FA54-1FA5F,U+1FA60-1FA6D,U+1FA6E-1FA6F,U+1FA70-1FA73,U+1FA74-1FA77,U+1FA78-1FA7A,U+1FA7B-1FA7F,U+1FA80-1FA82,U+1FA83-1FA8F,U+1FA90-1FA95,U+1FA96-1FFFD';

        // And then we can use that range with our font when we load it.
        const emojiOnlyFont = new FontFace(emojiFontName, 'url(fonts/NotoEmoji-Regular.ttf)', {
          unicodeRange: emojiUnicodeRange,
        });
        emojiOnlyFont.load().then(() => {
            document.fonts.add(emojiOnlyFont);
        });
        // We then set our fallback font as part of the font family we use in the canvas.
        // This order matters, latter fonts will use the unicodeRange to override earlier fonts.
        this.fontName = `Sans-serif, ${emojiFontName}`
    }

    // Some storage fields and utility properties
    private fontName: string;
    private configModalHandle: bootstrap.Modal;

    get printers() {
        return this.manager.devices;
    }

    // Track which printer is currently selected for operations
    private _activePrinter = 0;
    get activePrinter(): WebLabel.LabelPrinterUsb | undefined {
        return this._activePrinter < 0 || this._activePrinter > this.printers.length
            ? undefined
            : this.printers[this._activePrinter];
    }
    set activePrinterIndex(printerIdx: number) {
        this._activePrinter = printerIdx;
        this.redrawTextCanvas();
    }

    /** Initialize the app */
    public async init() {
        this.redrawPrinterButtons();
        this.redrawTextCanvas();
    }

    /** Display the configuration for a printer. */
    public showConfigModal(printer: WebLabel.LabelPrinterUsb, printerIdx: number) {
        if (printer == undefined) {
            return;
        }
        const config = printer.printerOptions;

        // Translate the available speeds to options to be selected
        const speedSelect = this.configModal.querySelector('#modalSpeed')! as HTMLSelectElement;
        speedSelect.innerHTML = '';
        const speedTable = printer.printerOptions.speedTable.table;
        for (const [key] of speedTable) {
            // Skip utility values, so long as there's more than the defaults.
            // Mobile printers *only* support auto, for example.
            if ((speedTable.size > 3)
                && (key === WebLabel.PrintSpeed.ipsAuto
                    || key === WebLabel.PrintSpeed.ipsPrinterMax
                    || key === WebLabel.PrintSpeed.ipsPrinterMin
            )) {
                continue;
            }
            const opt = document.createElement('option');
            opt.value = key.toString();
            opt.innerHTML = WebLabel.PrintSpeed[key].substring(3).replaceAll('_', '.') + ' ips';
            speedSelect.appendChild(opt);
        }
        speedSelect.value = config.speed.printSpeed.toString();

        (this.configModal.querySelector('#modalPrinterIndex') as HTMLInputElement)!.value            = config.serialNumber;
        (this.configModal.querySelector('#modalPrinterIndexText') as HTMLSelectElement)!.textContent = printerIdx.toString();
        (this.configModal.querySelector('#modalLabelWidth') as HTMLSelectElement)!.value             = config.mediaWidthInches.toString();
        (this.configModal.querySelector('#modalLabelHeight') as HTMLSelectElement)!.value            = config.mediaLengthInches.toString();
        (this.configModal.querySelector('#modalDarkness') as HTMLSelectElement)!.value               = config.darknessPercent.toString();
        this.configModalHandle.show();
    }

    /** Erase and re-draw the list of printer buttons in the UI. */
    private redrawPrinterButtons() {
        this.btnContainer.innerHTML = '';
        this.printers.forEach((printer, idx) => this.drawPrinterButton(printer, idx));
    }

    /** Highlight only the currently selected printer. */
    private redrawPrinterButtonHighlights() {
        this.printers.forEach((printer, idx) => {
          const highlight = this._activePrinter === idx ? "var(--bs-blue)" : "transparent";
            const element = document.getElementById(`printer_${idx}`)!;
            element.style.background = `linear-gradient(to right, ${highlight}, ${highlight}, grey, grey)`;
        });
    }

    /** Add a printer's button UI to the list of printers. */
    private drawPrinterButton(printer: WebLabel.LabelPrinterUsb, idx: number) {
        const highlight = this._activePrinter === idx ? "var(--bs-blue)" : "transparent";

        // Generate a new label printer button for the given printer.
        const element = document.createElement("div");
        element.innerHTML = `
    <li id="printer_${idx}" data-printer-idx="${idx}"
        class="list-group-item d-flex flex-row justify-content-between sligh-items-start"
        style="background: linear-gradient(to right, ${highlight}, ${highlight}, grey, grey);">
        <div class="col-sm-8">
            <div class="col-sm-12">
                <span data-serial="${printer.printerOptions.serialNumber}">${printer.printerOptions.serialNumber}</span>
            </div>
            <div class="col-sm-12">
                <span>${printer.printerOptions.mediaWidthInches}" x ${printer.printerOptions.mediaLengthInches}"</span>
            </div>
        </div>
        <div class="d-flex flex-row justify-content-end">
            <div class="btn-group" role="group" aria-label="Printer button group">
                <button id="printto_${idx}" class="btn btn-success btn-lg" data-label-width="${printer.printerOptions.mediaWidthInches}" data-label-height="${printer.printerOptions.mediaLengthInches}" data-printer-idx="${idx}">🖨</button>
                    <button class="btn btn-success dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown" aria-expanded="false">
                        <span class="visually-hidden">Settings</span>
                    </button>
                    <ul class="dropdown-menu">
                        <li><a id="printtest_${idx}" data-printer-idx="${idx}" class="dropdown-item" href="#">
                            Print test page
                        </a></li>
                        <li><a id="feedlabel_${idx}" data-printer-idx="${idx}" class="dropdown-item" href="#">
                            Feed blank label
                        </a></li>
                        <li><a id="configprinter_${idx}" data-printer-idx="${idx}" class="dropdown-item" href="#">
                            Set label config
                        </a></li>
                        <li><a id="printconfig_${idx}" data-printer-idx="${idx}" class="dropdown-item" href="#">
                            Print config on labels
                        </a></li>
                    </ul>
                </div>
            </div>
        </div>
    </li>`;
        // And slap it into the button container.
        this.btnContainer.appendChild(element);

        // Then wire up the button events so they work.
        document.getElementById(`printto_${idx}`)!
            .addEventListener('click', async (e) => {
                e.preventDefault();
                const printerIdx = (e.currentTarget as HTMLAnchorElement).dataset.printerIdx as unknown as number;
                const printer = this.printers[printerIdx];
                const doc = this.addCanvasImageToLabelDoc(printer.getLabelDocument());
                await printer.sendDocument(doc);
            });
        document.getElementById(`printer_${idx}`)!
            .addEventListener('click', async (e) => {
                e.preventDefault();
                const printerIdx = (e.currentTarget as HTMLAnchorElement).dataset.printerIdx as unknown as number;
                if (this._activePrinter === printerIdx) {
                    // Don't refresh anything if we already have this printer selected..
                    return;
                }
                this.activePrinterIndex = printerIdx;
                this.redrawPrinterButtonHighlights();
                this.redrawTextCanvas();
            });
        document.getElementById(`printtest_${idx}`)!
            .addEventListener('click', async (e) => {
                e.preventDefault();
                const printerIdx = (e.currentTarget as HTMLAnchorElement).dataset.printerIdx as unknown as number;
                const printer = this.printers[printerIdx];
                const doc = WebLabel.ReadyToPrintDocuments.printTestLabelDocument(
                    printer.printerOptions.mediaWidthDots);
                await printer.sendDocument(doc);
            });
        document.getElementById(`feedlabel_${idx}`)!
            .addEventListener('click', async (e) => {
                e.preventDefault();
                const printerIdx = (e.currentTarget as HTMLAnchorElement).dataset.printerIdx as unknown as number;
                const printer = this.printers[printerIdx];
                const doc = WebLabel.ReadyToPrintDocuments.feedLabelDocument;
                await printer.sendDocument(doc);
            });
        document.getElementById(`printconfig_${idx}`)!
            .addEventListener('click', async (e) => {
                e.preventDefault();
                const printerIdx = (e.currentTarget as HTMLAnchorElement).dataset.printerIdx as unknown as number;
                const printer = this.printers[printerIdx];
                const doc = WebLabel.ReadyToPrintDocuments.printConfigDocument;
                await printer.sendDocument(doc);
            });
        document.getElementById(`configprinter_${idx}`)!
            .addEventListener('click', async (e) => {
                e.preventDefault();
                const printerIdx = (e.currentTarget as HTMLAnchorElement).dataset.printerIdx as unknown as number;
                const printer = this.printers[printerIdx];
                this.showConfigModal(printer, printerIdx);
            });
    }

    /** Redraw the text canvas size according to the printer. */
    private redrawTextCanvas() {
        const printer = this.activePrinter;
        if (printer === undefined) {
            this.labelForm.classList.add('d-none');
            this.labelFormInstructions.classList.remove('d-none');
            return;
        } else {
            this.labelForm.classList.remove('d-none');
            this.labelFormInstructions.classList.add('d-none');
        }

        // Resize the canvas to match the label size.
        const canvas = this.labelForm.querySelector("#labelCanvas") as HTMLCanvasElement;
        // Add a small margin as printer alignment is not exact.
        canvas.width = printer.printerOptions.mediaWidthDots - 2;
        canvas.height = printer.printerOptions.mediaLengthDots - 2;

        const textarea = this.labelForm.querySelector('#labelFormText') as HTMLTextAreaElement;
        textarea.value = "Enter your label text here!";
        this.renderTextForm();
    }

    /** Render the text form to the canvas */
    private renderTextForm() {
        const printer = this.activePrinter;
        if (printer === undefined) {
            return;
        }

        const textarea = this.labelForm.querySelector('#labelFormText') as HTMLTextAreaElement;
        const canvas = this.labelForm.querySelector("#labelCanvas") as HTMLCanvasElement;
        const pageContext = canvas.getContext('2d')!;
        pageContext.clearRect(0, 0, canvas.width, canvas.height);

        const fontSize = 30;

        // We'd like the preview image to be as close as possible to what the printer will
        // actually print. To do this we don't draw text to the page's canvas directly,
        // instead we draw to an offscreen canvas, render that canvas to a monochrome bitmap,
        // then render *that* back to the page's canvas. This is a more accurate picture of
        // what the label will end up looking like.

        // A more complex app could do this more gracefully!
        const offscreenContext = new OffscreenCanvas(canvas.width, canvas.height).getContext('2d')!;
        offscreenContext.font = `${fontSize}pt ${this.fontName}`;
        offscreenContext.fillStyle = "#000000";

        // fillText doesn't do newlines, do that manually
        textarea.value.split('\n').forEach((l, i) => {
            offscreenContext.fillText(l, 5, (i * fontSize + 2) + fontSize);
        })

        // Now into the monochrome bitmap.
        const offscreenImg = offscreenContext.getImageData(0, 0, canvas.width, canvas.height);
        const monoImg = WebLabel.BitmapGRF.fromCanvasImageData(offscreenImg, { trimWhitespace: false });
        // And finally back onto the page.
        pageContext.putImageData(monoImg.toImageData(), 0, 0);
    }

    /** Render the canvas to a document for printing */
    private addCanvasImageToLabelDoc(builder: WebLabel.ILabelDocumentBuilder): WebLabel.IDocument {
        const canvas = this.labelForm.querySelector("#labelCanvas") as HTMLCanvasElement;
        const imgData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);

        // One of the benefits of this library is being able to render images to a canvas element
        // and sending that canvas directly to a label. This allows your webpage to generate complex
        // images and fonts (like emoji!) that EPL/ZPL can't support.
        return builder
            .addImageFromImageData(imgData)
            .addPrintCmd()
            .finalize();
    }

    /** Send the contents of the config form as a config label to the printer. */
    private async updatePrinterConfig(e: SubmitEvent) {
        e.preventDefault();

        // Figure out the right printer
        const formElement = this.configModal.querySelector('form')!;
        const form = formElement.elements as ConfigModalForm;
        const printerIdx = parseInt((formElement.querySelector('#modalPrinterIndexText') as HTMLFormElement).innerText);
        const printer = this.printers[printerIdx];
        if (printer === undefined) {
            return;
        }

        form.modalSubmit.setAttribute("disabled", "");
        form.modalCancel.setAttribute("disabled", "");

        // Pull the values out of the form.
        const darkness         = parseInt(form.modalDarkness.value) as WebLabel.DarknessPercent;
        const rawSpeed         = parseInt(form.modalSpeed.value) as WebLabel.PrintSpeed;
        const mediaWidthInches = parseFloat(form.modalLabelWidth.value);
        const autosense        = form.modalWithAutosense.checked;

        // Construct the config document with the values from the form
        const configDoc = printer.getConfigDocument();

        configDoc
            .setPrintDirection()
            .setLabelHomeOffsetDots(0, 0)
            .setPrintSpeed(rawSpeed)
            .setDarknessConfig(darkness)
            .setLabelDimensions(mediaWidthInches);
        const doc = autosense
            ? configDoc.autosenseLabelLength()
            : configDoc.finalize();
        // And send the whole shebang to the printer!
        await printer.sendDocument(doc);

        form.modalSubmit.removeAttribute("disabled");
        form.modalCancel.removeAttribute("disabled");
        this.activePrinterIndex = printerIdx;
        this.configModalHandle.hide();
    }
}

// With the app class defined we can run it.
// First up collect the basic structure of the app
const btnContainer          = document.getElementById("printerlist")!;
const labelForm             = document.getElementById("labelForm")!;
const labelFormInstructions = document.getElementById("labelFormInstructions")!;
const configModal           = document.getElementById("printerOptionModal")!;

// And feed that into the app class to manage the elements
const app = new BasicLabelDesignerApp(printerMgr, btnContainer, labelForm, labelFormInstructions, configModal);
// and let it take over the UI.
await app.init();

// Make the TypeScript type system happy by adding a property to the Window object.
declare global {
  interface Window { printer_app: BasicLabelDesignerApp }
}
// Now we can access our printer in the dev console if we want to mess with it!
window.printer_app = app;

// Now we'll fire the reconnect since our UI is wired up.
await printerMgr.forceReconnect();

// We're done here. Bring in the dancing lobsters.
