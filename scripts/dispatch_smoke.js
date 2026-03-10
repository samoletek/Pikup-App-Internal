#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const REQUEST_POOLS = new Set(['all', 'asap', 'scheduled']);
const FUNCTION_NAME = 'get-driver-request-pool';

const usage = `
Dispatch smoke test (no UI)

Required:
  --driverAEmail=...
  --driverAPassword=...
  --driverBEmail=...
  --driverBPassword=...

Optional:
  --requestPool=asap|scheduled|all   (default: asap)
  --tripId=<uuid>                    (default: first overlap trip)
  --accept                           (mutates data: driver A accepts target trip)
  --acceptRace                       (mutates data: driver A/B accept target trip concurrently)
  --allowSingleDriver                (allow accept test when trip is visible only to driver A)
  --customerEmail=... --customerPassword=...
                                     (optional: seed pending trip if pool is empty)
  --seedScheduledMinutes=<num>       (optional seed mode; >0 means scheduled)
  --driverALat=<num> --driverALng=<num>
  --driverBLat=<num> --driverBLng=<num>
  --help

Examples:
  node scripts/dispatch_smoke.js \\
    --driverAEmail=a@x.com --driverAPassword=*** \\
    --driverBEmail=b@x.com --driverBPassword=***

  node scripts/dispatch_smoke.js \\
    --driverAEmail=a@x.com --driverAPassword=*** \\
    --driverBEmail=b@x.com --driverBPassword=*** \\
    --accept --requestPool=asap

  node scripts/dispatch_smoke.js \\
    --driverAEmail=a@x.com --driverAPassword=*** \\
    --driverBEmail=b@x.com --driverBPassword=*** \\
    --accept --allowSingleDriver

  node scripts/dispatch_smoke.js \\
    --driverAEmail=a@x.com --driverAPassword=*** \\
    --driverBEmail=b@x.com --driverBPassword=*** \\
    --acceptRace --requestPool=asap
`.trim();

const parseArgs = (argv) => {
    const options = {};
    argv.forEach((arg) => {
        if (!arg.startsWith('--')) return;
        const body = arg.slice(2);
        const eq = body.indexOf('=');
        if (eq === -1) {
            options[body] = true;
            return;
        }
        const key = body.slice(0, eq);
        const value = body.slice(eq + 1);
        options[key] = value;
    });
    return options;
};

const createIdempotencyKey = (action, tripId, driverId) => {
    const actionPart = String(action || 'action').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
    const tripPart = String(tripId || '').replace(/[^a-zA-Z0-9]+/g, '').slice(-16);
    const driverPart = String(driverId || '').replace(/[^a-zA-Z0-9]+/g, '').slice(-12);
    const timestampPart = Date.now().toString(36);
    const randomPart = Math.random().toString(36).slice(2, 10);
    return [actionPart || 'action', tripPart || 'trip', driverPart || 'driver', timestampPart, randomPart].join('_');
};

const readNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseOptionalLocation = (args, prefix) => {
    const lat = readNumber(args[`${prefix}Lat`]);
    const lng = readNumber(args[`${prefix}Lng`]);
    if (lat == null || lng == null) return null;
    return { latitude: lat, longitude: lng };
};

const loadEnv = () => {
    const envPath = path.resolve(__dirname, '../.env.local');
    let fileVars = {};

    if (fs.existsSync(envPath)) {
        fileVars = dotenv.parse(fs.readFileSync(envPath));
    }

    return { ...fileVars, ...process.env };
};

const buildSupabaseClient = (url, anonKey) =>
    createClient(url, anonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
    });

const signInActor = async (label, email, password, url, anonKey) => {
    const client = buildSupabaseClient(url, anonKey);
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
        const reason = error?.message || 'unknown auth error';
        throw new Error(`${label} sign-in failed: ${reason}`);
    }

    return {
        label,
        client,
        user: data.user,
    };
};

