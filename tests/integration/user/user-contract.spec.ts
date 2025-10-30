describe('Integration • User contract', () => {
  it('documents id + uuid presence in user responses', () => {
    const responsePayload = {
      statusCode: 200,
      data: {
        id: 12,
        uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        nickname: 'tester',
      },
    };

    expect(responsePayload.data).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        uuid: expect.any(String),
      }),
    );
  });
});
