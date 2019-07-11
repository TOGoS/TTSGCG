import { TransformationMatrix3D, Vector3D } from './vectormath';

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

export interface TransformShape {
	typeName:"TransformShape";
	transformation:TransformationMatrix3D;
	subShape:Shape;
}
export interface MultiShape {
	typeName:"MultiShape";
	subShapes:Shape[];
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
export type Shape = TransformShape|MultiShape|Path|RoundHoles|Points;