const createPendingTripForCustomer = async (customer, seedScheduledMinutes = null) => {
    const nowIso = new Date().toISOString();
    const scheduledTime = Number.isFinite(seedScheduledMinutes) && seedScheduledMinutes > 0
        ? new Date(Date.now() + seedScheduledMinutes * 60 * 1000).toISOString()
        : null;

    const tripData = {
        customer_id: customer.user.id,
        pickup_location: {
            address: 'Dispatch Smoke Pickup',
            coordinates: { latitude: 37.7749, longitude: -122.4194 },
            details: { driverHelp: true, smokeSeed: true },
        },
        dropoff_location: {
            address: 'Dispatch Smoke Dropoff',
            coordinates: { latitude: 37.7849, longitude: -122.4094 },
            details: { smokeSeed: true },
        },
        vehicle_type: 'Standard',
        price: 42.5,
        distance_miles: 3.2,
        items: [{ name: 'Smoke Test Box', weight: 20, value: 25, category: 'boxes' }],
        scheduled_time: scheduledTime,
        status: 'pending',
        created_at: nowIso,
        updated_at: nowIso,
    };

    const { data, error } = await customer.client
        .from('trips')
        .insert(tripData)
        .select('id,status,scheduled_time,customer_id')
        .single();

    if (error || !data?.id) {
        throw new Error(`Failed to seed pending trip: ${error?.message || error?.details || 'unknown error'}`);
    }

    return data;
};

const invokeDriverPool = async (driver, requestPool, location = null) => {
    const body = { requestPool };
    if (location) body.driverLocation = location;

    const { data, error } = await driver.client.functions.invoke(FUNCTION_NAME, { body });
    if (error) {
        const details = [error.status ? `status ${error.status}` : null, error.message || error.details]
            .filter(Boolean)
            .join(': ');
        throw new Error(`${driver.label} invoke ${FUNCTION_NAME} failed: ${details || 'unknown error'}`);
    }

    const requests = Array.isArray(data)
        ? data
        : Array.isArray(data?.requests)
            ? data.requests
            : [];
    const meta = Array.isArray(data) ? null : data?.meta || null;

    return { requests, meta };
};

const acceptTripAsDriver = async (driver, tripId, options = {}) => {
    const driverId = driver.user.id;
    const idempotencyKey = options.idempotencyKey || createIdempotencyKey('accept', tripId, driverId);

    const { data: rpcRows, error: rpcError } = await driver.client.rpc('accept_trip_request', {
        p_trip_id: tripId,
        p_driver_id: driverId,
        p_idempotency_key: idempotencyKey,
    });

    if (rpcError) {
        throw new Error(`accept_trip_request RPC failed: ${rpcError.message || rpcError.details || rpcError}`);
    }

    if (Array.isArray(rpcRows) && rpcRows.length > 0) {
        return {
            outcome: 'accepted',
            path: 'rpc_rows',
            idempotencyKey,
            trip: rpcRows[0],
        };
    }

    const { data: latestTrip, error: latestError } = await driver.client
        .from('trips')
        .select('id,status,driver_id')
        .eq('id', tripId)
        .maybeSingle();

    if (!latestError && latestTrip?.status === 'accepted' && latestTrip?.driver_id === driverId) {
        return {
            outcome: 'accepted',
            path: 'rpc_refetch',
            idempotencyKey,
            trip: latestTrip,
        };
    }

    return {
        outcome: 'unavailable',
        path: latestError ? 'rpc_refetch_failed' : 'rpc_no_rows',
        idempotencyKey,
        trip: latestTrip || null,
        error: latestError ? latestError.message || latestError.details || String(latestError) : null,
    };
};

const toIds = (requests) => requests.map((request) => String(request?.id || '')).filter(Boolean);

