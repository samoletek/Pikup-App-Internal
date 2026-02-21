const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.EXPO_PUBLIC_SUPABASE_URL, envConfig.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
    console.log("🔍 diagnostic: Listing relevant users...");

    // Check 'users' table (or auth.users if possible, but usually restricted)
    // We'll check public.users
    const { data: users, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name')
        .ilike('email', '%architeq.io%'); // Filter for relevant emails

    if (error) {
        console.error("Error fetching users:", error);
    } else {
        console.log("Users found:", users);
    }

    const { data: customers } = await supabase.from('customers').select('id, email');
    console.log("Customers found:", customers);

    const { data: drivers } = await supabase.from('drivers').select('id, email');
    console.log("Drivers found:", drivers);
}

main();
