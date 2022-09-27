import {
  DeployArgs,
  SmartContract,
  state,
  UInt64,
  Permissions,
  method,
  PrivateKey,
  AccountUpdate,
  State,
  isReady,
  Mina,
  shutdown,
  Field,
} from 'snarkyjs';

await isReady;

const doProofs = true;

class TestZkapp extends SmartContract {
  @state(UInt64) fee = State<UInt64>();
  store: Map<string, Field>;

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
      send: Permissions.proofOrSignature(),
    });
    this.fee.set(UInt64.fromNumber(20_000_000));
  }

  setStore(map: Map<string, Field>) {
    this.store = map;
  }

  @method
  demo(num: UInt64) {
    let fee = this.fee.get();
    this.fee.assertEquals(fee);
    num.assertLte(fee);
  }
}

let local = Mina.LocalBlockchain();
Mina.setActiveInstance(local);
let feePayerKey = local.testAccounts[0].privateKey;
let callerKey = local.testAccounts[1].privateKey;
let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

async function test() {
  let zkapp = new TestZkapp(zkappAddress);

  if (doProofs) {
    console.time('compile');
    await TestZkapp.compile();
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

  let map = new Map<string, Field>;
  map.set("aaa", Field(22));
  map.set("bbb", Field(333));
  zkapp.setStore(map);

  console.log('demo start');
  try {
    tx = await local.transaction(feePayerKey, () => {
      zkapp.demo(UInt64.fromNumber(100000));

      if (!doProofs) {
        zkapp.sign(zkappKey);
      }
    });
    if (doProofs) {
      await tx.prove();
      tx.send();
    } else {
      tx.send();
    }
  } catch (err: any) {
    console.log(err);
  }

  console.log('demo end: zkapp balance', zkapp.account.balance.get().toString());

  shutdown();
}

await test();
