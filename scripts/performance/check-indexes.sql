-- Database Index Check Script
-- 현재 데이터베이스의 인덱스 상태를 확인하고 권장사항을 제공합니다.

-- 1. 모든 테이블의 인덱스 목록
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    schemaname = 'public'
ORDER BY
    tablename,
    indexname;

-- 2. 사용되지 않는 인덱스 찾기
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM
    pg_stat_user_indexes
WHERE
    idx_scan = 0
    AND schemaname = 'public'
ORDER BY
    tablename;

-- 3. 테이블 크기 및 인덱스 크기
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM
    pg_tables
WHERE
    schemaname = 'public'
ORDER BY
    pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 4. 누락된 인덱스 권장사항 (느린 쿼리 분석 필요)
-- Order 테이블: paymentStatus, shippingStatus로 자주 필터링
-- Product 테이블: barcode, code로 자주 검색
-- Broadcast 테이블: status, scheduledAt로 자주 필터링
-- ProposalCart 테이블: userId로 자주 조회

-- 권장 인덱스:
-- CREATE INDEX CONCURRENTLY idx_order_payment_shipping ON "Order" (paymentStatus, shippingStatus);
-- CREATE INDEX CONCURRENTLY idx_product_barcode ON "Product" (barcode); -- 이미 unique 제약으로 존재
-- CREATE INDEX CONCURRENTLY idx_product_code ON "Product" (code); -- 이미 unique 제약으로 존재
-- CREATE INDEX CONCURRENTLY idx_broadcast_status_scheduled ON "Broadcast" (status, scheduledAt);

-- 5. 복합 인덱스 효율성 확인
SELECT
    tablename,
    indexname,
    attname AS column_name,
    attnum AS column_position
FROM
    pg_index
    JOIN pg_class ON pg_class.oid = pg_index.indexrelid
    JOIN pg_attribute ON pg_attribute.attrelid = pg_class.oid
WHERE
    pg_class.relname IN (
        SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    )
ORDER BY
    pg_class.relname,
    attnum;

-- 6. Slow Query 로깅 활성화 권장
-- postgresql.conf 설정:
-- log_min_duration_statement = 1000  # 1초 이상 걸리는 쿼리 로깅
-- log_statement = 'all'              # 모든 쿼리 로깅 (개발 환경)
-- log_duration = on                  # 쿼리 실행 시간 로깅
