const PrinterType = require("./printer-type");

class Bixolon extends PrinterType {
    constructor() {
        super();
        this.config = require('./bixolon-config');
        this.nvImgBuffer = null;
    }

    // ------------------------------ Append ------------------------------
    append(appendBuffer) {
        if (this.buffer) {
            this.buffer = Buffer.concat([this.buffer, appendBuffer]);
        } else {
            this.buffer = appendBuffer;
        }
    }

    // ------------------------------ Beep ------------------------------
    beep() {
        return this.config.BEEP;
    }

    // ----------------------- Select Print Color -----------------------
    selectPrintColor(mode) {
        this.buffer = null;
        // [Name] Select the print color
        // [Code] 1B 72 mode
        // mode
        // [0 x0, black]
        // [48 x30 black]
        // [1 x01, red]
        // [49 x31 red]
        
        const modeWhitelist = [0, 1, 48, 49];
        if (!modeWhitelist.includes(mode)) return this.buffer;

        this.append(Buffer.from([0x1B, 0x72, mode]));
        return this.buffer;
    }


    // ------------------------------ Set text size ------------------------------
    setTextSize(height, width) {
        this.buffer = null;
        if (height > 7 || height < 0) throw new Error("setTextSize: Height must be between 0 and 7");
        if (width > 7 || width < 0) throw new Error("setTextSize: Width must be between 0 and 7");
        let x = Buffer.from(height + "" + width, "hex");
        this.append(Buffer.from([0x1D, 0x21]));
        this.append(x);
        return this.buffer;
    }


    // ------------------------------ QR ------------------------------
    printQR(str, settings) {
        this.buffer = null;
        settings = settings || {};

        // [Name] Select the QR code model
        // [Code] 1D 28 6B 04 00 31 41 n1 n2
        // n1
        // [49 x31, model 1]
        // [50 x32, model 2]
        // n2 = 0
        // https://images10.newegg.com/UploadFilesForNewegg/itemintelligence/BIXOLON/srp_350ii_command_20manual_rev_1_011403846995257.pdf
        if (settings.model) {
            if (settings.model === 1) this.append(this.config.QRCODE_MODEL1);
            else this.append(this.config.QRCODE_MODEL2);
        } else {
            this.append(this.config.QRCODE_MODEL2);
        }

        // [Name]: Set the size of module
        // 1D 28 6B 03 00 31 43 n
        // n depends on the printer
        // https://images10.newegg.com/UploadFilesForNewegg/itemintelligence/BIXOLON/srp_350ii_command_20manual_rev_1_011403846995257.pdf
        if (settings.cellSize) {
            let i = "QRCODE_CELLSIZE_".concat(settings.cellSize.toString());
            this.append(this.config[i]);
        } else {
            this.append(this.config.QRCODE_CELLSIZE_3);
        }


        // [Name] Select the error correction level
        // 1D 28 6B 03 00 31 45 n
        // n
        // [48 x30 -> 7%]
        // [49 x31-> 15%]
        // [50 x32 -> 25%]
        // [51 x33 -> 30%]
        // http://tv.seumtech.kr/BIXOLON%20command%20manual_rev_1_01.pdf
        if (settings.correction) {
            let i = "QRCODE_CORRECTION_".concat(settings.correction.toUpperCase());
            this.append(this.config[i]);
        } else {
            this.append(this.config.QRCODE_CORRECTION_M)
        }


        // [Name] Store the data in the symbol storage area
        // 1D 28  6B pL pH 31 50 30 d1...dk
        // http://tv.seumtech.kr/BIXOLON%20command%20manual_rev_1_01.pdf
        let s = str.length + 3;
        let lsb = parseInt(s % 256);
        let msb = parseInt(s / 256);
        this.append(Buffer.from([0x1d, 0x28, 0x6b, lsb, msb, 0x31, 0x50, 0x30]));
        this.append(Buffer.from(str));


        // [Name] Print the symbol data in the symbol storage area
        // 1D 28 6B 03 00 31 51 m
        // http://tv.seumtech.kr/BIXOLON%20command%20manual_rev_1_01.pdf
        this.append(this.config.QRCODE_PRINT);

        return this.buffer;
    }


