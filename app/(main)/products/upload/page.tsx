"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface Center {
  id: string;
  code: string;
  name: string;
  regionName: string;
}

interface PreviewRow {
  row: number;
  code: string;
  name: string;
  barcode: string;
  sellPrice: number;
  supplyPrice: number;
  stock: number;
  error?: string;
}

export default function ProductUploadPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [loadingCenters, setLoadingCenters] = useState(false);

  const [fileName, setFileName] = useState("");
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [rawFile, setRawFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
    errors?: { row: number; code: string; error: string }[];
    duplicates?: string[];
  } | null>(null);

  const userRole = (session?.user as any)?.role;
  const userCenterId = (session?.user as any)?.centerId;

  // 센터 목록 로드
  useEffect(() => {
    async function fetchCenters() {
      setLoadingCenters(true);
      try {
        const res = await fetch("/api/centers");
        if (res.ok) {
          const data = await res.json();
          const list = data.centers || [];
          setCenters(list);

          // ADMIN은 자기 센터만
          if (userRole === "ADMIN" && userCenterId) {
            setSelectedCenterId(userCenterId);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoadingCenters(false);
      }
    }
    fetchCenters();
  }, [userRole, userCenterId]);

  // 엑셀 템플릿 다운로드
  const handleDownloadTemplate = () => {
    const templateData = [
      { 상품코드: "CTR-001", 상품명: "샘플 상품 1", 바코드: "", 판매가: 10000, 공급가: 7000, 재고: 100 },
      { 상품코드: "CTR-002", 상품명: "샘플 상품 2", 바코드: "", 판매가: 25000, 공급가: 18000, 재고: 50 },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    // 컬럼 너비 설정
    ws["!cols"] = [
      { wch: 15 }, // 상품코드
      { wch: 25 }, // 상품명
      { wch: 20 }, // 바코드
      { wch: 12 }, // 판매가
      { wch: 12 }, // 공급가
      { wch: 10 }, // 재고
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "상품목록");
    XLSX.writeFile(wb, "상품_업로드_템플릿.xlsx");
  };

  // 파일 선택 → 미리보기
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setRawFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;

      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        toast({ title: "오류", description: "엑셀 시트가 없습니다", variant: "destructive" });
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

      const preview: PreviewRow[] = rows.map((row, idx) => {
        const code = String(row["상품코드"] ?? "").trim();
        const name = String(row["상품명"] ?? "").trim();
        const barcode = String(row["바코드"] ?? "").trim();
        const sellPrice = parseInt(String(row["판매가"] ?? "0")) || 0;
        const supplyPrice = parseInt(String(row["공급가"] ?? "0")) || 0;
        const stock = parseInt(String(row["재고"] ?? "0")) || 0;

        let error: string | undefined;
        if (!code) error = "상품코드 누락";
        else if (!name) error = "상품명 누락";
        else if (sellPrice < 0) error = "판매가 음수";
        else if (supplyPrice < 0) error = "공급가 음수";

        return { row: idx + 2, code, name, barcode, sellPrice, supplyPrice, stock, error };
      });

      setPreviewData(preview);
    };

    reader.readAsArrayBuffer(file);
  };

  // 업로드 실행
  const handleUpload = async () => {
    if (!rawFile || !selectedCenterId) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", rawFile);
      formData.append("centerId", selectedCenterId);

      const res = await fetch("/api/products/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          success: true,
          message: data.data.message,
          count: data.data.count,
        });
        toast({ title: "업로드 완료", description: data.data.message });
      } else {
        const errData = data.error;
        setResult({
          success: false,
          message: errData?.message || "업로드 실패",
          errors: errData?.details?.errors,
          duplicates: errData?.details?.duplicates,
        });
        toast({ title: "업로드 실패", description: errData?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "네트워크 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const hasErrors = previewData.some((r) => r.error);
  const emptyBarcodeCount = previewData.filter((r) => !r.barcode).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">엑셀 상품 업로드</h1>
          <p className="text-muted-foreground">
            엑셀 파일로 센터 자사몰 상품을 일괄 등록합니다
          </p>
        </div>
      </div>

      {/* Step 1: 센터 선택 */}
      <Card>
        <CardHeader>
          <CardTitle>1. 센터 선택</CardTitle>
          <CardDescription>상품을 등록할 센터를 선택하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <Label>센터</Label>
            <Select
              value={selectedCenterId}
              onValueChange={(v) => v && setSelectedCenterId(v)}
              disabled={loadingCenters || userRole === "ADMIN"}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingCenters ? "로딩 중..." : "센터를 선택하세요"} />
              </SelectTrigger>
              <SelectContent>
                {centers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.regionName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {userRole === "ADMIN" && (
              <p className="text-sm text-muted-foreground mt-1">
                관리자는 소속 센터에만 등록할 수 있습니다
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: 파일 업로드 */}
      <Card>
        <CardHeader>
          <CardTitle>2. 엑셀 파일</CardTitle>
          <CardDescription>
            템플릿을 다운로드하여 작성 후 업로드하세요. 바코드를 비워두면 자동 생성됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              템플릿 다운로드
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedCenterId}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              파일 선택
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {fileName && (
            <p className="text-sm text-muted-foreground">
              선택된 파일: <span className="font-medium">{fileName}</span>
            </p>
          )}

          {/* 필수 컬럼 안내 */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <p className="text-sm font-medium mb-2">필수 컬럼</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">상품코드 *</Badge>
              <Badge variant="outline">상품명 *</Badge>
              <Badge variant="secondary">바코드 (선택)</Badge>
              <Badge variant="outline">판매가</Badge>
              <Badge variant="outline">공급가</Badge>
              <Badge variant="outline">재고</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              * 바코드를 비워두면 CTR-센터코드-순번 형식으로 자동 생성됩니다
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: 미리보기 */}
      {previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. 미리보기</CardTitle>
            <CardDescription>
              총 {previewData.length}개 상품
              {emptyBarcodeCount > 0 && ` (바코드 자동 생성: ${emptyBarcodeCount}개)`}
              {hasErrors && (
                <span className="text-red-500 ml-2">
                  오류 {previewData.filter((r) => r.error).length}건
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">행</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">상품코드</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">상품명</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">바코드</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">판매가</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">공급가</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">재고</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {previewData.map((row) => (
                    <tr key={row.row} className={row.error ? "bg-red-50" : ""}>
                      <td className="px-3 py-2 text-gray-500">{row.row}</td>
                      <td className="px-3 py-2 font-mono">{row.code}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 font-mono">
                        {row.barcode || (
                          <span className="text-blue-500 text-xs">자동생성</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.sellPrice.toLocaleString()}원
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.supplyPrice.toLocaleString()}원
                      </td>
                      <td className="px-3 py-2 text-right">{row.stock}</td>
                      <td className="px-3 py-2">
                        {row.error ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {row.error}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            정상
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 업로드 버튼 */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setPreviewData([]);
                  setRawFile(null);
                  setFileName("");
                  setResult(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                초기화
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || hasErrors || previewData.length === 0}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "업로드 중..." : `${previewData.length}개 상품 등록`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 결과 */}
      {result && (
        <Card className={result.success ? "border-green-300" : "border-red-300"}>
          <CardContent className="pt-6">
            {result.success ? (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div>
                  <p className="font-medium text-green-700">{result.message}</p>
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => router.push("/products?productType=CENTER")}
                  >
                    센터 상품 목록 보기
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <p className="font-medium text-red-700">{result.message}</p>
                </div>
                {result.errors && (
                  <ul className="text-sm text-red-600 list-disc list-inside">
                    {result.errors.map((e, i) => (
                      <li key={i}>
                        행 {e.row} ({e.code}): {e.error}
                      </li>
                    ))}
                  </ul>
                )}
                {result.duplicates && (
                  <p className="text-sm text-red-600">
                    중복: {result.duplicates.join(", ")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
