const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
let envContent = '';
try {
    envContent = fs.readFileSync(envPath, 'utf8');
} catch (_e) {
    console.error('Could not read .env file');
    process.exit(1);
}

const getEnv = (key) => {
    const match = envContent.match(new RegExp(`${key}=(.*)`));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('EXPO_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findSupport() {
    console.log('Searching for support user...');

    // Try to find user with 'support' in email or name
    // Note: we might not have permission to list all users depending on RLS
    // But usually we can read public profiles.

    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .limit(10);

    if (error) {
        console.error('Error fetching users:', error);
        // Try 'drivers' table?
        const { data: drivers, error: driverError } = await supabase
            .from('drivers')
            .select('*')
            .limit(10);
        if (driverError) console.error('Error fetching drivers:', driverError);
        else {
            console.log('Drivers found:', drivers?.length);
            if (drivers?.length) console.log('First driver:', drivers[0]);
        }
        return;
    }

    console.log(`Found ${users.length} users.`);
    if (users.length > 0) {
        console.log('First user sample:', users[0]);
    }

    // Check if we can search
    const { data: supportUsers, error: searchError } = await supabase
        .from('users')
        .select('*')
        .ilike('email', '%support%');

    if (searchError) {
        console.log('Search by email failed (column might not exist or RLS):', searchError.message);
    } else if (supportUsers && supportUsers.length > 0) {
        console.log('Potential support users found:', supportUsers);
    } else {
        console.log('No users with "support" in email found.');
    }
}

findSupport();
