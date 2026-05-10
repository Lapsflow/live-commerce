// PROPOSAL-06: 이미지 업로드 API (Vercel Blob Storage + base64 fallback)
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  // 인증
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { message: "인증이 필요합니다." } }, { status: 401 });
  }

  // FormData는 한 번만 읽을 수 있으므로 try 블록 밖에서 파싱하여 fallback에서도 재사용
  let file: File | null = null;
  try {
    const formData = await req.formData();
    file = formData.get("file") as File | null;
  } catch (err: any) {
    console.error("[UPLOAD] FormData parse error:", err);
    return NextResponse.json(
      { error: { message: "요청 파싱에 실패했습니다." } },
      { status: 400 }
    );
  }

  if (!file) {
    return NextResponse.json({ error: { message: "파일이 필요합니다." } }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: { message: "지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, GIF만 허용)" } },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: { message: "파일 크기가 5MB를 초과합니다." } },
      { status: 400 }
    );
  }

  // 1차: Vercel Blob 업로드 시도
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "image";
    const filename = `proposals/${Date.now()}-${safeName}`;
    const blob = await put(filename, file, { access: "public" });

    return NextResponse.json({
      success: true,
      data: {
        url: blob.url,
        pathname: blob.pathname,
        size: file.size,
        type: file.type,
      },
    });
  } catch (err: any) {
    console.error("[UPLOAD] Blob put failed, falling back to base64:", err?.message || err);

    // 2차: base64 data URL fallback
    // (BLOB_READ_WRITE_TOKEN 미설정, 네트워크 오류 등 모든 케이스를 커버)
    try {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const dataUrl = `data:${file.type};base64,${base64}`;

      return NextResponse.json({
        success: true,
        data: {
          url: dataUrl,
          pathname: file.name,
          size: file.size,
          type: file.type,
        },
      });
    } catch (fallbackErr: any) {
      console.error("[UPLOAD] base64 fallback failed:", fallbackErr);
      return NextResponse.json(
        { error: { message: fallbackErr?.message || "업로드 실패" } },
        { status: 500 }
      );
    }
  }
}
