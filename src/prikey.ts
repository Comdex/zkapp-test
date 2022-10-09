import {
  DeployArgs,
  isReady,
  PublicKey,
  SmartContract,
  Permissions,
  state,
  State,
  PrivateKey,
  method,
  Mina,
  AccountUpdate,
  shutdown,
  Encryption,
  Group,
} from 'snarkyjs';

await isReady;

const doProofs = true;
let ownerKey = PrivateKey.random();
let ownerPublicKey = ownerKey.toPublicKey();

class PriKeyTest extends SmartContract {
  @state(PublicKey) owner = State<PublicKey>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
    this.owner.set(ownerPublicKey);
  }

  @method
  checkOwner(ownerKey: PrivateKey) {
    let owner = this.owner.get();
    this.owner.assertEquals(owner);

    let ciphertext = Encryption.encrypt(ownerKey.toFields(), owner);
    let pk = ciphertext.publicKey;
    let pk2 = new Group(pk.x, pk.y);
    pk2.equals(owner.toGroup()).assertFalse();
    // let ok = PublicKey.fromGroup(pk);
    // this.owner.set(ok);
  }
}

let local = Mina.LocalBlockchain();
Mina.setActiveInstance(local);
let feePayerKey = local.testAccounts[0].privateKey;
let callerKey = local.testAccounts[1].privateKey;
let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

async function test() {
  let zkapp = new PriKeyTest(zkappAddress);

  if (doProofs) {
    console.time('compile');
    await PriKeyTest.compile();
    console.timeEnd('compile');
  }

  console.log('deploying');
  let tx = await local.transaction(feePayerKey, () => {
    AccountUpdate.fundNewAccount(feePayerKey);
    zkapp.deploy({ zkappKey });
  });
  if (doProofs) await tx.prove();
  tx.send();

  console.log('deploy done');

  console.log('start checkOwner tx');
  tx = await local.transaction(feePayerKey, () => {
    zkapp.checkOwner(ownerKey);

    if (!doProofs) {
      zkapp.sign(zkappKey);
    }
  });

  if (doProofs) await tx.prove();
  tx.send();

  shutdown();
}

await test();
