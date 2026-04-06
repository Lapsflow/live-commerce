"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Download, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function OrderUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
    }
  };

  const handleDownloadTemplate = () => {
    window.open("/api/orders/template", "_blank");
  };

  const handlePreview = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("preview", "true");

    try {
      const res = await fetch("/api/orders/bulk", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "미리보기 실패");
      }

      const data = await res.json();
      setPreview(data.data);
      toast({
        title: "미리보기 성공",
        description: `${data.data.length}건의 발주를 확인했습니다.`,
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

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/orders/bulk", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "업로드 실패");
      }

      const data = await res.json();
      toast({
        title: "업로드 완료",
        description: `${data.data.created}건의 발주가 등록되었습니다.`,
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

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">발주 대량 등록</h1>

      {/* 템플릿 다운로드 */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">1. 템플릿 다운로드</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Excel 템플릿을 다운로드하여 발주 정보를 입력하세요.
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
            <div className="flex gap-4">
              <Button onClick={handlePreview} disabled={loading} variant="outline">
                미리보기
              </Button>
              <Button onClick={handleUpload} disabled={loading}>
                <Upload className="mr-2 h-4 w-4" />
                {loading ? "업로드 중..." : "업로드"}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* 미리보기 */}
      {preview && preview.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">미리보기 ({preview.length}건)</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left">주문번호</th>
                  <th className="p-2 text-left">수령자</th>
                  <th className="p-2 text-left">연락처</th>
                  <th className="p-2 text-left">상품명</th>
                  <th className="p-2 text-right">수량</th>
                  <th className="p-2 text-right">입금액</th>
                  <th className="p-2 text-right">마진</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/30">
                    <td className="p-2">{row.orderNo || "자동생성"}</td>
                    <td className="p-2">{row.recipient}</td>
                    <td className="p-2">{row.phone}</td>
                    <td className="p-2">{row.productName}</td>
                    <td className="p-2 text-right">{row.quantity}</td>
                    <td className="p-2 text-right">{row.totalAmount.toLocaleString()}원</td>
                    <td className="p-2 text-right text-green-600 font-medium">
                      {row.margin.toLocaleString()}원
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-md flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium">미리보기 확인 후 "업로드" 버튼을 클릭하세요.</p>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                주문번호가 "자동생성"으로 표시된 항목은 업로드 시 자동으로 생성됩니다.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
