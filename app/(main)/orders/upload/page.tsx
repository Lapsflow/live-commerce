"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface PreviewRow {
  rowIndex: number;
  orderNo: string;
  recipient: string;
  phone: string;
  productName: string;
  productCode: string;
  barcode: string;
  quantity: number;
  totalAmount: number;
  supplyPrice: number;
  margin: number;
  matched: boolean;
  matchMethod: string | null;
  error: string | null;
}

export default function OrderUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [uploadError, setUploadError] = useState<any>(null);
  const [isCreditTrade, setIsCreditTrade] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
      setUploadError(null);
    }
  };

  const handleDownloadTemplate = () => {
    window.open("/api/orders/template", "_blank");
  };

  // Stage 1: 미리보기 (상품 매칭 결과 확인)
  const handlePreview = async () => {
    if (!file) return;

    setLoading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("preview", "true");

    try {
      const res = await fetch("/api/orders/bulk", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "미리보기 실패");
      }

      setPreview(data.data);
      const matched = (data.data as PreviewRow[]).filter((r) => r.matched).length;
      const unmatched = (data.data as PreviewRow[]).filter((r) => !r.matched).length;

      toast({
        title: "미리보기 완료",
        description: `${data.data.length}건 중 ${matched}건 매칭, ${unmatched}건 미매칭`,
        variant: unmatched > 0 ? "destructive" : "default",
      });
    } catch (err: any) {
      toast({
        title: "오류",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Stage 2: 업로드 (전체 매칭 성공 시만 가능)
  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    if (isCreditTrade) {
      formData.append("isCreditTrade", "true");
    }

    try {
      const res = await fetch("/api/orders/bulk", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        // Stage 1 에러: 매칭 실패 표시
        if (data.error?.code === "MATCHING_FAILED") {
          setUploadError(data.error);
          toast({
            title: "상품 매칭 실패",
            description: data.error.message,
            variant: "destructive",
          });
        } else {
          throw new Error(data.error?.message || "업로드 실패");
        }
        return;
      }

      toast({
        title: "발주 업로드 완료",
        description: `${data.data.message} · 발주 관리에서 컨펌하면 ONEWMS로 자동 동기화됩니다.`,
      });

      router.push("/orders");
    } catch (err: any) {
      toast({
        title: "오류",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const matchedCount = preview?.filter((r) => r.matched).length || 0;
  const unmatchedCount = preview?.filter((r) => !r.matched).length || 0;
  const allMatched = preview && unmatchedCount === 0;

  const matchMethodLabel = (method: string | null) => {
    switch (method) {
      case "CODE": return "코드";
      case "BARCODE": return "바코드";
      case "NAME_EXACT": return "제품명(정확)";
      case "NAME_PARTIAL": return "제품명(부분)";
      default: return "-";
    }
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">발주 대량 등록</h1>

      {/* 운영 흐름 안내 — Q3-A: 컨펌 단계 유지 */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
        <div className="font-semibold text-amber-900 mb-1">발주 처리 흐름 안내</div>
        <ol className="list-decimal list-inside text-amber-800 space-y-0.5">
          <li>엑셀 업로드 → 발주가 본사 시스템에 접수됩니다.</li>
          <li>본사 마스터가 발주 관리에서 컨펌하면 본사 제품은 ONEWMS로 자동 동기화됩니다.</li>
          <li>센터 제품은 해당 센터로 발주서가 자동 발송됩니다.</li>
        </ol>
        <div className="mt-2 text-xs text-amber-700">
          엑셀 업로드만으로는 ONEWMS에 매칭되지 않습니다. 본사 컨펌 단계가 필요합니다.
        </div>
      </div>

      {/* 템플릿 다운로드 */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">1. 템플릿 다운로드</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Excel 템플릿을 다운로드하여 발주 정보를 입력하세요.
          상품코드, 바코드, 상품명 중 1개만 입력하면 자동 매칭됩니다.
        </p>
        <Button variant="outline" onClick={handleDownloadTemplate}>
          <Download className="mr-2 h-4 w-4" />
          템플릿 다운로드
        </Button>
      </Card>

      {/* 파일 업로드 */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">2. 파일 업로드</h2>
        <p className="text-sm text-muted-foreground mb-4">
          작성한 Excel 파일을 업로드하세요. (*.xlsx, *.xls)
        </p>
        <div className="flex flex-col gap-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />
          {file && (
            <>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="creditTrade"
                  checked={isCreditTrade}
                  onCheckedChange={(checked) => setIsCreditTrade(checked === true)}
                />
                <Label htmlFor="creditTrade" className="text-sm cursor-pointer">
                  외상거래 (입금 단계 생략)
                </Label>
              </div>
              <div className="flex gap-4">
                <Button onClick={handlePreview} disabled={loading} variant="outline">
                  미리보기 (매칭 확인)
                </Button>
                <Button onClick={handleUpload} disabled={loading || (preview !== null && !allMatched)}>
                  <Upload className="mr-2 h-4 w-4" />
                  {loading ? "처리 중..." : "업로드"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Stage 1 매칭 에러 표시 */}
      {uploadError && uploadError.details && (
        <Card className="p-6 mb-6 border-destructive">
          <h2 className="text-xl font-bold mb-4 text-destructive flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            매칭 실패 ({uploadError.details.unmatchedCount}건)
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            아래 항목의 상품코드, 바코드, 또는 상품명을 확인하고 수정 후 재업로드해주세요.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-destructive/10">
                  <th className="p-2 text-left">행</th>
                  <th className="p-2 text-left">상품코드</th>
                  <th className="p-2 text-left">바코드</th>
                  <th className="p-2 text-left">상품명</th>
                  <th className="p-2 text-left">오류</th>
                </tr>
              </thead>
              <tbody>
                {uploadError.details.unmatchedItems?.map((item: any) => (
                  <tr key={item.rowIndex} className="border-b bg-destructive/5">
                    <td className="p-2">{item.rowIndex + 1}</td>
                    <td className="p-2">{item.input.code || "-"}</td>
                    <td className="p-2">{item.input.barcode || "-"}</td>
                    <td className="p-2">{item.input.productName || "-"}</td>
                    <td className="p-2 text-destructive text-sm">{item.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 미리보기 결과 */}
      {preview && preview.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
            미리보기 ({preview.length}건)
            <Badge variant={allMatched ? "default" : "destructive"}>
              {matchedCount}건 매칭 / {unmatchedCount}건 실패
            </Badge>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left">상태</th>
                  <th className="p-2 text-left">주문번호</th>
                  <th className="p-2 text-left">수령자</th>
                  <th className="p-2 text-left">상품명</th>
                  <th className="p-2 text-left">매칭방법</th>
                  <th className="p-2 text-right">수량</th>
                  <th className="p-2 text-right">입금액</th>
                  <th className="p-2 text-right">공급가</th>
                  <th className="p-2 text-right">마진</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr
                    key={row.rowIndex}
                    className={`border-b ${row.matched ? "hover:bg-muted/30" : "bg-destructive/5"}`}
                  >
                    <td className="p-2">
                      {row.matched ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </td>
                    <td className="p-2">{row.orderNo || "자동생성"}</td>
                    <td className="p-2">{row.recipient}</td>
                    <td className="p-2">
                      {row.matched ? row.productName : (
                        <span className="text-destructive">{row.error}</span>
                      )}
                    </td>
                    <td className="p-2">
                      {row.matched && (
                        <Badge variant="outline" className="text-xs">
                          {matchMethodLabel(row.matchMethod)}
                        </Badge>
                      )}
                    </td>
                    <td className="p-2 text-right">{row.quantity}</td>
                    <td className="p-2 text-right">{row.totalAmount.toLocaleString()}원</td>
                    <td className="p-2 text-right">
                      {row.matched ? `${(row.supplyPrice * row.quantity).toLocaleString()}원` : "-"}
                    </td>
                    <td className={`p-2 text-right font-medium ${row.margin >= 0 ? "text-green-600" : "text-destructive"}`}>
                      {row.matched ? `${row.margin.toLocaleString()}원` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!allMatched && (
            <div className="mt-4 p-4 bg-destructive/10 rounded-md flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">
                  {unmatchedCount}건의 상품이 매칭되지 않았습니다.
                </p>
                <p className="text-muted-foreground mt-1">
                  Excel 파일의 상품코드, 바코드, 또는 상품명을 수정하고 다시 미리보기를 해주세요.
                </p>
              </div>
            </div>
          )}

          {allMatched && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 rounded-md flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-green-800 dark:text-green-200">
                  모든 상품이 매칭되었습니다.
                </p>
                <p className="text-green-700 dark:text-green-300 mt-1">
                  "업로드" 버튼을 클릭하면 발주가 등록되며, 담당자 검수(Stage 2)를 거쳐 처리됩니다.
                </p>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
