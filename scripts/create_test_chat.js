const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

// 1. Load Environment Variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');

if (!fs.existsSync(envPath)) {
    console.error("❌ .env.local file not found at:", envPath);
    process.exit(1);
}

const envConfig = dotenv.parse(fs.readFileSync(envPath));

const SUPABASE_URL = envConfig.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = envConfig.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("❌ Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    console.log("🔍 Finding users for test chat...");

    // 1. Find a Customer
    const { data: customers, error: customerError } = await supabase
        .from('customers')
        .select('id, email, first_name')
        .eq('email', 'drewc@architeq.io')
        .single();

    if (customerError || !customers) {
        console.error("❌ Customer 'drewc@architeq.io' not found.");
        return;
    }
    const customer = customers;
    console.log(`✅ Found Customer: ${customer.email} (${customer.id})`);

    // 2. Find a Driver
    let driver;
    const { data: drivers, error: driverError } = await supabase
        .from('drivers')
        .select('id, email, first_name')
        .eq('email', 'drew@architeq.io')
        .single();

    if (driverError || !drivers) {
        console.log("⚠️ Driver 'drew@architeq.io' not found in drivers view. Checking users table...");
        const { data: userDriver } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', 'drew@architeq.io')
            .single();

        if (userDriver) {
            driver = { ...userDriver, first_name: 'Drew' };
        } else {
            console.error("❌ Driver 'drew@architeq.io' not found anywhere.");
            return;
        }
    } else {
        driver = drivers;
    }
    console.log(`✅ Found Driver: ${driver.email} (${driver.id})`);

    // 3. Create a Mock Trip (Order)
    console.log("🚚 Creating mock trip...");
    const tripData = {
        customer_id: customer.id,
        driver_id: driver.id,
        pickup_location: {
            address: "123 Test St, Test City",
            coordinates: { latitude: 37.7749, longitude: -122.4194 }
        },
        dropoff_location: {
            address: "456 Mock Ave, Mock Town",
            coordinates: { latitude: 37.7849, longitude: -122.4094 }
        },
        vehicle_type: "Standard",
        price: 50.00,
        distance_miles: 5.5,
        status: "in_progress", // active status
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    const { data: trip, error: tripError } = await supabase
        .from('trips')
        .insert(tripData)
        .select()
        .single();

    if (tripError) {
        console.error("❌ Error creating trip:", tripError);
        return;
    }
    console.log(`✅ Created Trip: ${trip.id}`);

    // 4. Create Conversation
    console.log("💬 Creating conversation...");
    const conversationData = {
        request_id: trip.id,
        customer_id: customer.id,
        driver_id: driver.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    // Check if existed first (though unlikely for new trip)
    const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('request_id', trip.id)
        .maybeSingle();

    if (existingConv) {
        console.log(`⚠️ Conversation already exists: ${existingConv.id}`);
    } else {
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert(conversationData)
            .select()
            .single();

        if (convError) {
            console.error("❌ Error creating conversation:", convError);
            return;
        }
        console.log(`✅ Created Conversation: ${conversation.id}`);

        // 5. Insert initial message
        const { error: msgError } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversation.id,
                sender_id: customer.id,
                text: "Hi! This is a test message from the script.",
                created_at: new Date().toISOString(),
                read: false
            });

        if (msgError) {
            console.error("❌ Error sending initial message:", msgError);
        } else {
            console.log("✅ Sent initial message");
        }
    }

    console.log("\n🎉 DONE! Test environment ready.");
    console.log(`👉 Customer: ${customer.email}`);
    console.log(`👉 Driver: ${driver.email}`);
}

main();
