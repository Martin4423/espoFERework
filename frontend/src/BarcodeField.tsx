import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

const maxLengthByFormat: Record<string, number> = {
  EAN2: 2, EAN5: 5, EAN8: 8, EAN13: 13, UPC: 12, UPCE: 11, ITF14: 14, pharmacode: 6,
};

export default function BarcodeField({
  mode,
  value,
  codeType,
  lastChar,
  maxLength,
  inputId,
  required,
  disabled,
  label,
  onChange,
}: {
  mode: "input" | "display";
  value: unknown;
  codeType?: string;
  lastChar?: string;
  maxLength?: number;
  inputId: string;
  required?: boolean;
  disabled?: boolean;
  label: string;
  onChange?: (value: string) => void;
}) {
  const text = value == null ? "" : String(value);
  const format = codeType || "CODE128";
  const isQr = format === "QRcode";
  const svgRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [qrImage, setQrImage] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    let active = true;
    setValidationError("");
    setQrImage("");
    if (svgRef.current) svgRef.current.replaceChildren();
    if (!text) return () => { active = false; };

    if (isQr) {
      QRCode.toDataURL(text, { width: Math.min(256, text.length > 192 ? 256 : 128), margin: 1, errorCorrectionLevel: "H", color: { dark: "#111827", light: "#ffffff" } })
        .then((image) => active && setQrImage(image))
        .catch(() => active && setValidationError("Tento text se nevejde do QR kódu."));
      return () => { active = false; };
    }

    const svg = svgRef.current;
    if (!svg) return () => { active = false; };
    let valid = true;
    try {
      JsBarcode(svg, text, {
        format,
        height: 48,
        fontSize: 13,
        margin: 0,
        lastChar,
        valid: (result) => { valid = result; },
      });
      if (!valid) {
        svg.replaceChildren();
        setValidationError(`Hodnota neodpovídá formátu ${format}.`);
      }
    } catch {
      svg.replaceChildren();
      setValidationError(`Hodnota neodpovídá formátu ${format}.`);
    }
    return () => { active = false; };
  }, [text, format, isQr, lastChar]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(validationError);
  }, [validationError, text]);

  const barcode = <div className="barcode-visual">
    {isQr ? qrImage && <img src={qrImage} alt={`${label} · QR kód`} /> : <svg ref={svgRef} role="img" aria-label={`${label} · čárový kód`} />}
    {validationError && <span className="barcode-invalid">{validationError}</span>}
  </div>;

  if (mode === "display") {
    return <div className="barcode-display"><span className="barcode-value">{text || "—"}</span>{barcode}</div>;
  }

  return <div className="barcode-input-control">
    <input
      ref={inputRef}
      id={inputId}
      type="text"
      value={text}
      disabled={disabled}
      required={required}
      maxLength={maxLengthByFormat[format] || maxLength || 255}
      inputMode={["EAN2", "EAN5", "EAN8", "EAN13", "UPC", "UPCE", "ITF14", "pharmacode"].includes(format) ? "numeric" : undefined}
      autoComplete="off"
      aria-label={label}
      aria-invalid={Boolean(validationError)}
      aria-describedby={`${inputId}-preview`}
      onChange={(event) => onChange?.(event.target.value)}
    />
    <div id={`${inputId}-preview`} className="barcode-input-preview">
      <span className="barcode-preview-label">Náhled {isQr ? "QR kódu" : "čárového kódu"}</span>
      {barcode}
    </div>
  </div>;
}
