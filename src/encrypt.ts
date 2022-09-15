import { isReady, PrivateKey, Encoding, Encryption } from 'snarkyjs';

await isReady;

let privateKey = PrivateKey.random();
let publicKey = privateKey.toPublicKey();

let message = 'This is a secret.';
let messageFields = Encoding.stringToFields(message);

let cipherText = Encryption.encrypt(messageFields, publicKey);

let fs = Encryption.decrypt(cipherText, privateKey);

let msg = Encoding.stringFromFields(fs);
console.log('msg: ', msg);
