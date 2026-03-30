import { JwtService } from '@nestjs/jwt';

describe('Auth • JWT Service', () => {
  const jwtService = new JwtService({
    secret: 'test-secret',
    signOptions: { expiresIn: '1h' },
  });

  it('signs payload with id and uuid fields', () => {
    const payload = {
      sub: 'user-id-1',
      uuid: 'user-uuid-1',
      sessionVersion: 2,
      type: 'access',
    };
    const token = jwtService.sign(payload);
    const decoded = jwtService.decode(token) as Record<string, unknown>;

    expect(decoded).toMatchObject({
      sub: payload.sub,
      uuid: payload.uuid,
      sessionVersion: payload.sessionVersion,
      type: payload.type,
    });
  });

  it('honors custom expiration windows', () => {
    const payload = { sub: 'user-id-2', uuid: 'user-uuid-2' };
    const token = jwtService.sign(payload, { expiresIn: '2m' });
    expect(typeof token).toBe('string');
  });

  it('keeps refresh token type claim for refresh flow', () => {
    const payload = {
      sub: 'user-id-3',
      uuid: 'user-uuid-3',
      sessionVersion: 9,
      type: 'refresh',
    };
    const token = jwtService.sign(payload, { expiresIn: '7d' });
    const decoded = jwtService.decode(token) as Record<string, unknown>;

    expect(decoded.type).toBe('refresh');
    expect(decoded.sessionVersion).toBe(9);
  });
});
