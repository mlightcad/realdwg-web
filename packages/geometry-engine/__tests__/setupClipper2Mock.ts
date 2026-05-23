jest.mock(
  'clipper2-ts',
  () => ({
    EndType: { Polygon: 0, Butt: 1 },
    JoinType: { Miter: 0 },
    inflatePaths: (paths: unknown) => paths
  }),
  { virtual: true }
)
