import { SimpleCache } from './src/cache/simple-cache';

console.log('Testing SimpleCache in isolation...');

const cache = new SimpleCache(2000); // 2 second TTL

console.log('Setting key...');
cache.set('test', 'value');

console.log('Getting key immediately...');
console.log('Result:', cache.get('test'));

console.log('Waiting 3 seconds for expiration...');
setTimeout(() => {
  console.log('Getting key after expiration...');
  console.log('Result:', cache.get('test'));
  console.log('Test completed.');
}, 3000);