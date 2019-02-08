import { randomBytes, pbkdf2Sync } from 'crypto';
import { transform } from 'lodash';
import store from './store';

const usersKey = 'users';

export class User {
  constructor(
    readonly name: string,
    readonly passwordHash: Buffer,
    readonly salt: Buffer) {
  }

  toJSON() {
    return {
      name: this.name,
      passwordHash: this.passwordHash.toString('base64'),
      salt: this.salt.toString('base64'),
    };
  }

  checkPassword(password: string) {
    return Buffer.compare(User.getHash(password, this.salt), this.passwordHash) === 0;
  }

  static fromJSON(name: string, passwordHash: string, salt: string) {
    return Object.freeze(new User(
      name,
      Buffer.from(passwordHash, 'base64'),
      Buffer.from(salt, 'base64'),
    ));
  }

  static getHash(password: string, salt: Buffer) {
    return pbkdf2Sync(password, salt, 1, 128, 'sha1');
  }

  static getSalt() {
    return randomBytes(128);
  }
}

type UserResult = [User | null, string | undefined];

class UserStore {
  private users: { [name: string]: User } = {};

  reload() {
    const users = store.get(usersKey);
    if (!users || Object.keys(users).length === 0) {
      this.createUser('admin', 'admin');
      console.log('create default user admin:admin');
      return;
    }
    this.users = transform(
      users,
      (result, { name, passwordHash, salt }) => {
        result[name] = User.fromJSON(name, passwordHash, salt);
      },
      {},
    );
    // console.log('USERS', this.users);
  }

  save() {
    const users = transform(
      this.users,
      (result, user, name) => {
        result[name] = user.toJSON();
      },
      {},
    );
    store.set(usersKey, users);
  }

  createUser(name: string, password: string): UserResult {
    if (this.users[name]) return [null, `Unknown user "${name}"`];
    const salt = User.getSalt();
    const passwordHash = User.getHash(password, salt);
    const user = Object.freeze(new User(name, passwordHash, salt));
    this.users[name] = user;
    this.save();
    return [user, undefined];
  }

  changeUserPassword(name: string, newPassword: string, oldPassword): UserResult {
    const user = this.users[name];
    if (!user) {
      return [null, `Unknown user "${name}"`];
    }
    if (!user.checkPassword(oldPassword)) {
      return [null, 'Invalid password'];
    }

    delete this.users[name];
    return this.createUser(name, newPassword);
  }

  removeUser(name: string) {
    if (!this.users[name]) return false;
    delete this.users[name];
    this.save();
  }

  getUser(name: string): User | undefined {
    return this.users[name];
  }

  hasUser(name?: string): boolean {
    if (!name) return false;
    const user = this.users[name];
    return !!(user && user.name);
  }
}

const users = new UserStore();
users.reload();

export default users;
