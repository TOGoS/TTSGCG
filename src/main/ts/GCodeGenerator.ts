import * as vectormath from './vectormath';
import { TransformationMatrix3D, Vector3D } from './vectormath';

// Vector3D = {x:Number, y:Number, z:Number}
// StraightPathSegment = 
// PathSegment = StraightPathSegment|ArcPathSegment
// Path = { vertexes: Vector3D[], segments: PathSegment[] }

interface StraightPathSegment {
	startVertexIndex:number;
	endVertexIndex:number;
	isCurve:false;
}
interface CurvedPathSegment {
	startVertexIndex:number;
	endVertexIndex:number;
	isCurve:true;
	direction:"clockwise"|"counterclockwise";
	curveCenterVertex:number|undefined;
}
type PathSegment = StraightPathSegment|CurvedPathSegment;

interface Path {
	vertexes: Vector3D[];
	segments: PathSegment[];
}

class PathBuilder
{
	public path:Path;
	protected atVertexIndex:number|undefined;
	protected direction:Vector3D;
	constructor() {
		this.path = {
			vertexes: [],
			segments: []
		};
	}
	protected findVertex(pos:Vector3D):number {
		this.path.vertexes.push(pos);
		return this.path.vertexes.length-1;
	}

	startAt(vec:Vector3D):PathBuilder {
		if(this.atVertexIndex != undefined) throw new Error("Path already started");
		this.path.vertexes.push(vec);
		this.atVertexIndex = 0;
		return this;
	}
	lineTo(vec:Vector3D):PathBuilder {
		if(this.atVertexIndex == undefined) throw new Error("Path not yet started");
		let endVertexIndex = this.findVertex(vec);
		this.path.segments.push({
			startVertexIndex: this.atVertexIndex,
			endVertexIndex,
			isCurve: false
		})
		this.atVertexIndex = endVertexIndex;
		return this;
	}
	curveTo(vec:Vector3D):PathBuilder {
		throw new Error("CurveTo not yet implemented");
	}
}

interface DistanceUnit {
	name : string;
	gCode : string;
	unitValueInMm : number;
};

const INCH : DistanceUnit = {
	name:"inch",
	gCode:"G20",
	unitValueInMm:2.54
};

const MM : DistanceUnit = {
	name:"mm",
	gCode:"G21",
	unitValueInMm:1,
};

interface PathCarveOptions
{
	depth:number;
}

