/**
 * Enumeration of object snap modes used in AutoCAD.
 * 
 * Object snap modes define the types of geometric points that can be
 * snapped to when drawing or editing entities. These modes help ensure
 * precise positioning and alignment of objects.
 */
export enum AcDbOsnapMode {
  /**
   * End point - snaps to the endpoint of a line, arc, or other entity
   */
  EndPoint = 1,
  /**
   * Middle point - snaps to the midpoint of a line or arc
   */
  MidPoint = 2,
  /**
   * Center - snaps to the center point of a circle, arc, or ellipse
   */
  Center = 3,
  /**
   * Node - snaps to a point entity
   */
  Node = 4,
  /**
   * Quadrant - snaps to the quadrant points of a circle or ellipse
   * (0°, 90°, 180°, 270°)
   */
  Quadrant = 5,
  /**
   * Insertion - snaps to the insertion point of text, blocks, or other objects
   */
  Insertion = 7,
  /**
   * Perpendicular - snaps to a point perpendicular to a line or arc
   */
  Perpendicular = 8,
  /**
   * Tangent - snaps to a point tangent to a circle or arc
   */
  Tangent = 9,
  /**
   * Nearest - snaps to the nearest point on an entity
   */
  Nearest = 10,
  /**
   * Center of the object - snaps to the centroid or center of mass of an object
   */
  Centroid = 11
}
