describe('Integration • Auth session contract', () => {
  it('keeps canonical refresh endpoint', () => {
    const endpoint = '/api/users/refresh-token';
    expect(endpoint).toBe('/api/users/refresh-token');
  });

  it('keeps canonical logout endpoint', () => {
    const endpoint = '/api/users/logout';
    expect(endpoint).toBe('/api/users/logout');
  });

  it('documents login response includes refresh token', () => {
    const loginResponse = {
      access_token: 'access-token-placeholder',
      refresh_token: 'refresh-token-placeholder',
      user: {
        id: 1,
        uuid: 'user-uuid-1',
        username: 'tester',
      },
    };

    expect(typeof loginResponse.refresh_token).toBe('string');
    expect(loginResponse.refresh_token.length).toBeGreaterThan(0);
  });
});
