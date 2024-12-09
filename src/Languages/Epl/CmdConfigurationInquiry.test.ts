import { expect, describe, it } from 'vitest';
import { parseConfigResponse, tryGetModel } from './CmdConfigurationInquiry.js';


describe("CmdConfigurationInquiry", () => {
  it('Rejects empty message', () => {
    const result = parseConfigResponse("", undefined!);
    expect(result.messages).toStrictEqual([]);
    expect(result.remainder).toStrictEqual("");
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
              "mediaGapDots": 0,
              "mediaLengthDots": 152,
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
          },
        ]
      `);
    });

    it('Read config 2', () => {
      const real_config_2 = `
UKQ1935HLU       V4.70.1A
S/N: 42A000000000
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
              "serialNumber": "42A000000000",
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
            "headDistanceIn": 249392,
            "messageType": "SettingUpdateMessage",
            "printerDistanceIn": 249392,
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
          },
        ]
      `);
    });

    it('Real config 4', () => {
      const real_config_4 = `
UKQ1935HLU       V4.70.1A
S/N: 42A000000000
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
              "serialNumber": "42A000000000",
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
