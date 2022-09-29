import {
  arrayProp,
  CircuitValue,
  DeployArgs,
  isReady,
  PublicKey,
  SmartContract,
  Permissions,
  state,
  State,
  PrivateKey,
  method,
  Bool,
  Circuit,
  Mina,
  AccountUpdate,
  shutdown,
} from 'snarkyjs';

await isReady;

const doProofs = true;
let owner = PrivateKey.random();
let ownerPublicKey = owner.toPublicKey();

class InputParam extends CircuitValue {
  @arrayProp(PublicKey, 32) arr: PublicKey[];

  constructor(arr: PublicKey[]) {
    super();
    this.arr = arr;
  }
}

let pubKeys: PublicKey[] = [ownerPublicKey];
for (let i = 0; i < 31; i++) {
  pubKeys.push(PrivateKey.random().toPublicKey());
}
let params = new InputParam(pubKeys);

class ParamTest extends SmartContract {
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
  checkOwner(params: InputParam) {
    Circuit.asProver(() => {
      console.log('start check owner');
    });
    let owner = this.owner.get();
    this.owner.assertEquals(owner);

    let map = new Map<bigint, PublicKey>();
    Circuit.asProver(() => {
      map.set(0n, params.arr[0]);
      map.set(1n, params.arr[1]);
      map.set(2n, params.arr[2]);
    });

    let ownerExists = Bool(false);
    for (let i = 0; i < params.arr.length; i++) {
      let pubKey = params.arr[i];
      Circuit.asProver(() => {
        console.log('pubKey: ', pubKey.toBase58());
      });
      let temp = Circuit.if(pubKey.equals(owner), Bool(true), Bool(false));
      ownerExists = ownerExists.or(temp);
    }

    let pk = Circuit.witness(PublicKey, () => {
      return map.get(0n)!.toConstant();
    });
    ownerExists.assertTrue();
    pk.equals(owner).assertTrue();
  }
}

let local = Mina.LocalBlockchain();
Mina.setActiveInstance(local);
let feePayerKey = local.testAccounts[0].privateKey;
let callerKey = local.testAccounts[1].privateKey;
let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

async function test() {
  let zkapp = new ParamTest(zkappAddress);

  if (doProofs) {
    console.time('compile');
    await ParamTest.compile();
    console.timeEnd('compile');
  }

  console.log('deploying');
  let tx = await local.transaction(feePayerKey, () => {
    AccountUpdate.fundNewAccount(feePayerKey);
    zkapp.deploy({ zkappKey });
  });
  if (doProofs) {
    await tx.prove();
    tx.send();
  } else {
    tx.send();
  }

  console.log('deploy done');

  console.log('start send checkOwner tx');
  tx = await local.transaction(feePayerKey, () => {
    zkapp.checkOwner(params);

    if (!doProofs) {
      zkapp.sign(zkappKey);
    }
  });

  if (doProofs) {
    await tx.prove();
  }
  tx.send();

  shutdown();
}

await test();
