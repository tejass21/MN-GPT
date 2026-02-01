const crypto = require('crypto');
const readline = require('readline');

// CONSTANTS - Must match the one in src/utils/license.js
const SECRET_KEY = 'DESIER_AI_PREMIUM_LICENSE_SECRET_KEY_V1';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Generates a license key for a given device ID, duration, and type.
 * @param {string} deviceKey 
 * @param {number} durationDays 
 * @param {string} type - 'U' for Unlimited, 'L' for Limited
 * @returns {string} The generated license key.
 */
function generateLicenseKey(deviceKey, durationDays, type) {
    let prefix;

    if (durationDays === -1) {
        prefix = 'FFFF';
    } else {
        const epoch = new Date('2024-01-01T00:00:00Z');
        const now = new Date();
        const expirationDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

        // Calculate days since epoch
        const diffTime = Math.abs(expirationDate - epoch);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        prefix = diffDays.toString(16).toUpperCase().padStart(4, '0');
    }

    const signature = generateSignature(deviceKey, prefix, type);

    // Combine: PREFIX (4) + TYPE (1) + SIGNATURE (11)
    // We shorten signature by 1 char to keep total length 16
    const fullKey = prefix + type + signature;

    // Format: XXXX-XXXX-XXXX-XXXX
    const parts = fullKey.match(/.{1,4}/g);
    return parts.join('-');
}

function generateSignature(deviceKey, prefix, type) {
    const data = deviceKey + prefix + type;
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(data);
    const hash = hmac.digest('hex').toUpperCase();
    return hash.substring(0, 11); // Took 11 chars instead of 12 to fit Type
}

console.log('=== DesierAI License Key Generator ===');
console.log('1. Enter the Device ID from the user.');
console.log('2. Select the Plan Type.');
console.log('3. Select the license duration.');

rl.question('Device ID: ', (deviceId) => {
    if (!deviceId) {
        console.log('Error: Device ID cannot be empty.');
        rl.close();
        return;
    }

    const cleanDeviceId = deviceId.trim();

    console.log('\nSelect Plan Type:');
    console.log('[1] 1000rs Plan (280 Responses Limit)');
    console.log('[2] 2000rs Plan (Unlimited Responses)');

    rl.question('Choice (1-2): ', (planChoice) => {
        let planType = 'U'; // Default to Unlimited
        let planLabel = 'Unlimited';

        if (planChoice.trim() === '1') {
            planType = 'L';
            planLabel = 'Limited (280 Responses)';
        } else if (planChoice.trim() === '2') {
            planType = 'U';
            planLabel = 'Unlimited';
        } else {
            console.log('Invalid choice, defaulting to Unlimited.');
        }

        rl.question('Enter duration in days (or \'L\' for Lifetime): ', (durationInput) => {
            let durationDays = -1; // Default to lifetime
            let durationLabel = 'Lifetime';
            const cleanInput = durationInput.trim().toUpperCase();

            if (cleanInput === 'L' || cleanInput === 'LIFETIME' || cleanInput === '') {
                durationDays = -1;
                durationLabel = 'Lifetime';
            } else {
                const days = parseInt(cleanInput, 10);
                if (!isNaN(days) && days > 0) {
                    durationDays = days;
                    durationLabel = `${days} Days`;
                } else {
                    console.log('Invalid duration entered, defaulting to Lifetime.');
                    durationDays = -1;
                    durationLabel = 'Lifetime';
                }
            }

            const licenseKey = generateLicenseKey(cleanDeviceId, durationDays, planType);

            console.log('\n----------------------------------------');
            console.log(`GENERATED LICENSE KEY`);
            console.log(`Plan: ${planLabel}`);
            console.log(`Duration: ${durationLabel}`);
            console.log('----------------------------------------');
            console.log(licenseKey);
            console.log('----------------------------------------');
            console.log('\nProvide this key to the user to activate the software.');

            rl.close();
        });
    });
});