    // ------------------------------ PDF417 ------------------------------
    pdf417(data, settings) {
        this.buffer = null;
        settings = settings || {};

        // Set error correction ratio 1 - 40
        if (settings.correction) {
            this.append(this.config.PDF417_CORRECTION);
            this.append(Buffer.from([settings.correction]));
        } else {
            this.append(this.config.PDF417_CORRECTION);
            this.append(Buffer.from([0x01]))
        }

        // Set row height 2 - 8
        if (settings.rowHeight) {
            this.append(this.config.PDF417_ROW_HEIGHT);
            this.append(Buffer.from([settings.rowHeight]));
        } else {
            this.append(this.config.PDF417_ROW_HEIGHT);
            this.append(Buffer.from([0x03]))
        }

        // Set width of module 2 - 8
        if (settings.width) {
            this.append(this.config.PDF417_WIDTH);
            this.append(Buffer.from([settings.width]));
        } else {
            this.append(this.config.PDF417_WIDTH);
            this.append(Buffer.from([0x03]))
        }

        // Manually set columns 1 - 30
        if (settings.columns) {
            this.append(this.config.PDF417_COLUMNS);
            this.append(Buffer.from([settings.columns]));
        } else {
            // Default to auto
            this.append(this.config.PDF417_COLUMNS);
            this.append(Buffer.from([0x00]));
        }

        // Standard or truncated option
        if (settings.truncated) this.append(this.config.PDF417_OPTION_TRUNCATED);
        else this.append(this.config.PDF417_OPTION_STANDARD);

        // Set PDF417 bar code data
        let s = data.length + 3;
        let lsb = parseInt(s % 256);
        let msb = parseInt(s / 256);

        this.append(Buffer.from([0x1d, 0x28, 0x6b, lsb, msb, 0x30, 0x50, 0x30]));
        this.append(Buffer.from(data.toString()));

        // Print barcode
        this.append(Buffer.from(this.config.PDF417_PRINT));

        return this.buffer;
    }


    // ------------------------------ MAXI CODE ------------------------------
    maxiCode(data, settings) {
        // TODO: Only fire this on supported models
        this.buffer = null;
        settings = settings || {};

        // Maxi Mode
        // 2 - Formatted data/structured Carrier Message with a numeric postal code. (US)
        // 3 - Formatted data/structured Carrier Message with a numeric postal code. (International)
        // 4 - Unformatted data/Standard Error Correction.
        // 5 - Unformatted data/Enhanced Error Correction.
        // 6 - Used for programming hardware devices.

        if (settings.mode) {
            if (settings.mode == 2) this.append(this.config.MAXI_MODE2);
            else if (settings.mode == 3) this.append(this.config.MAXI_MODE3);
            else if (settings.mode == 5) this.append(this.config.MAXI_MODE5);
            else if (settings.mode == 6) this.append(this.config.MAXI_MODE6);
            else this.append(this.config.MAXI_MODE4);
        } else {
            this.append(this.config.MAXI_MODE4);
        }

        // Setup size of MaxiCode data
        let s = data.length + 3;
        let lsb = parseInt(s % 256);
        let msb = parseInt(s / 256);

        // Send Data
        this.append(Buffer.from([0x1d, 0x28, 0x6b, lsb, msb, 0x32, 0x50, 0x30]));
        this.append(Buffer.from(data.toString()));

        // Print barcode
        this.append(this.config.MAXI_PRINT);

        return this.buffer;
    }


    // ------------------------------ NV IMAGE ------------------------------
    async loadNVImages(imagesInfo) {
        console.error(new Error("'loadNVImages' not finished implementing yet"));
        return null;

        this.buffer = null;

        let fs = require('fs');
        let PNG = require('pngjs').PNG;

        try {
            // Define NV bit image command (FS q)
            // FS   q   n   [xL xH yL yH d1...dk]1...   [xL xH yL yH d1...dk]n
            // 1C   71  num [xL xH yL yH d1...dk]1...   [xL xH yL yH d1...dk]num
            // REFERENCE: https://postorg.com.ua/published/file/999905/Manual_SRP-275IIICommand_english_Rev_1_01.pdf
            this.append(Buffer.from([0x1c, 0x71, imagesInfo.length]));

            for (let idx = 0; idx < imagesInfo.length; idx++) {
                const imageInfo = imagesInfo[idx];
                const { path, filetype } = imageInfo;
                const data = fs.readFileSync(path);

                if (filetype.toString().includes("png")) {
                    const png = PNG.sync.read(data);
                    const buff = this.generateNVImageBuffer(png.width, png.height, png.data);
                    console.log(png.width, png.height);
                    this.append(buff);
                }
            };

            return this.buffer;
        } catch (error) {
            throw error;
        }
    }

