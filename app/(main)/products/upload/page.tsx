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
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Upload, Download, FileSpreadsheet,
  AlertCircle, CheckCircle2, RefreshCw, ArrowUpDown,
} from "lucide-react";
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
  name: string;
  barcode: string;
  sellPrice: number;
  supplyPrice: number;
  originalPrice: number;
  category: string;
  stock: number;
  notes: string;
  error?: string;
}

interface PriceChange {
  barcode: string;
  productName: string;
  field: string;
  oldValue: number;
  newValue: number;
}

interface DeactivatedProduct {
  id: string;
  code: string;
  name: string;
  barcode: string;
  activeOrderCount: number;
}

interface UpsertPreviewResult {
  stats: { updated: number; created: number; reactivated: number; deactivated: number };
  priceChanges: PriceChange[];
  newProducts: Array<{ barcode: string; name: string; sellPrice: number; stock: number }>;
  deactivatedProducts: DeactivatedProduct[];
  totalActiveOrderCount: number;
}

interface UploadResult {
  message: string;
  stats: { updated: number; created: number; reactivated: number; deactivated: number };
  priceChanges: PriceChange[];
  durationMs: number;
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

  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [serverPreview, setServerPreview] = useState<UpsertPreviewResult | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
          const list = data.data?.centers || [];
          setCenters(list);
          if (userRole === "SUB_MASTER" && userCenterId) {
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

  // 템플릿 다운로드
  const handleDownloadTemplate = () => {
    const templateData = [
      { 상품명: "샘플 상품 1", 바코드: "8801234567890", 판매가: 10000, 공급가: 7000, 원가: 5000, 카테고리: "식품", 재고: 100, 메모: "" },
      { 상품명: "샘플 상품 2", 바코드: "8801234567891", 판매가: 25000, 공급가: 18000, 원가: 12000, 카테고리: "뷰티", 재고: 50, 메모: "" },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [
      { wch: 25 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 15 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "상품목록");
    XLSX.writeFile(wb, "상품_업로드_템플릿.xlsx");
  };

  // 파일 선택 → 클라이언트 파싱
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResult(null);
    setUploadError(null);
    setServerPreview(null);
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
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

      const preview: PreviewRow[] = rows.map((row, idx) => {
        const name = String(row["상품명"] ?? "").trim();
        const barcode = String(row["바코드"] ?? "").trim();
        const sellPrice = parseInt(String(row["판매가"] ?? "0")) || 0;
        const supplyPrice = parseInt(String(row["공급가"] ?? "0")) || 0;
        const originalPrice = parseInt(String(row["원가"] ?? "0")) || 0;
        const category = String(row["카테고리"] ?? "").trim();
        const stock = parseInt(String(row["재고"] ?? "0")) || 0;
        const notes = String(row["메모"] ?? "").trim();

        let error: string | undefined;
        if (!barcode) error = "바코드 누락 (필수)";
        else if (!name) error = "상품명 누락";
        else if (sellPrice < 0) error = "판매가 음수";
        else if (supplyPrice < 0) error = "공급가 음수";

        return { row: idx + 2, name, barcode, sellPrice, supplyPrice, originalPrice, category, stock, notes, error };
      });

      setPreviewData(preview);
    };
    reader.readAsArrayBuffer(file);
  };

  // 서버 미리보기 (Dry Run)
  const handlePreview = async () => {
    if (!selectedCenterId || !rawFile) return;
    setPreviewing(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", rawFile);
      formData.append("centerId", selectedCenterId);

      const res = await fetch("/api/products/upload/preview", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setServerPreview(data.data);
        setShowConfirmDialog(true);
      } else {
        const errMsg = data.error?.message || "미리보기 실패";
        setUploadError(errMsg);
        toast({ title: "미리보기 실패", description: errMsg, variant: "destructive" });
      }
    } catch {
      setUploadError("네트워크 오류가 발생했습니다");
      toast({ title: "오류", description: "네트워크 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  // 확정 업로드
  const handleExecuteUpload = async () => {
    if (!selectedCenterId || !rawFile) return;
    setUploading(true);

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
        setResult(data.data);
        setShowConfirmDialog(false);
        toast({ title: "업로드 완료", description: data.data.message });
      } else {
        const errMsg = data.error?.message || "업로드 실패";
        setUploadError(errMsg);
        setShowConfirmDialog(false);
        toast({ title: "업로드 실패", description: errMsg, variant: "destructive" });
      }
    } catch {
      setUploadError("네트워크 오류가 발생했습니다");
      setShowConfirmDialog(false);
      toast({ title: "오류", description: "네트워크 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // 초기화
  const handleReset = () => {
    setPreviewData([]);
    setRawFile(null);
    setFileName("");
    setResult(null);
    setUploadError(null);
    setServerPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
            바코드 기준으로 상품을 일괄 갱신합니다 (업데이트 / 신규 추가 / 비활성화)
          </p>
        </div>
      </div>

      {/* Step 1: 센터 선택 */}
      <Card>
        <CardHeader>
          <CardTitle>1. 센터 선택</CardTitle>
          <CardDescription>상품을 관리할 센터를 선택하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <Label>센터</Label>
            <Select
              value={selectedCenterId}
              onValueChange={(v) => v && setSelectedCenterId(v)}
              disabled={loadingCenters || userRole === "SUB_MASTER"}
            >
              <SelectTrigger>
                {/* base-ui SelectValue 는 원시값을 노출 → 라벨 직접 렌더 (2026-07-10) */}
                <span className={selectedCenterId ? "" : "text-grey-500"}>
                  {selectedCenterId
                    ? (() => {
                        const c = centers.find((c) => c.id === selectedCenterId);
                        return c ? `${c.name} (${c.regionName})` : selectedCenterId;
                      })()
                    : loadingCenters
                      ? "로딩 중..."
                      : "센터를 선택하세요"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {centers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.regionName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {userRole === "SUB_MASTER" && (
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
            템플릿을 다운로드하여 작성 후 업로드하세요. 바코드가 매칭 키입니다.
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

          {/* 컬럼 안내 */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <p className="text-sm font-medium mb-2">컬럼 안내</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">상품명 *</Badge>
              <Badge variant="outline">바코드 * (매칭 키)</Badge>
              <Badge variant="outline">판매가 *</Badge>
              <Badge variant="outline">공급가 *</Badge>
              <Badge variant="secondary">원가</Badge>
              <Badge variant="secondary">카테고리</Badge>
              <Badge variant="outline">재고 *</Badge>
              <Badge variant="secondary">메모</Badge>
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-xs text-muted-foreground">
                * 같은 바코드 → 기존 상품 업데이트 (가격/재고/이름 갱신)
              </p>
              <p className="text-xs text-muted-foreground">
                * 새 바코드 → 신규 상품 등록 (상품코드 자동 생성)
              </p>
              <p className="text-xs text-muted-foreground">
                * 엑셀에 없는 기존 상품 → 비활성화 (진행 중 발주는 영향 없음)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: 클라이언트 미리보기 */}
      {previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. 데이터 확인</CardTitle>
            <CardDescription>
              총 {previewData.length}개 상품
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
                    <th className="px-3 py-2 text-left font-medium text-gray-500">바코드</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">상품명</th>
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
                      <td className="px-3 py-2 font-mono text-xs">{row.barcode || "-"}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 text-right">{row.sellPrice.toLocaleString()}원</td>
                      <td className="px-3 py-2 text-right">{row.supplyPrice.toLocaleString()}원</td>
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

            {uploadError && (
              <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                <p className="text-sm text-red-700 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {uploadError}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={handleReset}>
                초기화
              </Button>
              <Button
                onClick={handlePreview}
                disabled={previewing || hasErrors || previewData.length === 0 || emptyBarcodeCount > 0}
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                {previewing ? "분석 중..." : "변경 사항 확인"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 확인 Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>업로드 확인</DialogTitle>
          </DialogHeader>

          {serverPreview && (
            <div className="space-y-4">
              {/* 통계 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="업데이트" value={serverPreview.stats.updated} color="blue" />
                <StatCard label="신규 추가" value={serverPreview.stats.created} color="green" />
                <StatCard label="재활성화" value={serverPreview.stats.reactivated} color="purple" />
                <StatCard label="비활성화" value={serverPreview.stats.deactivated} color="orange" />
              </div>

              {/* 가격 변동 */}
              {serverPreview.priceChanges.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    가격 변동 ({serverPreview.priceChanges.length}건)
                  </h4>
                  <div className="max-h-32 overflow-y-auto rounded border">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left">상품</th>
                          <th className="px-2 py-1 text-left">항목</th>
                          <th className="px-2 py-1 text-right">변경 전</th>
                          <th className="px-2 py-1 text-right">변경 후</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {serverPreview.priceChanges.map((pc, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1">{pc.productName}</td>
                            <td className="px-2 py-1">{pc.field}</td>
                            <td className="px-2 py-1 text-right">{pc.oldValue.toLocaleString()}원</td>
                            <td className="px-2 py-1 text-right font-medium">
                              {pc.newValue.toLocaleString()}원
                              <span className={`ml-1 ${pc.newValue > pc.oldValue ? "text-red-500" : "text-blue-500"}`}>
                                ({pc.newValue > pc.oldValue ? "+" : ""}{Math.round(((pc.newValue - pc.oldValue) / pc.oldValue) * 100)}%)
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 신규 상품 */}
              {serverPreview.newProducts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    신규 상품 ({serverPreview.newProducts.length}건)
                  </h4>
                  <div className="max-h-24 overflow-y-auto text-xs space-y-1">
                    {serverPreview.newProducts.slice(0, 5).map((p, i) => (
                      <p key={i} className="text-gray-600">
                        {p.name} ({p.barcode}) — {p.sellPrice.toLocaleString()}원, {p.stock}개
                      </p>
                    ))}
                    {serverPreview.newProducts.length > 5 && (
                      <p className="text-gray-400">...외 {serverPreview.newProducts.length - 5}건</p>
                    )}
                  </div>
                </div>
              )}

              {/* 비활성화 상품 */}
              {serverPreview.deactivatedProducts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    비활성화 상품 ({serverPreview.deactivatedProducts.length}건)
                  </h4>
                  <div className="max-h-24 overflow-y-auto text-xs space-y-1">
                    {serverPreview.deactivatedProducts.slice(0, 5).map((p, i) => (
                      <p key={i} className="text-gray-600">
                        {p.name} ({p.barcode})
                        {p.activeOrderCount > 0 && (
                          <span className="text-amber-600 ml-1">
                            발주 {p.activeOrderCount}건
                          </span>
                        )}
                      </p>
                    ))}
                    {serverPreview.deactivatedProducts.length > 5 && (
                      <p className="text-gray-400">...외 {serverPreview.deactivatedProducts.length - 5}건</p>
                    )}
                  </div>
                </div>
              )}

              {/* 진행 중 발주 안내 */}
              {serverPreview.totalActiveOrderCount > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-800">
                    진행 중 발주 {serverPreview.totalActiveOrderCount}건은 비활성화 후에도 정상 처리됩니다.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              취소
            </Button>
            <Button onClick={handleExecuteUpload} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "업로드 중..." : "확정 업로드"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 결과 */}
      {result && (
        <Card className="border-green-300">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <p className="font-medium text-green-700">{result.message}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="업데이트" value={result.stats.updated} color="blue" />
                <StatCard label="신규 추가" value={result.stats.created} color="green" />
                <StatCard label="재활성화" value={result.stats.reactivated} color="purple" />
                <StatCard label="비활성화" value={result.stats.deactivated} color="orange" />
              </div>
              {result.priceChanges.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  가격 변동 {result.priceChanges.length}건
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                처리 시간: {(result.durationMs / 1000).toFixed(1)}초
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/products?productType=CENTER")}
                >
                  센터 상품 목록
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/products/upload-history")}
                >
                  업로드 이력
                </Button>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RefreshCw className="mr-1 h-3 w-3" />
                  새 업로드
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  };

  return (
    <div className={`rounded-lg border p-3 text-center ${colorMap[color] || ""}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}
