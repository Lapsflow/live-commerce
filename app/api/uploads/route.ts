// PROPOSAL-06: 이미지 업로드 API (Vercel Blob Storage)
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: { message: "인증이 필요합니다." } }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

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

    // Vercel Blob에 업로드
    const filename = `proposals/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const blob = await put(filename, file, {
      access: "public",
    });

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
    console.error("[UPLOAD ERROR]", err);

    // Vercel Blob 미설정 시 fallback: base64 data URL
    if (err.message?.includes("BLOB_READ_WRITE_TOKEN")) {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        if (file) {
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
        }
      } catch {
        // fallback 실패
      }
    }

    return NextResponse.json(
      { error: { message: err.message || "업로드 실패" } },
      { status: 500 }
    );
  }
}
