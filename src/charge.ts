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
} from 'snarkyjs';

await isReady;

const doProofs = true;

class TestZkapp extends SmartContract {
  @state(UInt64) fee = State<UInt64>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
      send: Permissions.proofOrSignature(),
    });

    this.fee.set(UInt64.fromNumber(20_000_000));
  }

  @method
  charge(caller: PrivateKey) {
    let fee = this.fee.get();
    this.fee.assertEquals(fee);

    let callerParty = AccountUpdate.createSigned(caller);
    callerParty.balance.subInPlace(fee);
    this.balance.addInPlace(fee);
  }

  @method
  charge2(caller: PrivateKey) {
    let fee = this.fee.get();
    this.fee.assertEquals(fee);

    let callerParty = AccountUpdate.createSigned(caller);
    callerParty.send({ to: this.address, amount: fee });
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

  console.log('charge1');
  try {
    tx = await local.transaction(feePayerKey, () => {
      zkapp.charge(callerKey);

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

  console.log('charge1: zkapp balance', zkapp.account.balance.get().toString());

  console.log('charge2');
  try {
    tx = await local.transaction(feePayerKey, () => {
      zkapp.charge2(callerKey);

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

  console.log('charge2: zkapp balance', zkapp.account.balance.get().toString());

  shutdown();
}

await test();
