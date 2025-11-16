// Script to fetch all users (buyers and sellers) from Supabase
// Run with: node fetch-users.js

const fetchUsers = async () => {
  try {
    console.log('Fetching users from Supabase...\n');
    
    const response = await fetch('http://localhost:3000/api/users');
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    
    const data = await response.json();
    
    console.log(`✓ Found ${data.total} total users\n`);
    console.log('='.repeat(80));
    console.log('ALL USERS (Buyers & Sellers)');
    console.log('='.repeat(80));
    console.log();
    
    if (data.users.length === 0) {
      console.log('No users found in the database.');
      return;
    }
    
    data.users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || user.email || 'Unknown'}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Username: ${user.username || 'N/A'}`);
      console.log(`   Name: ${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A');
      console.log(`   Phone: ${user.phone || 'N/A'}`);
      console.log(`   Created: ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}`);
      console.log();
    });
    
    console.log('='.repeat(80));
    console.log('\nTo use these users for testing the buy endpoint:');
    console.log('1. Pick a seller ID (user who has items)');
    console.log('2. Pick a buyer ID (different user)');
    console.log('3. Use them in: POST /api/items/buy');
    console.log('   { "itemId": "<item-id>", "buyerId": "<buyer-user-id>" }');
    
  } catch (error) {
    console.error('✗ Error fetching users:', error.message);
    console.error('\nMake sure:');
    console.error('1. The server is running (npm run dev)');
    console.error('2. Environment variables are set in .env.local');
    console.error('3. SUPABASE_SERVICE_ROLE_KEY has admin access');
    process.exit(1);
  }
};

// Check if server is running first
fetch('http://localhost:3000')
  .then(() => {
    fetchUsers();
  })
  .catch((error) => {
    console.error('✗ Server is not running. Please start it with: npm run dev');
    console.error('Error:', error.message);
    process.exit(1);
  });

