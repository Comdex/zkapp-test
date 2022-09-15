import {
  arrayProp,
  Bool,
  Circuit,
  CircuitValue,
  Field,
  isReady,
  shutdown,
} from 'snarkyjs';

await isReady;

class FieldArray extends CircuitValue {
  @arrayProp(Field, 8) arr: Field[];

  constructor(fs: Field[]) {
    super();
    this.arr = fs;
  }
}

let fs1: Field[] = [];
for (let i = 0; i < 8; i++) {
  fs1.push(Field(i));
}
let fr1 = new FieldArray(fs1);

let fs2: Field[] = [];
for (let j = 8; j < 16; j++) {
  fs2.push(Field(j));
}
let fr2 = new FieldArray(fs2);

function compareArray(fr1: FieldArray, fr2: FieldArray) {
  let hasNotSameField: Bool = Bool(true);
  for (let i = 0; i < fr1.arr.length; i++) {
    for (let j = 0; j < fr2.arr.length; j++) {
      let temp = Circuit.if(
        fr1.arr[i].equals(fr2.arr[j]),
        Bool(false),
        Bool(true)
      );
      hasNotSameField = hasNotSameField.and(temp);
    }
  }

  hasNotSameField.assertTrue();
}

function compareArray2(fr1: FieldArray, fr2: FieldArray) {
  for (let i = 0; i < fr1.arr.length; i++) {
    for (let j = 0; j < fr2.arr.length; j++) {
      fr1.arr[i].equals(fr2.arr[j]).assertFalse();
    }
  }
}

let result = Circuit.constraintSystem(() => {
  let fr1: FieldArray = Circuit.witness(FieldArray, () => fr1);
  let fr2: FieldArray = Circuit.witness(FieldArray, () => fr2);
  compareArray(fr1, fr2);
});

console.log('compare1: ', result);

let result2 = Circuit.constraintSystem(() => {
  let fr1: FieldArray = Circuit.witness(FieldArray, () => fr1);
  let fr2: FieldArray = Circuit.witness(FieldArray, () => fr2);
  compareArray2(fr1, fr2);
});

console.log('compare2: ', result2);

shutdown();
