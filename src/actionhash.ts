import {
  AccountUpdate,
  Circuit,
  Experimental,
  Field,
  isReady,
  Mina,
  PrivateKey,
  SmartContract,
  State,
  state,
  Permissions,
  shutdown,
  // hacked the locally installed snarkyjs and exported the SequenceEvents to use
  SequenceEvents,
  method,
} from 'snarkyjs';

await isReady;

const doProofs = true;
const initialCounter = Field.zero;

class TestActions extends SmartContract {
  reducer = Experimental.Reducer({ actionType: Field });

  @state(Field) counter = State<Field>();

  @state(Field) currentActionsHash = State<Field>();

  @method
  commit(f: Field) {
    this.reducer.dispatch(f);
  }

  @method
  rollup() {
    let counter = this.counter.get();
    this.counter.assertEquals(counter);

    let currentActionsHash = this.currentActionsHash.get();
    this.currentActionsHash.assertEquals(currentActionsHash);

    let pendingActions = this.reducer.getActions({
      fromActionHash: currentActionsHash,
    });
    let { state: newCounter, actionsHash: newActionsHash } =
      this.reducer.reduce(
        pendingActions,
        Field,
        // eslint-disable-next-line no-unused-vars
        (state: Field, _action: Field) => {
          return state.add(1);
        },
        { state: counter, actionsHash: currentActionsHash }
      );

    Circuit.asProver(() => {
      console.log('new actionsHash: ', newActionsHash.toString());
    });
    this.counter.set(newCounter);
    this.currentActionsHash.set(newActionsHash);
  }
}

let Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);

let feePayerKey = Local.testAccounts[0].privateKey;
let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

let action1 = Field(1);
let action2 = Field(2);
let action3 = Field(3);

async function test() {
  let zkapp = new TestActions(zkappAddress);

  if (doProofs) {
    console.log('start compiling TestActions');
    console.time('TestActions compile');
    await TestActions.compile();
    console.timeEnd('TestActions compile');
  }

  console.log('deploying');
  let tx = await Mina.transaction(feePayerKey, () => {
    AccountUpdate.fundNewAccount(feePayerKey);
    zkapp.deploy({ zkappKey });

    if (!doProofs) {
      zkapp.setPermissions({
        ...Permissions.default(),
        editState: Permissions.proofOrSignature(),
        editSequenceState: Permissions.proofOrSignature(),
      });
    }

    zkapp.counter.set(initialCounter);
    zkapp.currentActionsHash.set(Experimental.Reducer.initialActionsHash);
  });

  if (doProofs) await tx.prove();
  tx.send();
  console.log('deploy done');

  tx = await Mina.transaction(feePayerKey, () => {
    zkapp.commit(action1);
    if (!doProofs) zkapp.sign(zkappKey);
  });
  if (doProofs) await tx.prove();
  tx.send();

  tx = await Mina.transaction(feePayerKey, () => {
    zkapp.commit(action2);
    if (!doProofs) zkapp.sign(zkappKey);
  });
  if (doProofs) await tx.prove();
  tx.send();

  tx = await Mina.transaction(feePayerKey, () => {
    zkapp.commit(action3);
    if (!doProofs) zkapp.sign(zkappKey);
  });
  if (doProofs) await tx.prove();
  tx.send();

  tx = await Mina.transaction(feePayerKey, () => {
    zkapp.rollup();
    if (!doProofs) zkapp.sign(zkappKey);
  });
  if (doProofs) await tx.prove();
  tx.send();

  let currentActionsHash = zkapp.currentActionsHash.get();
  console.log(
    'after rollup-currentActionsHash: ',
    currentActionsHash.toString()
  );

  let currentActionsHash2 = Experimental.Reducer.initialActionsHash;

  let fields1 = action1.toFields();
  let eventHash1 = SequenceEvents.hash([fields1]);
  currentActionsHash2 = SequenceEvents.updateSequenceState(
    currentActionsHash2,
    eventHash1
  );

  let fields2 = action2.toFields();
  let eventHash2 = SequenceEvents.hash([fields2]);
  currentActionsHash2 = SequenceEvents.updateSequenceState(
    currentActionsHash2,
    eventHash2
  );

  let fields3 = action3.toFields();
  let eventHash3 = SequenceEvents.hash([fields3]);
  currentActionsHash2 = SequenceEvents.updateSequenceState(
    currentActionsHash2,
    eventHash3
  );
  console.log(
    'manually computed actionshash: ',
    currentActionsHash2.toString()
  );

  currentActionsHash2.assertEquals(currentActionsHash);

  shutdown();
}

await test();