const main = async () => {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        console.log(usage);
        process.exit(0);
    }

    const requestPool = String(args.requestPool || 'asap').trim().toLowerCase();
    if (!REQUEST_POOLS.has(requestPool)) {
        throw new Error(`Invalid --requestPool="${requestPool}". Allowed: all|asap|scheduled`);
    }

    const required = ['driverAEmail', 'driverAPassword', 'driverBEmail', 'driverBPassword'];
    const missing = required.filter((key) => !String(args[key] || '').trim());
    if (missing.length > 0) {
        throw new Error(`Missing required args: ${missing.join(', ')}\n\n${usage}`);
    }

    const env = loadEnv();
    const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
    }

    const driverALocation = parseOptionalLocation(args, 'driverA');
    const driverBLocation = parseOptionalLocation(args, 'driverB');
    const seedScheduledMinutesRaw = readNumber(args.seedScheduledMinutes);
    const seedScheduledMinutes = Number.isFinite(seedScheduledMinutesRaw) && seedScheduledMinutesRaw > 0
        ? Math.floor(seedScheduledMinutesRaw)
        : null;

    const driverA = await signInActor('Driver A', args.driverAEmail, args.driverAPassword, supabaseUrl, supabaseAnonKey);
    const driverB = await signInActor('Driver B', args.driverBEmail, args.driverBPassword, supabaseUrl, supabaseAnonKey);

    console.log(`Signed in drivers: A=${driverA.user.id}, B=${driverB.user.id}`);

    const beforeA = await invokeDriverPool(driverA, requestPool, driverALocation);
    const beforeB = await invokeDriverPool(driverB, requestPool, driverBLocation);
    let beforeAIds = toIds(beforeA.requests);
    let beforeBIds = toIds(beforeB.requests);
    let beforeASet = new Set(beforeAIds);
    let overlap = beforeBIds.filter((id) => beforeASet.has(id));
    let targetTripId = String(args.tripId || overlap[0] || beforeAIds[0] || '').trim();

    console.log(
        JSON.stringify(
            {
                phase: 'before',
                requestPool,
                driverA_count: beforeAIds.length,
                driverB_count: beforeBIds.length,
                overlap_count: overlap.length,
                targetTripId: targetTripId || null,
                driverA_meta: beforeA.meta || null,
                driverB_meta: beforeB.meta || null,
            },
            null,
            2
        )
    );

    if (!targetTripId) {
        const customerEmail = String(args.customerEmail || '').trim();
        const customerPassword = String(args.customerPassword || '').trim();

        if (customerEmail && customerPassword) {
            const customer = await signInActor(
                'Customer',
                customerEmail,
                customerPassword,
                supabaseUrl,
                supabaseAnonKey
            );
            const seededTrip = await createPendingTripForCustomer(customer, seedScheduledMinutes);
            console.log(
                JSON.stringify(
                    {
                        phase: 'seeded',
                        seededTripId: seededTrip.id,
                        scheduledTime: seededTrip.scheduled_time || null,
                    },
                    null,
                    2
                )
            );

            await new Promise((resolve) => setTimeout(resolve, 1200));
            const refreshedA = await invokeDriverPool(driverA, requestPool, driverALocation);
            const refreshedB = await invokeDriverPool(driverB, requestPool, driverBLocation);
            beforeAIds = toIds(refreshedA.requests);
            beforeBIds = toIds(refreshedB.requests);
            beforeASet = new Set(beforeAIds);
            overlap = beforeBIds.filter((id) => beforeASet.has(id));
            targetTripId = String(args.tripId || overlap[0] || beforeAIds[0] || '').trim();

            console.log(
                JSON.stringify(
                    {
                        phase: 'after_seed',
                        requestPool,
                        driverA_count: beforeAIds.length,
                        driverB_count: beforeBIds.length,
                        overlap_count: overlap.length,
                        targetTripId: targetTripId || null,
                    },
                    null,
                    2
                )
            );
        }
    }

    if (!targetTripId) {
        throw new Error(
            'No candidate trip found. Provide --tripId, create a pending trip, or pass --customerEmail/--customerPassword to seed one.'
        );
    }

    const visibleToDriverABefore = beforeAIds.includes(targetTripId);
    const visibleToDriverBBefore = beforeBIds.includes(targetTripId);
    const strictTwoDriverMode = !args.allowSingleDriver;
    const shouldAccept = Boolean(args.accept);
    const shouldAcceptRace = Boolean(args.acceptRace || args['accept-race']);

    if (shouldAccept && shouldAcceptRace) {
        throw new Error('Use either --accept or --acceptRace, not both.');
    }

    if ((shouldAccept || shouldAcceptRace) && !visibleToDriverABefore) {
        throw new Error(`Target trip ${targetTripId} is not visible to driver A before accept.`);
    }

    if ((shouldAccept || shouldAcceptRace) && strictTwoDriverMode && !visibleToDriverBBefore) {
        console.log(
            JSON.stringify(
                {
                    phase: 'inconclusive',
                    reason: 'target trip is not visible to driver B before accept',
                    targetTripId,
                    suggestion:
                        'Create a trip matching both drivers preferences, or rerun with --allowSingleDriver for non-overlap validation.',
                },
                null,
                2
            )
        );
        process.exit(3);
    }

    if (!shouldAccept && !shouldAcceptRace) {
        console.log('Dry-run complete. Re-run with --accept or --acceptRace to validate acceptance behavior.');
        process.exit(0);
    }

    if (shouldAcceptRace) {
        const [acceptA, acceptB] = await Promise.all([
            acceptTripAsDriver(driverA, targetTripId, {
                idempotencyKey: createIdempotencyKey('accept', targetTripId, driverA.user.id),
            }),
            acceptTripAsDriver(driverB, targetTripId, {
                idempotencyKey: createIdempotencyKey('accept', targetTripId, driverB.user.id),
            }),
        ]);

        await new Promise((resolve) => setTimeout(resolve, 1200));

        const { data: finalTrip, error: finalTripError } = await driverA.client
            .from('trips')
            .select('id,status,driver_id,updated_at')
            .eq('id', targetTripId)
            .maybeSingle();

        if (finalTripError) {
            throw new Error(`Failed to read final trip state: ${finalTripError.message || finalTripError.details || finalTripError}`);
        }

        const acceptedOutcomes = [acceptA, acceptB].filter((entry) => entry.outcome === 'accepted');
        const winnerDriverId = finalTrip?.driver_id || null;
        const expectedWinnerIds = new Set([driverA.user.id, driverB.user.id]);
        const pass =
            finalTrip?.status === 'accepted' &&
            winnerDriverId &&
            expectedWinnerIds.has(winnerDriverId) &&
            acceptedOutcomes.length === 1;

        const raceResult = {
            phase: 'after_accept_race',
            targetTripId,
            before: {
                visibleToDriverA: visibleToDriverABefore,
                visibleToDriverB: visibleToDriverBBefore,
            },
            attemptA: {
                driverId: driverA.user.id,
                ...acceptA,
            },
            attemptB: {
                driverId: driverB.user.id,
                ...acceptB,
            },
            finalTrip: finalTrip || null,
            pass,
        };

        console.log(JSON.stringify(raceResult, null, 2));
        if (!pass) {
            process.exit(2);
        }
        process.exit(0);
    }

    const acceptResult = await acceptTripAsDriver(driverA, targetTripId);
    if (acceptResult.outcome !== 'accepted') {
        throw new Error(`Driver A could not accept trip ${targetTripId}. Result: ${JSON.stringify(acceptResult)}`);
    }
    console.log(`Accepted trip ${targetTripId} via ${acceptResult.path}`);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const afterA = await invokeDriverPool(driverA, requestPool, driverALocation);
    const afterB = await invokeDriverPool(driverB, requestPool, driverBLocation);
    const afterAIds = toIds(afterA.requests);
    const afterBIds = toIds(afterB.requests);

    const result = {
        phase: 'after_accept',
        targetTripId,
        visibleToDriverABefore,
        visibleToDriverBBefore,
        visibleToDriverA: afterAIds.includes(targetTripId),
        visibleToDriverB: afterBIds.includes(targetTripId),
        pass: !afterAIds.includes(targetTripId) && !afterBIds.includes(targetTripId),
        driverA_count: afterAIds.length,
        driverB_count: afterBIds.length,
        driverA_meta: afterA.meta || null,
        driverB_meta: afterB.meta || null,
    };

    console.log(JSON.stringify(result, null, 2));

    if (!result.pass) {
        process.exit(2);
    }
};

main().catch((error) => {
    console.error(`Dispatch smoke failed: ${error.message || error}`);
    process.exit(1);
});
