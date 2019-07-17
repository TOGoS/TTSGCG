import { Path } from './Shape2D';
import { TransformationMatrix3D, Vector3D, identityTransformation } from './vectormath';
import Transformish, { SimpleTransformation2D } from './Transformish';
import ComplexAmount from './ComplexAmount';

export interface TracePath {
	classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath";
	path: Path;
	depth?: number;
	spaceSide: "left"|"right"|"middle"; // Compensate for bit radius?
}
export interface RectangularPocket {
	x0: number; x1: number;
	y0: number; y1: number;
	depth: number;
}
export interface ConicPocket {
	classRef: "http://ns.nuke24.net/TTSGCG/Cut/ConicPocket",
	diameter: number;
	edgeDepth: number;
	bottomDiameter: number;
	bottomDepth: number;
	cutsBottom: boolean;
}
// Apply each transformation to each shape!
export interface CompoundCut {
	classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
	unit?: ComplexAmount,
	transformations:Transformish[];
	components:Cut[];
}
// A circular edge
export interface RoundHole {
	classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
	diameter: number;
	depth: number;
}
type Cut = TracePath|CompoundCut|RoundHole|ConicPocket;
export default Cut;

export const identityTransformations = [identityTransformation];
Object.freeze(identityTransformations);