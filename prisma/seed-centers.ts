/**
 * Center Seed Data
 * 17 regional centers based on South Korean administrative divisions
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaNeon({ connectionString: DATABASE_URL } as any);
const prisma = new PrismaClient({
  adapter,
} as unknown as ConstructorParameters<typeof PrismaClient>[0]);

// 17 regions in South Korea
const REGIONS = [
  { code: '01', name: '서울특별시' },
  { code: '02', name: '경기도' },
  { code: '03', name: '인천광역시' },
  { code: '04', name: '강원특별자치도' },
  { code: '05', name: '충청북도' },
  { code: '06', name: '충청남도' },
  { code: '07', name: '대전광역시' },
  { code: '08', name: '세종특별자치시' },
  { code: '09', name: '전북특별자치도' },
  { code: '10', name: '전라남도' },
  { code: '11', name: '광주광역시' },
  { code: '12', name: '경상북도' },
  { code: '13', name: '경상남도' },
  { code: '14', name: '대구광역시' },
  { code: '15', name: '울산광역시' },
  { code: '16', name: '부산광역시' },
  { code: '17', name: '제주특별자치도' },
];

// Sample center data for initial 3 centers (Seoul, Gyeonggi, Incheon)
const INITIAL_CENTERS = [
  {
    regionCode: '01',
    phoneCode: '4213', // Sample phone code
    name: '서울센터',
    regionName: '서울특별시',
    representative: '김서울',
    representativePhone: '010-1234-4213',
    address: '서울특별시 강남구 테헤란로 152',
    addressDetail: '강남파이낸스센터 10층',
    businessNo: '123-45-67890',
  },
  {
    regionCode: '02',
    phoneCode: '5678',
    name: '경기센터',
    regionName: '경기도',
    representative: '이경기',
    representativePhone: '010-2345-5678',
    address: '경기도 성남시 분당구 판교역로 166',
    addressDetail: '판교 테크원타워 5층',
    businessNo: '234-56-78901',
  },
  {
    regionCode: '03',
    phoneCode: '9012',
    name: '인천센터',
    regionName: '인천광역시',
    representative: '박인천',
    representativePhone: '010-3456-9012',
    address: '인천광역시 연수구 송도과학로 32',
    addressDetail: '송도 G타워 3층',
    businessNo: '345-67-89012',
  },
];

export async function seedCenters() {
  console.log('🌱 Seeding centers...');

  let createdCount = 0;
  let skippedCount = 0;

  for (const centerData of INITIAL_CENTERS) {
    const code = `${centerData.regionCode}-${centerData.phoneCode}`;

    // Check if center already exists
    const existing = await prisma.center.findUnique({
      where: { code },
    });

    if (existing) {
      console.log(`⏭️  Center ${code} (${centerData.name}) already exists, skipping`);
      skippedCount++;
      continue;
    }

    await prisma.center.create({
      data: {
        code,
        name: centerData.name,
        regionCode: centerData.regionCode,
        regionName: centerData.regionName,
        representative: centerData.representative,
        representativePhone: centerData.representativePhone,
        address: centerData.address,
        addressDetail: centerData.addressDetail,
        businessNo: centerData.businessNo,
        isActive: true,
      },
    });

    console.log(`✅ Created center: ${code} (${centerData.name})`);
    createdCount++;
  }

  console.log(`\n📊 Center seeding complete:`);
  console.log(`   ✅ Created: ${createdCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);

  return { created: createdCount, skipped: skippedCount };
}

// Run if called directly
if (require.main === module) {
  seedCenters()
    .catch((e) => {
      console.error('❌ Error seeding centers:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
