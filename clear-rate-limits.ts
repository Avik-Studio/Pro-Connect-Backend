// ===========================================
// CLEAR RATE LIMITS - Development Utility
// ===========================================

import { redis } from './src/config/redis';
import { logger } from './src/utils/logger';

/**
 * Clear all rate limit keys from Redis
 */
async function clearRateLimits() {
  try {
    console.log('🔍 Scanning for rate limit keys...');
    
    // Get all rate limit keys
    const keys = await redis.keys('ratelimit:*');
    
    if (keys.length === 0) {
      console.log('✅ No rate limit keys found');
      return;
    }
    
    console.log(`📋 Found ${keys.length} rate limit keys`);
    
    // Delete all rate limit keys
    if (keys.length > 0) {
      const deleted = await redis.del(...keys);
      console.log(`🗑️  Deleted ${deleted} rate limit keys`);
    }
    
    console.log('✅ Rate limits cleared successfully!');
    console.log('');
    console.log('You can now login again.');
    
  } catch (error) {
    console.error('❌ Error clearing rate limits:', error);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

// Run the script
clearRateLimits();