    generateNVImageBuffer(imgWidth, imgHeight, data) {
        let nvImageBuffer = Buffer.from([]);
        const imgWidthBytes = Math.ceil((imgWidth + 7) / 8);
        const imgHeightBytes = Math.ceil((imgHeight + 7) / 8);
        const bytesByLine = imgHeightBytes;

        // Get pixel rgba in 2D array
        let pixels = [];
        for (let i = 0; i < imgHeight; i++) {
            let line = [];
            for (let j = 0; j < imgWidth; j++) {
                let idx = (imgWidth * i + j) << 2;
                line.push({
                    r: data[idx],
                    g: data[idx + 1],
                    b: data[idx + 2],
                    a: data[idx + 3]
                });
            }
            pixels.push(line);
        }


        let imageBuffer_array = [];
        for (let j = 0; j < imgWidth; j++) {
            for (let loopIdx = 0; loopIdx < 8; ++loopIdx) {
                for (let i = 0; i < imgHeight; i += 8) {
                    let byte = 0x0;
                    for (let k = 0; k < 8; k++) {
                        const pixelRow = i + k;
                        const pixelCol = j;

                        let pixel = (pixels[pixelRow] || [])[pixelCol];

                        // Image overflow
                        if (pixel == null) {
                            pixel = {
                                a: 0,
                                r: 0,
                                g: 0,
                                b: 0
                            };
                        }

                        if (pixel.a > 126) { // checking transparency
                            let grayscale = parseInt(0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b);

                            if (grayscale < 128) { // checking color
                                let mask = 1 << (7 - k); // setting bitwise mask
                                byte |= mask; // setting the correct bit to 1
                            }
                        }
                    }

                    imageBuffer_array.push(byte);
                }
            }
        }

        // Define NV bit image
        // xL = (this.width >> 8) & 0xff;
        // xH = 0x00;
        // yL = this.height & 0xff;
        // yH = (this.height >> 8) & 0xff;
        // REFERENCE: https://postorg.com.ua/published/file/999905/Manual_SRP-275IIICommand_english_Rev_1_01.pdf

        const xH = Math.floor(imgWidth / 256);
        const xL = imgWidth - (xH * 256);
        const yH = Math.floor(bytesByLine / 256);
        const yL = bytesByLine - (yH * 256);

        nvImageBuffer = Buffer.concat([nvImageBuffer, Buffer.from([xL])]);
        nvImageBuffer = Buffer.concat([nvImageBuffer, Buffer.from([xH])]);
        nvImageBuffer = Buffer.concat([nvImageBuffer, Buffer.from([yL])]);
        nvImageBuffer = Buffer.concat([nvImageBuffer, Buffer.from([yH])]);

        // append data
        nvImageBuffer = Buffer.concat([nvImageBuffer, Buffer.from(imageBuffer_array)]);

        return nvImageBuffer;
    }

    printNVImage(num, mode) {
        console.error(new Error("'printNVImage' not finished implementing yet"));
        return null;

        this.buffer = null;
        this.append(Buffer.from([0x1c, 0x70, num, mode]));

        return this.buffer;
    }


    // ------------------------------ BARCODE ------------------------------
    printBarcode(data, type, settings) {
        const JsBarcode = require("jsbarcode");
        const { createCanvas } = require("canvas");
        const canvas = createCanvas();
        const PNG = require('pngjs').PNG;
        settings = settings || {};

        const barcodeType = (() => {
            switch (type) {
                case 0:
                case 1:
                case 65:
                case 66: return "UPC";
                case 2:
                case 67: return "EAN13";
                case 3:
                case 68: return "EAN8";
                case 4:
                case 69: return "CODE39";
                case 5:
                case 70: return "ITF14";
                case 6:
                case 71: return "codabar"
                case 73:
                case 79: return "CODE128";

                default:
                    return "CODE128";
            }
        })();

        JsBarcode(canvas, data, { format: barcodeType, width: 1, height: 32, displayValue: false });
        const barcodePNG = PNG.sync.read(canvas.toBuffer());
        const buff = this.printImageBuffer(barcodePNG.width, barcodePNG.height, barcodePNG.data);
        return buff;
    }


