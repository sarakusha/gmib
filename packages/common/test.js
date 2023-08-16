const codePoints = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function numberOfValidInputCharacters() {
  return codePoints.length;
}

function codePointFromCharacter(character) {
  return codePoints.indexOf(character);
}

function characterFromCodePoint(codePoint) {
  return codePoints.charAt(codePoint);
}

function generateCheckCharacter(input) {
  let factor = 2;
  let sum = 0;
  let n = numberOfValidInputCharacters();

  // Starting from the right and working leftwards is easier since
  // the initial "factor" will always be "2".
  for (let i = input.length - 1; i >= 0; i--) {
    let codePoint = codePointFromCharacter(input.charAt(i));
    let addend = factor * codePoint;

    // Alternate the "factor" that each "codePoint" is multiplied by
    factor = factor == 2 ? 1 : 2;

    // Sum the digits of the "addend" as expressed in base "n"
    addend = Math.floor(addend / n) + (addend % n);
    sum += addend;
  }

  // Calculate the number that must be added to the "sum"
  // to make it divisible by "n".
  let remainder = sum % n;
  let checkCodePoint = (n - remainder) % n;
  return characterFromCodePoint(checkCodePoint);
}

function validateCheckCharacter(input) {
  let factor = 1;
  let sum = 0;
  let n = numberOfValidInputCharacters();

  // Starting from the right, work leftwards
  // Now, the initial "factor" will always be "1"
  // since the last character is the check character.
  for (let i = input.length - 1; i >= 0; i--) {
    let codePoint = codePointFromCharacter(input.charAt(i));
    let addend = factor * codePoint;

    // Alternate the "factor" that each "codePoint" is multiplied by
    factor = factor == 2 ? 1 : 2;

    // Sum the digits of the "addend" as expressed in base "n"
    addend = Math.floor(addend / n) + (addend % n);
    sum += addend;
  }
  let remainder = sum % n;
  return remainder == 0;
}

console.log(generateCheckCharacter('0AVFIOKWMJ9'));
console.log(validateCheckCharacter('0AVFIOKWMJ9K'));