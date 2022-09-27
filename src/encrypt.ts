import { isReady, PrivateKey, Encoding, Encryption, PublicKey } from 'snarkyjs';

await isReady;

let privateKey = PrivateKey.random();
let publicKey = privateKey.toPublicKey();
console.log('publicKey: ', publicKey.toBase58());

// let message = 'This is a secret.';
// let messageFields = Encoding.stringToFields(message);

let messageFields = publicKey.toFields();

let cipherText = Encryption.encrypt(messageFields, publicKey);
console.log('ciphertext fs length: ', cipherText.cipherText.length);

let fs = Encryption.decrypt(cipherText, privateKey);
console.log('fs length: ', fs.length);

let pub = PublicKey.ofFields(fs);
console.log('origin publickey: ', pub.toBase58());
