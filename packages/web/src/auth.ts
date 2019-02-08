import passport from 'passport';
import { Strategy } from 'passport-local';
import users, { User } from './users';

passport.use(new Strategy(
  {
    usernameField: 'username',
    passwordField: 'password',
  },
  (name, password, done) => {
    const user = users.getUser(name);
    if (!user || !user.checkPassword(password)) {
      return done(null, false, { message: 'Неверный пароль' });
    }
    done(null, user);
  }));

passport.serializeUser((user: User, done) => {
  done(null, user.name);
});

passport.deserializeUser((name: string, done) => {
  const user = users.getUser(name);
  done(user ? null : 'Неизвестный пользователь', user);
});

export { passport };
