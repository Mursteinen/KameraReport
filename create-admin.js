const bcrypt = require('bcryptjs');
const { dbHelpers } = require('./database');

async function createAdminUser() {
    const username = process.argv[2] || 'admin';
    const password = process.argv[3] || 'admin123';
    const fullName = process.argv[4] || 'Administrator';
    const email = process.argv[5] || 'admin@example.com';

    try {
        // Check if user already exists
        const existingUser = await dbHelpers.getUserByUsername(username);
        if (existingUser) {
            console.log(`❌ Bruker '${username}' eksisterer allerede!`);
            process.exit(1);
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const newUser = await dbHelpers.createUser(username, passwordHash, fullName, email);

        console.log('✅ Admin-bruker opprettet!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Brukernavn: ${username}`);
        console.log(`Passord: ${password}`);
        console.log(`Fullt navn: ${fullName}`);
        console.log(`E-post: ${email}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n⚠️  VIKTIG: Endre passordet etter første innlogging!');
        console.log('\n🌐 Gå til http://localhost:3000/login.html for å logge inn');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Feil ved opprettelse av bruker:', err.message);
        process.exit(1);
    }
}

// Display usage if --help is provided
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Opprett en ny admin-bruker for Kamerainspeksjonsrapporter');
    console.log('\nBruk:');
    console.log('  node create-admin.js [brukernavn] [passord] [fullt navn] [e-post]');
    console.log('\nEksempel:');
    console.log('  node create-admin.js admin admin123 "Administrator" "admin@example.com"');
    console.log('\nStandard verdier:');
    console.log('  Brukernavn: admin');
    console.log('  Passord: admin123');
    console.log('  Fullt navn: Administrator');
    console.log('  E-post: admin@example.com');
    process.exit(0);
}

createAdminUser();
