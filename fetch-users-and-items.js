// Script to fetch all users and their items from Supabase
// This helps identify who are sellers (have items) and who are buyers
// Run with: node fetch-users-and-items.js

const fetchData = async () => {
  try {
    console.log('Fetching users and items from Supabase...\n');
    
    // Fetch users
    const usersResponse = await fetch('http://localhost:3000/api/users');
    if (!usersResponse.ok) {
      throw new Error(`Failed to fetch users: ${usersResponse.status}`);
    }
    const usersData = await usersResponse.json();
    
    // Fetch items (if there's an endpoint, otherwise we'll note it)
    let itemsData = { items: [] };
    try {
      // Note: You may need to create a GET /api/items endpoint
      // For now, we'll just show users
    } catch (err) {
      console.log('Note: Items endpoint not available, showing users only\n');
    }
    
    console.log(`✓ Found ${usersData.total} users\n`);
    console.log('='.repeat(80));
    console.log('ALL USERS');
    console.log('='.repeat(80));
    console.log();
    
    if (usersData.users.length === 0) {
      console.log('No users found in the database.');
      console.log('\nTo create test users, use: POST /api/auth/register');
      return;
    }
    
    // Group users (we'll identify sellers by checking if they have items)
    const sellers = [];
    const buyers = [];
    
    usersData.users.forEach((user, index) => {
      const userInfo = {
        number: index + 1,
        id: user.id,
        name: user.name || user.email || 'Unknown',
        email: user.email || 'N/A',
        username: user.username || 'N/A',
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
        phone: user.phone || 'N/A',
        createdAt: user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A',
      };
      
      // For now, we'll show all users - you can manually identify sellers
      // by checking which users have items in the items table
      console.log(`${userInfo.number}. ${userInfo.name}`);
      console.log(`   ID: ${userInfo.id}`);
      console.log(`   Email: ${userInfo.email}`);
      console.log(`   Username: ${userInfo.username}`);
      console.log(`   Full Name: ${userInfo.fullName}`);
      console.log(`   Phone: ${userInfo.phone}`);
      console.log(`   Created: ${userInfo.createdAt}`);
      console.log();
    });
    
    console.log('='.repeat(80));
    console.log('\n📋 USAGE GUIDE:');
    console.log('='.repeat(80));
    console.log('\nTo test the buy endpoint:');
    console.log('1. Pick a SELLER ID (user who has items listed)');
    console.log('2. Pick a BUYER ID (different user)');
    console.log('3. Get an ITEM ID from the items table (seller_id should match seller)');
    console.log('4. Call: POST /api/items/buy');
    console.log('   {');
    console.log('     "itemId": "<item-id-from-database>",');
    console.log('     "buyerId": "<buyer-user-id>"');
    console.log('   }');
    console.log('\nExample:');
    console.log('curl -X POST http://localhost:3000/api/items/buy \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"itemId": "abc-123", "buyerId": "xyz-789"}\'');
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('✗ Error:', error.message);
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
    fetchData();
  })
  .catch((error) => {
    console.error('✗ Server is not running. Please start it with: npm run dev');
    console.error('Error:', error.message);
    process.exit(1);
  });

