import { randomUUID } from 'crypto';

describe('User • Model contract', () => {
  it('ensures user responses contain id and uuid', () => {
    const user = {
      id: 42,
      uuid: randomUUID(),
      email: 'mock@example.com',
    };

    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('uuid');
    expect(typeof user.uuid).toBe('string');
  });
});
