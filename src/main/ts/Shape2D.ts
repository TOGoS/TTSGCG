import { Vector3D } from './vectormath';
import Transformish from './Transformish';

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
	classRef: "http://ns.nuke24.net/TTSGCG/Shape2D/Path",
	vertexes: Vector3D[]; // Ignore the z!
	segments: PathSegment[];
}
export interface CompoundShape2D {
    classRef: "http://ns.nuke24.net/TTSGCG/Shape2D/Compound",
    transformations: Transformish,
    components: Shape2D,
}

type Shape2D = Path;
export default Shape2D;
