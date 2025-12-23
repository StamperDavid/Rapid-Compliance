// Test environment variables
console.log('Testing environment variables...\n');

console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING');
console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI ? 'SET' : 'MISSING');
console.log('FROM_EMAIL:', process.env.FROM_EMAIL ? 'SET' : 'MISSING');

console.log('\nFirebase (for comparison):');
console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'SET' : 'MISSING');

console.log('\n---');
console.log('Full GOOGLE_CLIENT_ID value:', process.env.GOOGLE_CLIENT_ID || 'UNDEFINED');
