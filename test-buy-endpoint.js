// Simple test script for the buy endpoint
// Run with: node test-buy-endpoint.js

const testEndpoint = async () => {
  const url = 'http://localhost:3000/api/items/buy';
  
  // Test 1: Missing required fields
  console.log('Test 1: Missing itemId');
  try {
    const response1 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerId: 'test-buyer-id' })
    });
    const data1 = await response1.json();
    console.log('Status:', response1.status);
    console.log('Response:', JSON.stringify(data1, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 2: Missing buyerId
  console.log('Test 2: Missing buyerId');
  try {
    const response2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'test-item-id' })
    });
    const data2 = await response2.json();
    console.log('Status:', response2.status);
    console.log('Response:', JSON.stringify(data2, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 3: Invalid JSON
  console.log('Test 3: Invalid JSON body');
  try {
    const response3 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json'
    });
    const data3 = await response3.json();
    console.log('Status:', response3.status);
    console.log('Response:', JSON.stringify(data3, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 4: Valid request (will fail without real data, but tests the endpoint structure)
  console.log('Test 4: Valid request structure (will fail without real Supabase data)');
  try {
    const response4 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        itemId: '00000000-0000-0000-0000-000000000000',
        buyerId: '11111111-1111-1111-1111-111111111111'
      })
    });
    const data4 = await response4.json();
    console.log('Status:', response4.status);
    console.log('Response:', JSON.stringify(data4, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
};

// Check if server is running first
fetch('http://localhost:3000')
  .then(() => {
    console.log('✓ Server is running on http://localhost:3000\n');
    testEndpoint();
  })
  .catch((error) => {
    console.error('✗ Server is not running. Please start it with: npm run dev');
    console.error('Error:', error.message);
    process.exit(1);
  });


