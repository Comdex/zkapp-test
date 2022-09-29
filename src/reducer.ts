import {
  Field,
  state,
  State,
  method,
  PrivateKey,
  SmartContract,
  Experimental,
  Mina,
  AccountUpdate,
  isReady,
  Permissions,
  circuitValue,
  Bool,
  Circuit,
  CircuitValue,
  arrayProp,
  shutdown,
  prop,
} from 'snarkyjs';
import assert from 'node:assert/strict';
import { Action } from './models/action';
import { NFT } from './models/nft';

await isReady;

class TestZkapp extends SmartContract {
  reducer = Experimental.Reducer({ actionType: Action });

  // on-chain version of our state. it will typically lag behind the
  // version that's implicitly represented by the list of actions
  @state(Field) counter = State<Field>();
  // helper field to store the point in the action history that our on-chain state is at
  @state(Field) actionsHash = State<Field>();

  @method testAction1(nft: NFT) {
    this.reducer.dispatch(Action.mint(nft));
  }
  @method testAction2(nft: NFT) {
    this.reducer.dispatch(Action.transfer(nft, nft.hash()));
  }

  @method rollup() {
    let counter = this.counter.get();
    this.counter.assertEquals(counter);
    let actionsHash = this.actionsHash.get();
    this.actionsHash.assertEquals(actionsHash);

    let pendingActions = this.reducer.getActions({
      fromActionHash: actionsHash,
    });

    let { state: newCounter, actionsHash: newActionsHash } =
      this.reducer.reduce(
        pendingActions,
        Field,
        (state: Field, action: Action) => {
          let newState = Circuit.if(action.isMint(), state.add(1), state);
          return newState;
        },
        { state: counter, actionsHash }
      );

    this.counter.set(newCounter);
    this.actionsHash.set(newActionsHash);
  }
}

const doProofs = true;
const initialCounter = Field.zero;

let Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);

let feePayer = Local.testAccounts[0].privateKey;

let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();
let zkapp = new TestZkapp(zkappAddress);
if (doProofs) {
  console.log('compile');
  await TestZkapp.compile();
}

console.log('deploy');
let tx = await Mina.transaction(feePayer, () => {
  AccountUpdate.fundNewAccount(feePayer);
  zkapp.deploy({ zkappKey });
  if (!doProofs) {
    zkapp.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
      editSequenceState: Permissions.proofOrSignature(),
    });
  }
  zkapp.counter.set(initialCounter);
  zkapp.actionsHash.set(Experimental.Reducer.initialActionsHash);
});
tx.send();

console.log('applying actions..');

console.log('action 1');

tx = await Mina.transaction(feePayer, () => {
  zkapp.testAction1(
    NFT.createNFTwithoutID('hello1', PrivateKey.random().toPublicKey())
  );
  if (!doProofs) zkapp.sign(zkappKey);
});
if (doProofs) await tx.prove();
tx.send();

console.log('action 2');
tx = await Mina.transaction(feePayer, () => {
  zkapp.testAction1(
    NFT.createNFTwithoutID('hello1', PrivateKey.random().toPublicKey())
  );
  if (!doProofs) zkapp.sign(zkappKey);
});
if (doProofs) await tx.prove();
tx.send();

console.log('action 3');
tx = await Mina.transaction(feePayer, () => {
  zkapp.testAction1(
    NFT.createNFTwithoutID('hello1', PrivateKey.random().toPublicKey())
  );
  if (!doProofs) zkapp.sign(zkappKey);
});
if (doProofs) await tx.prove();
tx.send();

console.log('rolling up pending actions..');

console.log('state before: ' + zkapp.counter.get());

tx = await Mina.transaction(feePayer, () => {
  zkapp.rollup();
  if (!doProofs) zkapp.sign(zkappKey);
});
if (doProofs) await tx.prove();
tx.send();

console.log('state after rollup: ' + zkapp.counter.get());
assert.deepEqual(zkapp.counter.get().toString(), '3');

console.log('applying more actions');

console.log('action 4');
tx = await Mina.transaction(feePayer, () => {
  zkapp.testAction2(
    NFT.createNFTwithoutID('hello1', PrivateKey.random().toPublicKey())
  );
  if (!doProofs) zkapp.sign(zkappKey);
});
if (doProofs) await tx.prove();
tx.send();

console.log('action 5');
tx = await Mina.transaction(feePayer, () => {
  zkapp.testAction1(
    NFT.createNFTwithoutID('hello1', PrivateKey.random().toPublicKey())
  );
  if (!doProofs) zkapp.sign(zkappKey);
});
if (doProofs) await tx.prove();
tx.send();

console.log('rolling up pending actions..');

console.log('state before: ' + zkapp.counter.get());

tx = await Mina.transaction(feePayer, () => {
  zkapp.rollup();
  if (!doProofs) zkapp.sign(zkappKey);
});
if (doProofs) await tx.prove();
tx.send();

console.log('state after rollup: ' + zkapp.counter.get());
assert.equal(zkapp.counter.get().toString(), '4');

shutdown();