class GCodeGenerator {
	public bitRadius:number;
	public emitter:(s:string)=>string;
	public transformation:TransformationMatrix3D;
	public unit:DistanceUnit;
	public zoomHeight:number = 1/4;
	public minimumFastZ:number = 1/16;
	public stepDown:number = 0.02;
	public fractionDigits:number = 4;
	protected savedTransformations:TransformationMatrix3D[] = [];
	protected _position = {x:0, y:0, z:0};
	constructor() {
		this.bitRadius = 3;
		this.emitter = console.log.bind(console);
		this.transformation = vectormath.createIdentityTransform();
		this.unit = INCH;
	}
	pushTransform(xf:TransformationMatrix3D):void {
		this.savedTransformations.push(this.transformation);
		this.transformation = vectormath.multiplyTransform(this.transformation, xf);
	}
	popTransform():void {
		let popped = this.savedTransformations.pop();
		if( popped == undefined ) throw new Error("Tried to pop transform from empty stack!");
		this.transformation = popped;
	}
	protected transformVector(vec:Vector3D):Vector3D {
		return vectormath.transformVector(this.transformation, vec);
	}
	emit(line:string):void {
		this.emitter(line);
	}
	emitBlankLine():void {
		this.emit("");
	}
	emitComment(c:string):void {
		this.emit("("+c+")");
	}
	emitBlock(lines:string[]):void {
		for(let l in lines) this.emitter(lines[l]);
	}
	doMove(command:string, x:number|undefined, y:number|undefined, z:number|undefined=undefined) {
		if( x == undefined && y == undefined && z == undefined ) {
			this.emitComment("doMove with no x, y, or z!");
			return;
		}
		let line = command;
		if( x != undefined ) line += " X"+x.toFixed(this.fractionDigits);
		if( y != undefined ) line += " Y"+y.toFixed(this.fractionDigits);
		if( z != undefined ) line += " Z"+z.toFixed(this.fractionDigits);
		this.emit(line)
		this._position = {
			x: x == undefined ? this._position.x : x,
			y: y == undefined ? this._position.y : y,
			z: z == undefined ? this._position.z : z,
		};
	}
	g00(x:number|undefined, y:number|undefined, z:number|undefined=undefined) {
		this.doMove("G00", x, y, z);
	}
	g01(x:number|undefined, y:number|undefined, z:number|undefined=undefined) {
		this.doMove("G01", x, y, z);
	}
	emitSetupCode():void {
		this.emit("G90");
		this.emit("G20");
		this.emit("F3");
		this.emit("S1000");
		this.emit("M03");
		this.zoomToZoomHeight();
		this.emitBlankLine();
	}
	emitShutdownCode():void {
		this.emitBlankLine();
		this.emitComment("Job done!");
		this.zoomToZoomHeight();
		this.emit("M05");
	}
	zoomToZoomHeight():void {
		this.g00(undefined, undefined, this.zoomHeight);
	}
	zoomTo(position:Vector3D):void {
		this.zoomToZoomHeight();
		position = this.transformVector(position);
		this.g00(position.x, position.y);
		let minZoomZ = Math.max(this.minimumFastZ, position.z);
		this.g00(undefined, undefined, minZoomZ);
		if( minZoomZ != position.z ) {
			this.g01(undefined, undefined, position.z);
		}
	}
	carvePathSegment(path:Path, segmentIndex:number, direction:number):void {
		let segment = path.segments[segmentIndex];
		let startVertexIndex:number;
		let endVertexIndex:number;
		if( direction > 0 ) {
			startVertexIndex = segment.startVertexIndex;
			endVertexIndex   = segment.endVertexIndex;
		} else {
			startVertexIndex = segment.endVertexIndex;
			endVertexIndex   = segment.startVertexIndex;
		}
		let startVertex = this.transformVector(path.vertexes[startVertexIndex]);
		let endVertex = this.transformVector(path.vertexes[endVertexIndex]);
		// Theoretically vertexes could have depth.  I'm ignoring that for now.
		this.g01(endVertex.x, endVertex.y);
	}
	emitPath(path:Path, opts:PathCarveOptions):void {
		if(path.vertexes.length == 0) return;
		if(opts.depth <= 0) return;

		let targetZ = 0 - opts.depth;
		let startPoint = path.vertexes[0];
		this.zoomTo(startPoint);
		let currentZ = 0;
		let direction = 1;
		while( currentZ > targetZ ) {
			let startPosition = this._position;
			currentZ = Math.max(targetZ, currentZ - this.stepDown);
			this.emitComment("Step down to "+currentZ.toFixed(this.fractionDigits));
			this.g01(undefined, undefined, currentZ);
			let ssi0:number, ssi1:number, ssii:number;
			if( direction > 0 ) {
				ssi0 = 0;
				ssi1 = path.segments.length-1;
				ssii = 1; 
			} else {
				ssi0 = path.segments.length-1;
				ssi1 = 0;
				ssii = -1; 
			}
			for( let i=ssi0; ; i += ssii ) {
				this.carvePathSegment(path, i, direction);
				if( i == ssi1 ) break;
			}
			if( !vectormath.vectorsAreEqual(this._position, startPosition) ) {
				// Unless it's a loop, reverse for the next step!
				direction = -direction;
			}
		}
	}
	emitTogPanel():void {
		const path = new PathBuilder().startAt({x:0,y:0,z:0}).lineTo({x:4,y:0,z:0}).lineTo({x:4,y:3.5,z:0}).lineTo({x:0,y:3.5,z:0}).lineTo({x:0,y:0,z:0}).path;
		this.emitPath(path, {
			depth: 0.125,
		});
	}
}

if( require.main == module ) {
	let gcg = new GCodeGenerator();
	gcg.emitSetupCode();
	gcg.emitTogPanel();
	gcg.emitShutdownCode();
}
