# Geometry Engine

The 2d and 3d geometry library.

# Implementation

One of goals of this library is to depends on zero external library. So we copy code from some libraries. For exmaple, we copy classes `Box3`、`Matrix3`, `Matrix4`, `Plane`, `Vector2`, and `Vector3` from [THREE.js](https://threejs.org/docs/).

## TODO

### Cache
- Cache bounding box of all geometries
- Cache start point and end point of curve