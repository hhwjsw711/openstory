#!/usr/bin/env bun

import { Client } from '@upstash/qstash';

async function testQStashConnection() {
  const token = process.env.QSTASH_TOKEN;

  if (!token) {
    console.error('❌ QSTASH_TOKEN environment variable is not set');
    process.exit(1);
  }

  console.log('🔍 Testing QStash connection...');
  console.log('Token present:', !!token);
  console.log('Token length:', token.length);
  console.log('Token prefix:', `${token.substring(0, 10)}...`);

  try {
    const client = new Client({ token });

    // Try to publish a test message
    const testUrl = 'https://httpbin.org/post';
    const response = await client.publishJSON({
      url: testUrl,
      body: { test: true, timestamp: Date.now() },
    });

    console.log('✅ Successfully connected to QStash!');
    console.log('Test message ID:', response.messageId);
  } catch (error) {
    console.error('❌ Failed to connect to QStash:');
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error details:', error);
    }
    process.exit(1);
  }
}

testQStashConnection();
