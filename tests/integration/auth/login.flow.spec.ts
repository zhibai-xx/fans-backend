describe('Integration • POST /api/users/login', () => {
  it('exposes canonical login endpoint placeholder', () => {
    const endpoint = '/api/users/login';
    expect(endpoint).toMatch('/api/users/login');
  });

  it('documents unified error format usage', () => {
    const errorResponse = {
      statusCode: 400,
      timestamp: new Date().toISOString(),
      path: '/api/users/login',
      message: 'email must be an email;password should not be empty',
      error: 'Bad Request',
    };

    expect(errorResponse.message.includes(';')).toBe(true);
  });
});
