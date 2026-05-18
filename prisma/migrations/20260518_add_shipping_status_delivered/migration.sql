-- Add DELIVERED variant to ShippingStatus enum
ALTER TYPE "ShippingStatus" ADD VALUE 'DELIVERED' BEFORE 'PARTIAL';
