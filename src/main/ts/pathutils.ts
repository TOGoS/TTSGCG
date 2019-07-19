import {Path, PathSegment} from './Shape2D'
import Cut from './Cut';
import * as vectormath from './vectormath';
import { TransformationMatrix3D, Vector3D } from './vectormath';

export type CornerStyleName = "Chamfer"|"Round";

export class PathBuilder
{
	public path:Path;
	protected currentVertexIndex:number=0;
	protected vertexIndexes:{[v:string]:number} = {};
	protected _currentDirection:Vector3D = {x:1, y:0, z:0};
	constructor(startPoint:Vector3D) {
		this.path = {
			classRef: "http://ns.nuke24.net/TTSGCG/Shape2D/Path",
			vertexes: [startPoint],
			segments: []
		};
	}
	protected findVertex(pos:Vector3D):number {
		const key = pos.x+","+pos.y+","+pos.z;
		let idx = this.vertexIndexes[key];
		if( idx != undefined ) return idx;
		this.path.vertexes.push(pos);
		idx = this.path.vertexes.length-1;
		this.vertexIndexes[key] = idx;
		return idx;
	}

	lineTo(vec:Vector3D):PathBuilder {
		if(vectormath.vectorsAreEqual(vec, this.currentPosition)) return this;

		let endVertexIndex = this.findVertex(vec);
		this.path.segments.push({
			typeName: "StraightPathSegment",
			startVertexIndex: this.currentVertexIndex,
			endVertexIndex,
		})
		this.currentDirection = vectormath.subtractVectors(this.path.vertexes[endVertexIndex], this.path.vertexes[this.currentVertexIndex]);
		this.currentVertexIndex = endVertexIndex;
		return this;
	}
	set currentDirection(dir:Vector3D) {
		this._currentDirection = vectormath.normalizeVector(dir);
	}
	get currentPosition():Vector3D {
		if(this.currentVertexIndex == undefined) throw new Error("Path not yet started");
		return this.path.vertexes[this.currentVertexIndex];
	}
	turn(angle:number, radius:number=0, shape:CornerStyleName="Round"):PathBuilder {
		if(this.currentVertexIndex == undefined) throw new Error("Path not yet started");
		if( radius != 0 ) {
			const currentPosition = this.path.vertexes[this.currentVertexIndex];
			const forward = vectormath.scaleVector(this._currentDirection, radius);
			const toAxisFromStart = vectormath.transformVector(vectormath.xyzAxisAngleToTransform(0,0,angle > 0 ? 1 : -1,Math.PI/2), forward);
			const toAxisFromEnd = vectormath.transformVector(vectormath.xyzAxisAngleToTransform(0,0,1,angle), toAxisFromStart);
			const axisPosition = vectormath.addVectors(currentPosition, toAxisFromStart);
			const endPosition = vectormath.subtractVectors(axisPosition, toAxisFromEnd);
			//console.log("(forward = "+vectorToString(forward)+"; turned = "+vectorToString(turned)+"; start = "+vectorToString(currentPosition)+"; end = "+vectorToString(endPosition)+")");
			const axisVertexIndex = this.findVertex(axisPosition)
			const endVertexIndex = this.findVertex(endPosition);
			if( shape == "Round" ) {
				this.path.segments.push({
					typeName: angle < 0 ? "ClockwisePathSegment" : "CounterClockwisePathSegment",
					startVertexIndex: this.currentVertexIndex,
					endVertexIndex,
					axisVertexIndex,
				});
			} else {
				this.path.segments.push({
					typeName: "StraightPathSegment",
					startVertexIndex: this.currentVertexIndex,
					endVertexIndex,
				});
			}
			this.currentVertexIndex = endVertexIndex;
		}
		this.currentDirection = vectormath.transformVector(vectormath.xyzAxisAngleToTransform(0,0,1,angle), this._currentDirection);
		return this;
	}
	lineToCornerStart(cornerPosition:Vector3D, angle:number, radius:number) {
		const forward = vectormath.subtractVectors(cornerPosition, this.currentPosition);
		const cornerLength = radius * Math.sin(angle); // I think
		const forwardLength = vectormath.vectorLength(forward);
		const shortenedLength = forwardLength - cornerLength;
		const shortened = vectormath.scaleVector(forward, shortenedLength / forwardLength);
		this.lineTo(vectormath.addVectors(this.currentPosition, shortened));
	}

	curveTo(vec:Vector3D, endForward:Vector3D):PathBuilder {
		throw new Error("CurveTo not yet implemented");
	}

	closeLoop():PathBuilder {
		this.lineTo(this.path.vertexes[0]);
		return this;
	}
}

export interface CornerOptions {
	cornerStyleName:CornerStyleName;
	cornerRadius:number;
}
export const fullTurnAngle = Math.PI*2;
export const quarterTurn = Math.PI/2;
export const eighthTurnAngle = Math.PI/4;

interface BoxOptions {
	cx?:number;
	cy?:number;
	x0?:number;
	y0?:number;
	width:number;
	height:number;
	cornerOptions:CornerOptions;
}

function figureEdge(x0:number|undefined, cx:number|undefined, width:number, varName:string):number {
	if( x0 != undefined ) return x0;
	if( cx != undefined ) return cx - width/2;
	throw new Error("Either '"+varName+"0' or 'c"+varName+"' must be specified for box");
}

// Creates a path that traces a rectangle counterclockwise,
// optionally with beveled or rounded corners.
export function boxPath(boxOptions:BoxOptions) {
	const w = boxOptions.width;
	const h = boxOptions.height;
	const x0 = figureEdge(boxOptions.x0, boxOptions.cx, boxOptions.width, "x");
	const y0 = figureEdge(boxOptions.y0, boxOptions.cy, boxOptions.height, "y");
	const c = boxOptions.cornerOptions.cornerRadius;
	const cs = boxOptions.cornerOptions.cornerStyleName;
	let pb = new PathBuilder({x:x0+c, y:y0+0, z:0});
	pb.lineToCornerStart({x:x0+w,y:y0+0,z:0}, quarterTurn, c);
	pb.turn(quarterTurn, c, cs);
	pb.lineToCornerStart({x:x0+w,y:y0+h,z:0}, quarterTurn, c);
	pb.turn(quarterTurn, c, cs);
	pb.lineToCornerStart({x:x0+0,y:y0+h,z:0}, quarterTurn, c);
	pb.turn(quarterTurn, c, cs);
	pb.lineToCornerStart({x:x0+0,y:y0+0,z:0}, quarterTurn, c);
	pb.turn(quarterTurn, c, cs);
	return pb.closeLoop().path;
}

export function circlePath(radius:number):Path {
	let pb = new PathBuilder({x:0, y:-radius, z:0});
	return pb.turn(fullTurnAngle, radius).closeLoop().path;
}
