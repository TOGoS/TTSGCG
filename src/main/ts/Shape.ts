import { TransformationMatrix3D, Vector3D } from './vectormath';

// They're really 2D shapes.

export interface StraightPathSegment {
	typeName:"StraightPathSegment";
	startVertexIndex:number;
	endVertexIndex:number;
}
export interface CurvedPathSegment {
	typeName:"ClockwisePathSegment"|"CounterClockwisePathSegment";
	startVertexIndex:number;
	endVertexIndex:number;
	axisVertexIndex:number;
}
export type PathSegment = StraightPathSegment|CurvedPathSegment;

export interface Path {
	typeName: "Path";
	vertexes: Vector3D[];
	segments: PathSegment[];
}
// A path for the purpose of tracing a solid,
// which means when cutting, the path should be adjusted outwards
// (towards the 'space side')
export interface Edge {
	typeName: "Edge",
	path: Path,
	spaceSide: "left"|"right"
}
export interface TransformShape {
	typeName:"TransformShape";
	transformation:TransformationMatrix3D;
	transformee:Shape;
}
export interface CompoundShape {
	typeName:"CompoundShape";
	components:Shape[];
}
export interface Points {
	typeName:"Points"
	positions:Vector3D[];
}
export interface RoundHoles {
	typeName:"RoundHoles";
	positions:Vector3D[];
	diameter:number;
}
type Shape = TransformShape|CompoundShape|Path|RoundHoles|Points;
export default Shape;
