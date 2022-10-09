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
  Group,
} from 'snarkyjs';
await isReady;

const doProofs = true;
const initialCounter = Field.zero;

const TEST_TYPE1 = Field(1);
const TEST_TYPE2 = Field(2);
class Action extends CircuitValue {
  @prop type: Field;
  @prop data: Group;

  constructor(type: Field, data: Group) {
    super();
    this.type = type;
    this.data = data;
  }

  isType1(): Bool {
    return this.type.equals(TEST_TYPE1);
  }

  isType2(): Bool {
    return this.type.equals(TEST_TYPE2);
  }

  isDummyData(): Bool {
    return this.type.equals(Field.zero);
  }

  static type1(data: Group): Action {
    return new Action(TEST_TYPE1, data);
  }

  static type2(data: Group) {
    return new Action(TEST_TYPE2, data);
  }
}

class TestZkapp extends SmartContract {
  reducer = Experimental.Reducer({ actionType: Action });

  @state(Field) counter = State<Field>();
  @state(Field) actionsHash = State<Field>();

  @method testAction1(data: Group) {
    this.reducer.dispatch(Action.type1(data));
  }
  @method testAction2(data: Group) {
    this.reducer.dispatch(Action.type2(data));
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
          let newState = Circuit.if(action.isType1(), state.add(1), state);
          return newState;
        },
        { state: counter, actionsHash }
      );

    this.counter.set(newCounter);
    this.actionsHash.set(newActionsHash);
  }
}

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
  zkapp.testAction1(PrivateKey.random().toPublicKey().toGroup());
  if (!doProofs) zkapp.sign(zkappKey);
});
if (doProofs) await tx.prove();
tx.send();

console.log('action 2');
tx = await Mina.transaction(feePayer, () => {
  zkapp.testAction1(PrivateKey.random().toPublicKey().toGroup());
  if (!doProofs) zkapp.sign(zkappKey);
});
if (doProofs) await tx.prove();
tx.send();

console.log('action 3');
tx = await Mina.transaction(feePayer, () => {
  zkapp.testAction1(PrivateKey.random().toPublicKey().toGroup());
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

console.log('applying more actions');

console.log('action 4');
tx = await Mina.transaction(feePayer, () => {
  zkapp.testAction2(PrivateKey.random().toPublicKey().toGroup());
  if (!doProofs) zkapp.sign(zkappKey);
});
if (doProofs) await tx.prove();
tx.send();

console.log('action 5');
tx = await Mina.transaction(feePayer, () => {
  zkapp.testAction1(PrivateKey.random().toPublicKey().toGroup());
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
shutdown();
