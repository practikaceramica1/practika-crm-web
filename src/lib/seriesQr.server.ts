import QRCode from "qrcode";

const QR_SIZE = 512;

export async function generateSeriesQrPngBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    width: QR_SIZE,
    margin: 2,
    errorCorrectionLevel: "M",
    type: "png",
  });
}
