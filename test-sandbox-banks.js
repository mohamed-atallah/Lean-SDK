/**
 * Test Script: Verify Sandbox Banks with Plaid API
 *
 * This script tests all 7 documented sandbox institution IDs to verify
 * which ones actually work with the /link/token/create endpoint.
 */

const http = require('http');

// List of sandbox banks to test
const SANDBOX_BANKS = [
    { id: 'ins_109508', name: 'First Platypus Bank', recommended: true },
    { id: 'ins_109509', name: 'First Gingham Credit Union', recommended: false },
    { id: 'ins_109510', name: 'Tattersall Federal Credit Union', recommended: false },
    { id: 'ins_109511', name: 'Houndstooth Bank', recommended: false },
    { id: 'ins_109512', name: 'Tartan Bank', recommended: false },
    { id: 'ins_109513', name: 'Platinum Standard Bank', recommended: false },
    { id: 'ins_109514', name: 'Gold Standard Bank', recommended: false }
];

// Test function
async function testInstitution(institutionId, institutionName) {
    return new Promise((resolve) => {
        const postData = JSON.stringify({
            user_id: 'test_user_validation',
            institution_id: institutionId
        });

        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/api/plaid/create-link-token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);

                    if (res.statusCode === 200 && response.link_token) {
                        resolve({
                            institution_id: institutionId,
                            institution_name: institutionName,
                            success: true,
                            status_code: res.statusCode,
                            has_link_token: true,
                            link_token_preview: response.link_token.substring(0, 30) + '...',
                            error: null
                        });
                    } else {
                        resolve({
                            institution_id: institutionId,
                            institution_name: institutionName,
                            success: false,
                            status_code: res.statusCode,
                            has_link_token: false,
                            error: response.error || response.error_type || 'Unknown error',
                            error_type: response.error_type
                        });
                    }
                } catch (e) {
                    resolve({
                        institution_id: institutionId,
                        institution_name: institutionName,
                        success: false,
                        status_code: res.statusCode,
                        error: 'Failed to parse response: ' + e.message
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({
                institution_id: institutionId,
                institution_name: institutionName,
                success: false,
                error: 'Request failed: ' + error.message
            });
        });

        req.write(postData);
        req.end();
    });
}

// Main test function
async function runTests() {
    console.log('='.repeat(80));
    console.log('🧪 TESTING SANDBOX INSTITUTIONS WITH PLAID API');
    console.log('='.repeat(80));
    console.log('');
    console.log(`📋 Testing ${SANDBOX_BANKS.length} sandbox institutions...`);
    console.log('');

    const results = [];

    // Test each institution sequentially
    for (const bank of SANDBOX_BANKS) {
        console.log(`⏳ Testing: ${bank.name} (${bank.id})...`);
        const result = await testInstitution(bank.id, bank.name);
        results.push({ ...result, recommended: bank.recommended });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log('');

    // Separate results into success and failure
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Display successful institutions
    if (successful.length > 0) {
        console.log(`✅ WORKING INSTITUTIONS (${successful.length}/${results.length}):`);
        console.log('');
        successful.forEach((result, index) => {
            const badge = result.recommended ? '⭐' : '  ';
            console.log(`${badge} ${index + 1}. ${result.institution_name}`);
            console.log(`   Institution ID: ${result.institution_id}`);
            console.log(`   Status Code: ${result.status_code}`);
            console.log(`   Link Token: ${result.link_token_preview}`);
            console.log('');
        });
    }

    // Display failed institutions
    if (failed.length > 0) {
        console.log(`❌ FAILED INSTITUTIONS (${failed.length}/${results.length}):`);
        console.log('');
        failed.forEach((result, index) => {
            console.log(`   ${index + 1}. ${result.institution_name}`);
            console.log(`   Institution ID: ${result.institution_id}`);
            console.log(`   Status Code: ${result.status_code || 'N/A'}`);
            console.log(`   Error Type: ${result.error_type || 'N/A'}`);
            console.log(`   Error: ${result.error}`);
            console.log('');
        });
    }

    console.log('='.repeat(80));
    console.log('📈 STATISTICS');
    console.log('='.repeat(80));
    console.log(`Total Tested: ${results.length}`);
    console.log(`✅ Successful: ${successful.length} (${((successful.length / results.length) * 100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed.length} (${((failed.length / results.length) * 100).toFixed(1)}%)`);
    console.log('');

    // Recommendations
    console.log('='.repeat(80));
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(80));
    console.log('');

    if (successful.length === results.length) {
        console.log('🎉 All sandbox institutions are working correctly!');
        console.log('   The documentation is accurate.');
    } else if (successful.length > 0) {
        console.log('⚠️  Some institutions are not working in sandbox mode.');
        console.log('   Update documentation to only list working institutions:');
        console.log('');
        successful.forEach(result => {
            const badge = result.recommended ? '⭐' : '';
            console.log(`   - ${result.institution_id} - ${result.institution_name} ${badge}`);
        });
    } else {
        console.log('❌ No institutions are working. Check:');
        console.log('   1. Plaid credentials in .env file');
        console.log('   2. Server is running on port 8000');
        console.log('   3. Internet connection');
    }

    console.log('');
    console.log('='.repeat(80));
}

// Run the tests
runTests().catch(error => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
});
