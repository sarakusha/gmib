/// <reference types="node" />
export declare class User {
    readonly name: string;
    readonly passwordHash: Buffer;
    readonly salt: Buffer;
    constructor(name: string, passwordHash: Buffer, salt: Buffer);
    toJSON(): {
        name: string;
        passwordHash: string;
        salt: string;
    };
    checkPassword(password: string): boolean;
    static fromJSON(name: string, passwordHash: string, salt: string): Readonly<User>;
    static getHash(password: string, salt: Buffer): Buffer;
    static getSalt(): Buffer;
}
declare type UserResult = [User | null, string | undefined];
declare class UserStore {
    private users;
    reload(): void;
    save(): void;
    createUser(name: string, password: string): UserResult;
    changeUserPassword(name: string, newPassword: string, oldPassword: string): UserResult;
    removeUser(name: string): false | undefined;
    getUser(name: string): User | undefined;
    hasUser(name?: string): boolean;
}
declare const users: UserStore;
export default users;
//# sourceMappingURL=users.d.ts.map