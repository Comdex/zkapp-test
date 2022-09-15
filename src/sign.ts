import {
  Bool,
  CircuitValue,
  Encoding,
  Field,
  Group,
  isReady,
  Poseidon,
  PrivateKey,
  prop,
  PublicKey,
  Scalar,
} from 'snarkyjs';

await isReady;

class DTSignature extends CircuitValue {
  @prop r: Field;
  @prop s: Scalar;

  static create(privKey: PrivateKey, msg: Field[]): DTSignature {
    const publicKey = PublicKey.fromPrivateKey(privKey).toGroup();
    const d = privKey.s;
    let kBits = Poseidon.hash(privKey.toFields().concat(msg)).toBits();
    const kPrime = Scalar.ofBits(kBits);
    let { x: r, y: ry } = Group.generator.scale(kPrime);
    const k = ry.toBits()[0].toBoolean() ? kPrime.neg() : kPrime;
    const e = Scalar.ofBits(
      Poseidon.hash(msg.concat([publicKey.x, publicKey.y, r])).toBits()
    );
    const s = e.mul(d).add(k);
    return new DTSignature(r, s);
  }

  verify(publicKey: PublicKey, msg: Field[]): Bool {
    const point = publicKey.toGroup();
    let e = Scalar.ofBits(
      Poseidon.hash(msg.concat([point.x, point.y, this.r])).toBits()
    );
    let r = point.scale(e).neg().add(Group.generator.scale(this.s));
    return Bool.and(r.x.equals(this.r), r.y.toBits()[0].equals(false));
  }
}

let prik = PrivateKey.random();
let pubk = prik.toPublicKey();
console.log('privateKey: ', prik.toBase58());
console.log('publicKey: ', pubk.toBase58());

// message
let message = 'This is a secret.';
let messageFields = Encoding.stringToFields(message);

let signs = DTSignature.create(prik, messageFields);
console.log('signs1: ', signs.toJSON());

let signs2 = DTSignature.create(prik, messageFields);
console.log('signs2: ', signs2.toJSON());

console.log('sign1 ok: ', signs.verify(pubk, messageFields).toString());
console.log('sign2 ok: ', signs2.verify(pubk, messageFields).toString());