    // ----------------------------------------------------- PRINT IMAGE -----------------------------------------------------
    async printImage(image, filetype = "png") {
        let fs = require('fs');
        let PNG = require('pngjs').PNG;
        let BMP = require('bmp-js');
        const sharp = require('sharp');

        try {
            const data = fs.readFileSync(image);
            if (filetype === "png") {
                const png = await (async () => {
                    const pngFromData = PNG.sync.read(data);
                    if (pngFromData == null) return null;

                    if (pngFromData.height > 60) {
                        const resizedImageData = await sharp(data).resize(null, 60).toBuffer();
                        return PNG.sync.read(resizedImageData);
                    }

                    if (pngFromData.width > 100) {
                        const resizedImageData = await sharp(data).resize(100, null).toBuffer();
                        return PNG.sync.read(resizedImageData);
                    }

                    return pngFromData;
                })();

                if (png == null) return Buffer.from([]);

                const buff = this.printImageBuffer(png.width, png.height, png.data, 1, false);
                return buff;
            }
            else if (filetype === "bmp") {
                const bmp = BMP.decode(data);
                const buff = this.printBMP(bmp.width, bmp.height, data);
                return buff;
            }
        } catch (error) {
            throw error;
        }
    }

    printBMP(width, height, data) {
        console.error(new Error("'printBMP' not implemented yet"));
        return null;
    }


    printImageBuffer(width, height, data, density = 1, dotMatrix = false) {
        this.buffer = null;

        let bitmap_command = [0x1b, 0x2a, 0x0, 0x0, 0x0];

        switch (density) {
            default:
            case 1:
                bitmap_command[2] = 0x00;
                break;
            case 2:
                bitmap_command[2] = 0x01;
                break;
        }

        bitmap_command[3] = width & 0xFF;        // nL = width LS byte
        bitmap_command[4] = (width >> 8) & 0xFF; // nH = width MS byte

        let pixels = [];
        for (let y = 0; y < height; ++y) {
            let line = [];
            for (let x = 0; x < width; ++x) {
                let idx = (width * y + x) << 2;
                line.push({
                    r: data[idx],
                    g: data[idx + 1],
                    b: data[idx + 2],
                    a: data[idx + 3]
                });
            }
            pixels.push(line);
        }

        let isPixelOn = false;
        let imageBuffer = Buffer.from([]);

        for (let startHeight = 0; startHeight < height; startHeight += 8) {
            for (let pixelX = 0; pixelX < width; ++pixelX) {
                let byte = 0x0;
                let bitCounter = 0;
                isPixelOn = !isPixelOn;

                for (let pixelY = startHeight; pixelY < startHeight + 8; ++pixelY) {
                    let pixel = (pixels[pixelY] || [])[pixelX];
                    // Image overflow
                    if (pixel == null) {
                        pixel = {
                            a: 0,
                            r: 0,
                            g: 0,
                            b: 0
                        };
                    }

                    if (pixel.a > 126 && (isPixelOn || !dotMatrix)) { // checking transparency
                        let grayscale = parseInt(0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b);

                        if (grayscale < 128) { // checking color
                            let mask = 1 << (7 - bitCounter); // setting bitwise mask
                            byte |= mask; // setting the correct bit to 1
                        }
                    }

                    ++bitCounter;
                    isPixelOn = !isPixelOn;
                }

                imageBuffer = Buffer.concat([imageBuffer, Buffer.from([byte])]);
            }

            this.append(Buffer.from(bitmap_command));
            this.append(imageBuffer);
            this.append(Buffer.from([0x1b, 0x4a, 0x10])); // line feed

            imageBuffer = Buffer.from([]);
        }

        return this.buffer;
    }
}


module.exports = Bixolon;