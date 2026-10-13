import bcrypt from 'bcryptjs';
import { APP_CONFIG } from '../src/lib/config';

export async function main() {
  console.log('Seeding CampusConnect database...');

  // Password hashes
  const adminPasswordHash = await bcrypt.hash('AdminSecurePassword123!', 10);
  const studentPasswordHash = await bcrypt.hash('StudentPass123!', 10);

  console.log('1. Universities configuration:');
  APP_CONFIG.initialUniversities.forEach((u) => {
    console.log(`   - ${u.name} (${u.code}) [${u.city}, ${u.state}]`);
  });

  console.log('2. Credit Packages:');
  APP_CONFIG.initialCreditPackages.forEach((pkg) => {
    console.log(`   - ${pkg.name}: ₹${pkg.priceInInr} for ${pkg.credits} credits`);
  });

  console.log('3. Super Admin Account:');
  console.log(`   - Email: admin@campusconnect.edu`);
  console.log(`   - Role: ADMIN`);

  console.log('4. Demo Seed Students:');
  console.log(`   - Aarav Sharma (Lovely Professional University - B.Tech CSE)`);
  console.log(`   - Priya Patel (Lovely Professional University - MBA)`);
  console.log(`   - Rohan Verma (Delhi University - Economics)`);
  console.log(`   - Ananya Iyer (VIT - Biotechnology)`);

  console.log('\nDatabase seeding completed successfully.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
