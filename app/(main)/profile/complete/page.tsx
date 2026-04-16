'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

// 카테고리 옵션
const CATEGORIES = [
  '패션/의류',
  '뷰티/화장품',
  '식품/건강',
  '가전/디지털',
  '생활/주방',
  '스포츠/레저',
  '완구/유아',
  '도서/문구',
];

// 지역 옵션
const REGIONS = [
  '서울',
  '경기',
  '인천',
  '부산',
  '대구',
  '대전',
  '광주',
  '울산',
  '세종',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
];

// 방송 시간대 옵션
const TIME_SLOTS = [
  '오전 (06:00-12:00)',
  '오후 (12:00-18:00)',
  '저녁 (18:00-22:00)',
  '심야 (22:00-06:00)',
];

export default function ProfileCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');

  const [categories, setCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (
    list: string[],
    setList: (list: string[]) => void,
    item: string
  ) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleSave = async () => {
    if (!userId) {
      toast.error('사용자 ID가 없습니다');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/users/${userId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories,
          regions,
          timeSlots,
        }),
      });

      if (!response.ok) {
        throw new Error('프로필 업데이트 실패');
      }

      toast.success('프로필이 업데이트되었습니다');
      router.push('/login');
    } catch (error) {
      toast.error('프로필 업데이트 중 오류가 발생했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    router.push('/login');
  };

  return (
    <div className="container max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>프로필 완성하기</CardTitle>
          <p className="text-sm text-muted-foreground">
            추가 정보를 입력하면 더 나은 방송 매칭을 받을 수 있습니다 (선택사항)
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 주요 판매 카테고리 */}
          <div>
            <Label>주요 판매 카테고리</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {CATEGORIES.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    checked={categories.includes(category)}
                    onCheckedChange={() =>
                      handleToggle(categories, setCategories, category)
                    }
                  />
                  <label className="text-sm">{category}</label>
                </div>
              ))}
            </div>
          </div>

          {/* 활동 지역 */}
          <div>
            <Label>활동 지역</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {REGIONS.map((region) => (
                <div key={region} className="flex items-center space-x-2">
                  <Checkbox
                    checked={regions.includes(region)}
                    onCheckedChange={() =>
                      handleToggle(regions, setRegions, region)
                    }
                  />
                  <label className="text-sm">{region}</label>
                </div>
              ))}
            </div>
          </div>

          {/* 방송 가능 시간대 */}
          <div>
            <Label>방송 가능 시간대</Label>
            <div className="space-y-2 mt-2">
              {TIME_SLOTS.map((slot) => (
                <div key={slot} className="flex items-center space-x-2">
                  <Checkbox
                    checked={timeSlots.includes(slot)}
                    onCheckedChange={() =>
                      handleToggle(timeSlots, setTimeSlots, slot)
                    }
                  />
                  <label className="text-sm">{slot}</label>
                </div>
              ))}
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? '저장 중...' : '저장하기'}
            </Button>
            <Button variant="outline" onClick={handleSkip}>
              나중에 하기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
