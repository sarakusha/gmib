type Char = string;
type Code = number;
export type CodeFromCharacter = (char: Char) => Code;
export type CharacterFromCode = (code: Code) => Char;

const calcRemainder = (
  codeFromCharacter: CodeFromCharacter,
  N: number,
  input: string,
  validate: boolean,
): number => {
  const sum = input
    .split('')
    .reverse()
    .map(codeFromCharacter)
    .filter(Number.isInteger)
    .reduce((acc, code, i) => {
      const addend = code * (validate ? 1 + (i % 2) : 2 - (i % 2));
      return acc + Math.floor(addend / N) + (addend % N);
    }, 0);
  return sum % N;
};

export const createCharGenerator =
  (
    codeFromCharacter: CodeFromCharacter,
    characterFromCode: CharacterFromCode,
    N: number,
  ) =>
    (input: string): Char => {
      const remainder = calcRemainder(codeFromCharacter, N, input, false);
      const checkCode = (N - remainder) % N;
      return characterFromCode(checkCode);
    };

export const createCharValidator =
  (codeFromCharacter: CodeFromCharacter, N: number) =>
    (input: string): boolean => {
      const rem = calcRemainder(codeFromCharacter, N, input, true);
      return rem === 0;
    };

const N36 = 36;
const codeFromCharacterMod36: CodeFromCharacter = (char) =>
  Number.parseInt(char, N36);
const characterFromCodeMod36: CharacterFromCode = (code) =>
  code.toString(N36).toUpperCase();

export const charGenerator = createCharGenerator(
  codeFromCharacterMod36,
  characterFromCodeMod36,
  N36,
);

export const charValidator = createCharValidator(codeFromCharacterMod36, N36);