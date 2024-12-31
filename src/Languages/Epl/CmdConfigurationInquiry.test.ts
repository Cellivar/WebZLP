import { expect, describe, it } from 'vitest';
import { parseConfigResponse, tryGetModel } from './CmdConfigurationInquiry.js';
import type { ISettingUpdateMessage } from '../../Commands/Messages.js';
import { MediaMediaGapDetectionMode, ThermalPrintMode } from '../../Configs/ConfigurationTypes.js';

describe("CmdConfigurationInquiry", () => {
  it('Rejects empty message', () => {
    const result = parseConfigResponse("", undefined!);
    expect(result.messages).toStrictEqual([]);
    expect(result.remainder).toStrictEqual("");
  });

  function getMsg(cfg: string): ISettingUpdateMessage {
    const result = parseConfigResponse(`
UKQ1935HLU       V4.70.1A
${cfg}`, undefined!);
    const msg = (result.messages[0] as ISettingUpdateMessage);
    return msg;
  }

  describe('Individual config lines', () => {
    it('Line A', () => {
      const msg = getMsg("");
      expect(msg.printerHardware?.firmware).toBe("V4.70.1A");
      expect(msg.printerHardware?.model).toBe("LP2844");
    });
    it('S/N Line', () => {
      const msg = getMsg("S/N: 42A000001234");
      expect(msg.printerHardware?.serialNumber).toBe("42A000001234");
    });
    it('Line B wrong', () => {
      const msg = `
UKQ1935HLU       V4.70.1A
Line Mode   `;
      expect(() => parseConfigResponse(msg, undefined!)).toThrow();
    });
    // Line B is serial port, ignored.
    // Line C is Page Mode, ignored.
    // Line D is a test pattern when printed.
    // Line E is image buffer size
    // Line F Form memory
    // Line G Graphics memory
    // Line H Font memory
    // Line I Total free memory
    it('Line J', () => {
      const msg = getMsg("I8,0,001 rY JF WY");
      expect(msg.printerSettings?.backfeedAfterTaken).toBe('100');
      const msg2 = getMsg("I8,0,001 rY JB WY");
      expect(msg2.printerSettings?.backfeedAfterTaken).toBe('disabled');
    });
    it('Line K', () => {
      const msg = getMsg("S4 D00 R0,0 ZT UN");
      expect(msg.printerMedia?.speed).toMatchInlineSnapshot(`
        PrintSpeedSettings {
          "printSpeed": 7,
          "slewSpeed": 7,
        }
      `);
    });
    it('Line L web sense media', () => {
      const msg = getMsg("q832 Q1022,029+05");
      expect(msg.printerMedia?.mediaGapDetectMode).toBe(MediaMediaGapDetectionMode.webSensing);
      expect(msg.printerMedia?.mediaWidthDots).toBe(812);
      expect(msg.printerMedia?.mediaLengthDots).toBe(1015);
      expect(msg.printerMedia?.mediaGapDots).toBe(29);
      expect(msg.printerMedia?.mediaLineOffsetDots).toBe(5);
    });
    it('Line L gapless media', () => {
      const msg = getMsg("q328 Q163,0");
      expect(msg.printerMedia?.mediaGapDetectMode).toBe(MediaMediaGapDetectionMode.continuous);
      expect(msg.printerMedia?.mediaLengthDots).toBe(0);
      expect(msg.printerMedia?.mediaGapDots).toBe(163);
    });
    it('Line L black line media', () => {
      const msg = getMsg("q816 Q56,B189-4");
      expect(msg.printerMedia?.mediaGapDetectMode).toBe(MediaMediaGapDetectionMode.markSensing);
      expect(msg.printerMedia?.mediaLengthDots).toBe(50);
      expect(msg.printerMedia?.mediaGapDots).toBe(189);
      expect(msg.printerMedia?.mediaLineOffsetDots).toBe(-4);
    });
    it('Line M', () => {
      const msg = getMsg("Option:d,Ff");
      expect(msg.printerMedia?.thermalPrintMode).toBe(ThermalPrintMode.direct);
    });
    // Line N is autosense values
    // Line O is cover sensor
    // Line P is date and time
    // Line Q is dump mode
  });

  describe('Real configs', () => {
    it('Real config 1', () => {
      const real_config_1 = `
UKQ1935HLU V4.59
S/N: 42A000000069
Serial port:96,N,8,1
Page mode
Image buffer size:0245K
Fmem used: 25 (bytes)
Gmem used: 0
Emem used: 29600
Available: 100934
I8,10,001 rN JF WY
S2 D06 R248,0 ZT UN
q328 Q163,0 Ymax:5992
Option: D,Ff
oEv,w,x,y,z
00 04 08
Cover: T=137, C=147
`;
      const result = parseConfigResponse(real_config_1, undefined!);
      expect(result.messages).toMatchInlineSnapshot(`
        [
          {
            "messageType": "SettingUpdateMessage",
            "printerHardware": {
              "dpi": 203,
              "firmware": "V4.59",
              "manufacturer": "Zebra Corporation",
              "maxMediaDarkness": 15,
              "maxMediaLengthDots": 2223,
              "maxMediaWidthDots": 832,
              "model": "LP2844",
              "serialNumber": "42A000000069",
              "speedTable": SpeedTable {
                "speedTable": Map {
                  3 => 1,
                  4 => 2,
                  5 => 3,
                  7 => 4,
                  1 => 1,
                  1000 => 4,
                  0 => 3,
                },
              },
            },
            "printerMedia": {
              "darknessPercent": 40,
              "mediaGapDetectMode": 0,
              "mediaGapDots": 163,
              "mediaLengthDots": 0,
              "mediaLineOffsetDots": 0,
              "mediaPrintOriginOffsetDots": {
                "left": 248,
                "top": 0,
              },
              "mediaWidthDots": 304,
              "printOrientation": 1,
              "speed": PrintSpeedSettings {
                "printSpeed": 4,
                "slewSpeed": 4,
              },
              "thermalPrintMode": 0,
            },
            "printerSettings": {
              "backfeedAfterTaken": "100",
              "feedButtonMode": "feedBlank",
            },
          },
        ]
      `);
    });

    it('Read config 2', () => {
      const real_config_2 = `
UKQ1935HLU       V4.70.1A
S/N: 42A000000022
Serial port:96,N,8,1
Page Mode
Image buffer size:0507K
Fmem used: 0 (bytes)
Gmem used: 0
Emem used: 151215
Available: 503632
I8,0,001 rY JF WY
S4 D10 R8,0 ZT UN
q816 Q923,25
Option:D,Ff
oEv,w,x,y,z
15 21 28
Cover: T=144, C=167
`;
      const result = parseConfigResponse(real_config_2, undefined!);
      expect(result.messages).toMatchInlineSnapshot(`
        [
          {
            "messageType": "SettingUpdateMessage",
            "printerHardware": {
              "dpi": 203,
              "firmware": "V4.70.1A",
              "manufacturer": "Zebra Corporation",
              "maxMediaDarkness": 15,
              "maxMediaLengthDots": 2223,
              "maxMediaWidthDots": 832,
              "model": "LP2844",
              "serialNumber": "42A000000022",
              "speedTable": SpeedTable {
                "speedTable": Map {
                  3 => 1,
                  4 => 2,
                  5 => 3,
                  7 => 4,
                  1 => 1,
                  1000 => 4,
                  0 => 3,
                },
              },
            },
            "printerMedia": {
              "darknessPercent": 67,
              "mediaGapDetectMode": 1,
              "mediaGapDots": 25,
              "mediaLengthDots": 913,
              "mediaLineOffsetDots": 0,
              "mediaPrintOriginOffsetDots": {
                "left": 8,
                "top": 0,
              },
              "mediaWidthDots": 812,
              "printOrientation": 1,
              "speed": PrintSpeedSettings {
                "printSpeed": 7,
                "slewSpeed": 7,
              },
              "thermalPrintMode": 0,
            },
            "printerSettings": {
              "backfeedAfterTaken": "100",
              "feedButtonMode": "feedBlank",
            },
          },
        ]
      `);
    });

    it('Read config 3', () => {
      const real_config_3 = `
UKQ1935HMU  FDX V4.45
HEAD    usage =     249,392"
PRINTER usage =     249,392"
Serial port:96,N,8,1
Image buffer size:0225K
Fmem used: 0 (bytes)
Gmem used: 0
Emem used: 0
Available: 130559
I8,A,001 rY JF WY
S4 D10 R000,000 ZT UN
q832 Q934,24
Option:D
13 18 24
Cover: T=118, C=129
`;
      const result = parseConfigResponse(real_config_3, undefined!);
      expect(result.messages).toMatchInlineSnapshot(`
        [
          {
            "messageType": "SettingUpdateMessage",
            "printerHardware": {
              "dpi": 203,
              "firmware": "V4.45",
              "manufacturer": "Zebra Corporation",
              "maxMediaDarkness": 15,
              "maxMediaLengthDots": 2223,
              "maxMediaWidthDots": 832,
              "model": "LP2844",
              "speedTable": SpeedTable {
                "speedTable": Map {
                  3 => 1,
                  4 => 2,
                  5 => 3,
                  7 => 4,
                  1 => 1,
                  1000 => 4,
                  0 => 3,
                },
              },
            },
            "printerMedia": {
              "darknessPercent": 67,
              "mediaGapDetectMode": 1,
              "mediaGapDots": 24,
              "mediaLengthDots": 913,
              "mediaLineOffsetDots": 0,
              "mediaPrintOriginOffsetDots": {
                "left": 0,
                "top": 0,
              },
              "mediaWidthDots": 812,
              "printOrientation": 1,
              "speed": PrintSpeedSettings {
                "printSpeed": 7,
                "slewSpeed": 7,
              },
              "thermalPrintMode": 0,
            },
            "printerSettings": {
              "backfeedAfterTaken": "100",
            },
          },
        ]
      `);
    });

    it('Real config 4', () => {
      const real_config_4 = `
UKQ1935HLU       V4.70.1A
S/N: 42A000000044
Serial port:96,N,8,1
Page Mode
Image buffer size:0245K
Fmem used: 0 (bytes)
Gmem used: 0
Emem used: 29600
Available: 100959
I8,A,001 rY JF WN
S4 D11 R104,0 ZB UN
q616 Q56,169
Option:d,S,Ff
oEv,w,x,y,z
12 21 30
Cover: T=120, C=141`;
      const result = parseConfigResponse(real_config_4, undefined!);
      expect(result.messages).toMatchInlineSnapshot(`
        [
          {
            "messageType": "SettingUpdateMessage",
            "printerHardware": {
              "dpi": 203,
              "firmware": "V4.70.1A",
              "manufacturer": "Zebra Corporation",
              "maxMediaDarkness": 15,
              "maxMediaLengthDots": 2223,
              "maxMediaWidthDots": 832,
              "model": "LP2844",
              "serialNumber": "42A000000044",
              "speedTable": SpeedTable {
                "speedTable": Map {
                  3 => 1,
                  4 => 2,
                  5 => 3,
                  7 => 4,
                  1 => 1,
                  1000 => 4,
                  0 => 3,
                },
              },
            },
            "printerMedia": {
              "darknessPercent": 74,
              "mediaGapDetectMode": 1,
              "mediaGapDots": 169,
              "mediaLengthDots": 50,
              "mediaLineOffsetDots": 0,
              "mediaPrintOriginOffsetDots": {
                "left": 104,
                "top": 0,
              },
              "mediaWidthDots": 609,
              "printOrientation": 0,
              "speed": PrintSpeedSettings {
                "printSpeed": 7,
                "slewSpeed": 7,
              },
              "thermalPrintMode": 0,
            },
            "printerSettings": {
              "backfeedAfterTaken": "100",
              "feedButtonMode": "feedBlank",
            },
          },
        ]
      `);
    });

    it('Real config 5', () => {
      const real_config_5 = `
UKQ1935H U  UPS V4.51
S/N: 64A060601536
Serial port:96,N,8,1
Image buffer size:0245K
Fmem used: 0 (bytes)
Gmem used: 7443
Emem used: 9732
Available: 113384
I8,A,001 rY JF WN
S4 D08 R008,000 ZB UN
q816 Q56,189+4
Option:d,S
oUs,t,u
09 14 20 `;
      const result = parseConfigResponse(real_config_5, undefined!);
      expect(result.messages).toMatchInlineSnapshot(`
        [
          {
            "messageType": "SettingUpdateMessage",
            "printerHardware": {
              "dpi": 203,
              "firmware": "V4.51",
              "manufacturer": "Zebra Corporation",
              "maxMediaDarkness": 15,
              "maxMediaLengthDots": 2223,
              "maxMediaWidthDots": 832,
              "model": "LP2844",
              "serialNumber": "64A060601536",
              "speedTable": SpeedTable {
                "speedTable": Map {
                  3 => 1,
                  4 => 2,
                  5 => 3,
                  7 => 4,
                  1 => 1,
                  1000 => 4,
                  0 => 3,
                },
              },
            },
            "printerMedia": {
              "darknessPercent": 54,
              "mediaGapDetectMode": 1,
              "mediaGapDots": 189,
              "mediaLengthDots": 50,
              "mediaLineOffsetDots": 4,
              "mediaPrintOriginOffsetDots": {
                "left": 8,
                "top": 0,
              },
              "mediaWidthDots": 812,
              "printOrientation": 0,
              "speed": PrintSpeedSettings {
                "printSpeed": 7,
                "slewSpeed": 7,
              },
              "thermalPrintMode": 0,
            },
            "printerSettings": {
              "backfeedAfterTaken": "100",
            },
          },
        ]
      `);
    });

    it('Real Config 6', () => {
      const real_config_6 = `
FDX ZP 500 (ZPL) ZSP-002281B
S/N: 27J130201516
HEAD    usage =       43,551"
PRINTER usage =       43,551"
Serial Port: 96,N,8,1
Page Mode
RAM size: 2054496
Fmem used: 0 (bytes)
Gmem used: 0
Emem used: 0
Available: 1516992
I8,A,001 JF WY
S3 D11 R000,000 ZB UN
q832 Q1218,0 Ymax:5000 eR$,0
Option:D,Ff
oEv,w,x,y,z
00 05 31`;
      const result = parseConfigResponse(real_config_6, undefined!);
      expect(result.messages).toMatchInlineSnapshot(`
        [
          {
            "messageType": "SettingUpdateMessage",
            "printerHardware": {
              "dpi": 203,
              "firmware": "ZSP-002281B",
              "manufacturer": "Zebra Corporation",
              "maxMediaDarkness": 15,
              "maxMediaLengthDots": 2223,
              "maxMediaWidthDots": 448,
              "model": "FDX ZP 500",
              "serialNumber": "27J130201516",
              "speedTable": SpeedTable {
                "speedTable": Map {
                  4 => 2,
                  6 => 3,
                  8 => 4,
                  9 => 5,
                  1 => 2,
                  1000 => 5,
                  0 => 4,
                },
              },
            },
            "printerMedia": {
              "darknessPercent": 74,
              "mediaGapDetectMode": 0,
              "mediaGapDots": 1218,
              "mediaLengthDots": 0,
              "mediaLineOffsetDots": 0,
              "mediaPrintOriginOffsetDots": {
                "left": 0,
                "top": 0,
              },
              "mediaWidthDots": 812,
              "printOrientation": 0,
              "speed": PrintSpeedSettings {
                "printSpeed": 6,
                "slewSpeed": 6,
              },
              "thermalPrintMode": 0,
            },
            "printerSettings": {
              "feedButtonMode": "feedBlank",
            },
          },
        ]
      `);
    });
  });

  describe('tryGetModel', () => {
    it('Gets a real model', () => {
      const id = "LP2844";
      expect(tryGetModel(id)).not.toBeUndefined();
    });
    it('Gets undefined for weirdness', () => {
      const id = "XDG9954";
      expect(tryGetModel(id)).toBeUndefined();
    })
  });
})
