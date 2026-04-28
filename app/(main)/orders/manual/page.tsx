"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function OrderManualPage() {
  return (
    <div className="max-w-4xl mx-auto py-6">
      {/* Screen-only header */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">발주 매뉴얼</h1>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          인쇄 / PDF 저장
        </Button>
      </div>

      {/* Print content */}
      <div className="bg-white rounded-lg shadow-sm border p-8 print:shadow-none print:border-none print:p-0 space-y-8 text-sm leading-relaxed">
        {/* Title */}
        <div className="text-center border-b pb-6">
          <h1 className="text-3xl font-bold mb-2">슈퍼무진 발주 매뉴얼</h1>
          <p className="text-muted-foreground">셀러를 위한 발주 시스템 가이드</p>
          <p className="text-xs text-muted-foreground mt-2">최종 업데이트: 2026년 4월</p>
        </div>

        {/* TOC */}
        <div className="bg-gray-50 rounded-lg p-4 print:bg-gray-100">
          <h2 className="font-bold text-base mb-2">목차</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>발주 프로세스 개요</li>
            <li>발주 등록 방법</li>
            <li>엑셀 일괄 업로드</li>
            <li>발주 상태 설명</li>
            <li>결제 안내</li>
            <li>배송 및 출고</li>
            <li>자주 묻는 질문</li>
          </ol>
        </div>

        {/* 1. Overview */}
        <section>
          <h2 className="text-lg font-bold border-b pb-2 mb-3">1. 발주 프로세스 개요</h2>
          <div className="space-y-3">
            <p>
              슈퍼무진 발주 시스템은 셀러가 방송에 필요한 상품을 주문하고,
              관리자 승인 후 출고까지 일괄 관리하는 시스템입니다.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium py-3">
              <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded">발주 등록</span>
              <span className="text-gray-400">&rarr;</span>
              <span className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded">관리자 검토</span>
              <span className="text-gray-400">&rarr;</span>
              <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded">승인</span>
              <span className="text-gray-400">&rarr;</span>
              <span className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded">결제</span>
              <span className="text-gray-400">&rarr;</span>
              <span className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded">출고</span>
              <span className="text-gray-400">&rarr;</span>
              <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded">배송 완료</span>
            </div>
          </div>
        </section>

        {/* 2. Registration */}
        <section>
          <h2 className="text-lg font-bold border-b pb-2 mb-3">2. 발주 등록 방법</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">2.1 개별 발주</h3>
              <ol className="list-decimal list-inside space-y-1.5 ml-2">
                <li>좌측 메뉴에서 <strong>발주</strong>를 클릭합니다.</li>
                <li>우측 상단 <strong>발주 등록</strong> 버튼을 클릭합니다.</li>
                <li>수신자 정보(이름, 연락처, 주소)를 입력합니다.</li>
                <li>상품을 검색하여 추가하고 수량을 입력합니다.</li>
                <li><strong>등록</strong> 버튼을 클릭하여 발주를 완료합니다.</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2.2 엑셀 일괄 등록</h3>
              <ol className="list-decimal list-inside space-y-1.5 ml-2">
                <li>발주 페이지에서 <strong>발주 등록</strong> &rarr; <strong>엑셀 업로드</strong>를 선택합니다.</li>
                <li><strong>템플릿 다운로드</strong>를 클릭하여 양식을 받습니다.</li>
                <li>양식에 맞춰 발주 데이터를 입력합니다.</li>
                <li>파일을 업로드하면 상품 매칭 결과가 표시됩니다.</li>
                <li>매칭 오류가 있는 경우 수정 후 재업로드합니다.</li>
                <li>모든 상품이 매칭되면 <strong>등록</strong>을 클릭합니다.</li>
              </ol>
            </div>
          </div>
        </section>

        {/* 3. Excel upload */}
        <section>
          <h2 className="text-lg font-bold border-b pb-2 mb-3">3. 엑셀 일괄 업로드 양식</h2>
          <div className="space-y-3">
            <p>엑셀 템플릿의 각 컬럼 설명:</p>
            <div className="overflow-x-auto">
              <table className="min-w-full border text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border px-3 py-2 text-left">컬럼명</th>
                    <th className="border px-3 py-2 text-left">필수</th>
                    <th className="border px-3 py-2 text-left">설명</th>
                    <th className="border px-3 py-2 text-left">예시</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="border px-3 py-1.5">주문번호</td><td className="border px-3 py-1.5">선택</td><td className="border px-3 py-1.5">비워두면 자동 생성</td><td className="border px-3 py-1.5">ORD-20260401-001</td></tr>
                  <tr><td className="border px-3 py-1.5">상품코드</td><td className="border px-3 py-1.5">권장</td><td className="border px-3 py-1.5">[번호] 형식의 상품 코드</td><td className="border px-3 py-1.5">[33]</td></tr>
                  <tr><td className="border px-3 py-1.5">바코드</td><td className="border px-3 py-1.5">선택</td><td className="border px-3 py-1.5">상품 바코드 번호</td><td className="border px-3 py-1.5">8801234567890</td></tr>
                  <tr><td className="border px-3 py-1.5">상품명</td><td className="border px-3 py-1.5 font-bold">필수</td><td className="border px-3 py-1.5">상품명 (매칭 기준)</td><td className="border px-3 py-1.5">비타민C 1000mg</td></tr>
                  <tr><td className="border px-3 py-1.5">수량</td><td className="border px-3 py-1.5 font-bold">필수</td><td className="border px-3 py-1.5">주문 수량</td><td className="border px-3 py-1.5">10</td></tr>
                  <tr><td className="border px-3 py-1.5">금액</td><td className="border px-3 py-1.5 font-bold">필수</td><td className="border px-3 py-1.5">총 금액 (원)</td><td className="border px-3 py-1.5">50000</td></tr>
                  <tr><td className="border px-3 py-1.5">수신자명</td><td className="border px-3 py-1.5">선택</td><td className="border px-3 py-1.5">배송 받을 분 이름</td><td className="border px-3 py-1.5">홍길동</td></tr>
                  <tr><td className="border px-3 py-1.5">연락처</td><td className="border px-3 py-1.5">선택</td><td className="border px-3 py-1.5">수신자 연락처</td><td className="border px-3 py-1.5">010-1234-5678</td></tr>
                  <tr><td className="border px-3 py-1.5">주소</td><td className="border px-3 py-1.5">선택</td><td className="border px-3 py-1.5">배송 주소</td><td className="border px-3 py-1.5">서울시 강남구...</td></tr>
                </tbody>
              </table>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs">
              <strong>상품 매칭 우선순위:</strong> 상품코드 &rarr; 바코드 &rarr; 상품명(정확) &rarr; 상품명(부분 일치)
            </div>
          </div>
        </section>

        {/* 4. Status */}
        <section>
          <h2 className="text-lg font-bold border-b pb-2 mb-3">4. 발주 상태 설명</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-3 py-2 text-left">상태</th>
                  <th className="border px-3 py-2 text-left">설명</th>
                  <th className="border px-3 py-2 text-left">셀러 행동</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border px-3 py-1.5 font-medium text-yellow-600">대기중 (PENDING)</td><td className="border px-3 py-1.5">발주가 등록되어 관리자 검토 대기</td><td className="border px-3 py-1.5">대기</td></tr>
                <tr><td className="border px-3 py-1.5 font-medium text-green-600">승인 (APPROVED)</td><td className="border px-3 py-1.5">관리자가 발주를 승인</td><td className="border px-3 py-1.5">결제 진행</td></tr>
                <tr><td className="border px-3 py-1.5 font-medium text-blue-600">결제완료 (PAID)</td><td className="border px-3 py-1.5">가상계좌 입금 확인 완료</td><td className="border px-3 py-1.5">출고 대기</td></tr>
                <tr><td className="border px-3 py-1.5 font-medium text-purple-600">출고 (SHIPPED)</td><td className="border px-3 py-1.5">물류센터에서 상품 출고</td><td className="border px-3 py-1.5">배송 추적</td></tr>
                <tr><td className="border px-3 py-1.5 font-medium text-gray-600">완료 (DELIVERED)</td><td className="border px-3 py-1.5">배송 완료</td><td className="border px-3 py-1.5">수령 확인</td></tr>
                <tr><td className="border px-3 py-1.5 font-medium text-red-600">취소 (CANCELLED)</td><td className="border px-3 py-1.5">발주 취소됨</td><td className="border px-3 py-1.5">-</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. Payment */}
        <section>
          <h2 className="text-lg font-bold border-b pb-2 mb-3">5. 결제 안내</h2>
          <div className="space-y-3">
            <p>
              슈퍼무진은 <strong>가상계좌</strong> 결제 방식을 사용합니다.
            </p>
            <ol className="list-decimal list-inside space-y-1.5 ml-2">
              <li>발주가 승인되면 발주 상세 페이지에서 <strong>가상계좌 발급</strong> 버튼이 활성화됩니다.</li>
              <li>버튼을 클릭하면 입금 가능한 가상계좌 번호가 발급됩니다.</li>
              <li>해당 계좌로 정확한 금액을 입금합니다.</li>
              <li>입금 확인 후 자동으로 결제 완료 처리됩니다.</li>
            </ol>
            <div className="bg-red-50 border border-red-200 rounded p-3 text-xs">
              <strong>주의사항:</strong> 가상계좌는 유효기간이 있으며, 기간 내 미입금 시 자동 취소될 수 있습니다.
              정확한 금액을 입금해주세요.
            </div>
          </div>
        </section>

        {/* 6. Shipping */}
        <section>
          <h2 className="text-lg font-bold border-b pb-2 mb-3">6. 배송 및 출고</h2>
          <div className="space-y-3">
            <p>
              결제 완료된 발주는 ONEWMS 물류센터를 통해 출고됩니다.
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>결제 완료 후 1~2 영업일 이내 출고됩니다.</li>
              <li>출고 시 발주 상태가 <strong>출고(SHIPPED)</strong>로 변경됩니다.</li>
              <li>운송장 번호는 발주 상세 페이지에서 확인할 수 있습니다.</li>
              <li>배송 완료 후 상태가 <strong>완료(DELIVERED)</strong>로 변경됩니다.</li>
            </ul>
          </div>
        </section>

        {/* 7. FAQ */}
        <section>
          <h2 className="text-lg font-bold border-b pb-2 mb-3">7. 자주 묻는 질문</h2>
          <div className="space-y-4">
            <div>
              <p className="font-semibold">Q. 발주 등록 후 수정할 수 있나요?</p>
              <p className="text-muted-foreground ml-4">
                A. 대기중(PENDING) 상태에서만 취소 후 재등록이 가능합니다.
                승인 이후에는 관리자에게 문의하세요.
              </p>
            </div>
            <div>
              <p className="font-semibold">Q. 엑셀 업로드 시 상품 매칭이 안 되는 경우?</p>
              <p className="text-muted-foreground ml-4">
                A. 상품코드([번호] 형식)를 입력하거나, 시스템에 등록된 정확한 상품명을 사용하세요.
                바코드 번호로도 매칭됩니다.
              </p>
            </div>
            <div>
              <p className="font-semibold">Q. 가상계좌 입금 기한이 지나면?</p>
              <p className="text-muted-foreground ml-4">
                A. 기한 만료 시 해당 발주는 자동 취소됩니다. 새로 발주를 등록해주세요.
              </p>
            </div>
            <div>
              <p className="font-semibold">Q. 방송과 발주가 자동 연결되나요?</p>
              <p className="text-muted-foreground ml-4">
                A. 네, 같은 날짜에 등록된 방송이 있으면 자동으로 매칭됩니다.
                수동 매칭도 관리자가 진행할 수 있습니다.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground border-t pt-4">
          <p>슈퍼무진 라이브커머스 | supermujin.ai</p>
          <p>문의: 관리자에게 연락하세요</p>
        </div>
      </div>
    </div>
  );
}
